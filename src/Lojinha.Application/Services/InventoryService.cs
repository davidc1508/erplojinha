using System.Text.Json;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.Inventory;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IInventoryService
{
    Task<IReadOnlyList<InventoryMovementDto>> GetRecentAsync(Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<InventoryMovementDto> RegisterAsync(ManualInventoryMovementRequest request, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<InventoryMovementDto> ReverseAsync(Guid movementId, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid movementId, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
}

public sealed class InventoryService(
    IAppCacheInvalidationService cacheInvalidationService,
    IInventoryRepository inventoryRepository,
    IRepository<Product> productRepository,
    IRepository<Supply> supplyRepository,
    IRepository<BottonSize> bottonSizeRepository,
    IRepository<FinancialEntry> financeRepository,
    IRepository<AuditLog> auditRepository,
    IOperationalListService operationalListService) : IInventoryService
{
    public async Task<IReadOnlyList<InventoryMovementDto>> GetRecentAsync(Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var movements = await inventoryRepository.GetRecentAsync(cancellationToken);
        var products = productRepository.Query()
            .Where(product => !scopedSupplierId.HasValue || product.SupplierId == scopedSupplierId.Value)
            .ToDictionary(x => x.Id, x => new { x.Name, x.SupplierId });
        var supplies = supplyRepository.Query().ToDictionary(x => x.Id, x => x.Name);
        var visibleMovements = movements.Where(movement => movement.ItemType == InventoryItemType.Supply || products.ContainsKey(movement.ItemId)).ToList();

        return visibleMovements.Select(movement => new InventoryMovementDto(
            movement.Id,
            movement.ItemType,
            movement.ItemId,
            movement.ItemType == InventoryItemType.Product && products.TryGetValue(movement.ItemId, out var productInfo) ? productInfo.SupplierId : null,
            movement.ItemType == InventoryItemType.Product
                ? (products.TryGetValue(movement.ItemId, out var product) ? product.Name : "Produto")
                : supplies.GetValueOrDefault(movement.ItemId, "Insumo"),
            movement.Type,
            movement.Quantity,
            movement.UnitCost,
            movement.Notes,
            movement.OccurredAtUtc)).ToList();
    }

    public async Task<InventoryMovementDto> RegisterAsync(ManualInventoryMovementRequest request, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        string itemName;
        Guid? affectedSupplierId = null;
        var stockIncrease = request.Type is InventoryMovementType.Entry or InventoryMovementType.Adjustment ? request.Quantity : 0m;

        if (request.ItemType == InventoryItemType.Product)
        {
            var product = await productRepository.GetByIdAsync(request.ItemId, cancellationToken)
                ?? throw new InvalidOperationException("Produto nao encontrado.");

            if (scopedSupplierId.HasValue && product.SupplierId != scopedSupplierId.Value)
            {
                throw new InvalidOperationException("Fornecedor so pode movimentar o estoque dos proprios produtos.");
            }

            await ApplyStockAsync(product, product.CurrentStock, request, cancellationToken);
            product.CurrentStock = ComputeNewStock(product.CurrentStock, request);
            productRepository.Update(product);
            if (stockIncrease > 0m)
            {
                await AdjustBottonSizeStockAsync(product, -stockIncrease, actor, cancellationToken);
            }
            itemName = product.Name;
            affectedSupplierId = product.SupplierId;
        }
        else
        {
            if (scopedSupplierId.HasValue)
            {
                throw new InvalidOperationException("Fornecedor nao pode movimentar estoque de insumos.");
            }

            var supply = await supplyRepository.GetByIdAsync(request.ItemId, cancellationToken)
                ?? throw new InvalidOperationException("Insumo nao encontrado.");
            await ApplyStockAsync(null, supply.StockQuantity, request, cancellationToken);
            supply.StockQuantity = ComputeNewStock(supply.StockQuantity, request);
            supplyRepository.Update(supply);
            itemName = supply.Name;
        }

        var movement = new InventoryMovement
        {
            ItemType = request.ItemType,
            ItemId = request.ItemId,
            Type = request.Type,
            Quantity = request.Quantity,
            UnitCost = request.UnitCost,
            Notes = request.Notes?.Trim() ?? string.Empty,
            OccurredAtUtc = DateTime.UtcNow
        };

        await inventoryRepository.AddAsync(movement, cancellationToken);
        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(InventoryMovement),
            EntityId = movement.Id.ToString(),
            Action = AuditAction.StockChanged,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { request.ItemType, request.ItemId, request.Quantity, request.Type })
        }, cancellationToken);

        await inventoryRepository.SaveChangesAsync(cancellationToken);
        if (request.ItemType == InventoryItemType.Product)
        {
            if (stockIncrease > 0m)
            {
                await operationalListService.ConsumeRestockTargetAsync(request.ItemId, stockIncrease, affectedSupplierId, actor, cancellationToken);
            }

            var supplierIds = affectedSupplierId.HasValue ? new[] { affectedSupplierId.Value } : [];
            await cacheInvalidationService.InvalidateProductReadModelsAsync(supplierIds, cancellationToken);
            await cacheInvalidationService.InvalidateDashboardAsync(supplierIds, cancellationToken: cancellationToken);
        }

        return new InventoryMovementDto(movement.Id, movement.ItemType, movement.ItemId, affectedSupplierId, itemName, movement.Type, movement.Quantity, movement.UnitCost, movement.Notes, movement.OccurredAtUtc);
    }

    private async Task ApplyStockAsync(Product? product, decimal currentStock, ManualInventoryMovementRequest request, CancellationToken cancellationToken)
    {
        if (request.Type == InventoryMovementType.Exit && request.Quantity > currentStock)
        {
            throw new InvalidOperationException("Nao ha estoque suficiente para realizar a saida informada.");
        }

        if (product is null)
        {
            return;
        }

        var stockIncrease = request.Type is InventoryMovementType.Entry or InventoryMovementType.Adjustment ? request.Quantity : 0m;
        if (stockIncrease <= 0m || !product.GenerateProductionExpenseOnStockEntry)
        {
            return;
        }

        await financeRepository.AddAsync(new FinancialEntry
        {
            Type = FinancialEntryType.Expense,
            Classification = FinancialClassification.Variable,
            Category = "Custo de producao",
            Description = $"Entrada em estoque do produto {product.Name}",
            Amount = decimal.Round(product.CostPrice * stockIncrease, 2, MidpointRounding.AwayFromZero),
            OccurredOnUtc = DateTime.UtcNow,
            SupplierId = product.SupplierId,
            ReferenceId = product.Id
        }, cancellationToken);
    }

    private static decimal ComputeNewStock(decimal currentStock, ManualInventoryMovementRequest request)
        => request.Type is InventoryMovementType.Entry or InventoryMovementType.Adjustment
            ? currentStock + request.Quantity
            : Math.Max(0, currentStock - request.Quantity);

    public async Task<InventoryMovementDto> ReverseAsync(Guid movementId, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var original = await inventoryRepository.GetByIdAsync(movementId, cancellationToken)
            ?? throw new InvalidOperationException("Movimentacao nao encontrada.");

        if (original.Type == InventoryMovementType.Sale)
            throw new InvalidOperationException("Movimentacoes de venda nao podem ser estornadas aqui. Cancele a venda correspondente.");

        var reversalType = original.Type is InventoryMovementType.Entry or InventoryMovementType.Adjustment
            ? InventoryMovementType.Exit
            : InventoryMovementType.Entry;

        var originalTypeLabel = original.Type switch
        {
            InventoryMovementType.Entry => "entrada",
            InventoryMovementType.Exit => "saida",
            InventoryMovementType.Adjustment => "ajuste",
            _ => "movimentacao"
        };

        var reversalRequest = new ManualInventoryMovementRequest(
            original.ItemType,
            original.ItemId,
            reversalType,
            original.Quantity,
            original.UnitCost,
            $"Estorno de {originalTypeLabel} em {original.OccurredAtUtc:dd/MM/yyyy HH:mm}");

        var result = await RegisterAsync(reversalRequest, actor, scopedSupplierId, cancellationToken);

        if (original.ItemType == InventoryItemType.Product
            && original.Type is InventoryMovementType.Entry or InventoryMovementType.Adjustment)
        {
            var product = await productRepository.GetByIdAsync(original.ItemId, cancellationToken);
            if (product is not null)
            {
                await AdjustBottonSizeStockAsync(product, original.Quantity, actor, cancellationToken);
                await inventoryRepository.SaveChangesAsync(cancellationToken);
            }
        }

        return result;
    }

    public async Task DeleteAsync(Guid movementId, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var movement = await inventoryRepository.GetByIdAsync(movementId, cancellationToken)
            ?? throw new InvalidOperationException("Movimentacao nao encontrada.");

        if (movement.Type == InventoryMovementType.Sale)
            throw new InvalidOperationException("Movimentacoes de venda nao podem ser excluidas aqui. Cancele a venda correspondente.");

        if (movement.Type != InventoryMovementType.Entry)
            throw new InvalidOperationException("A exclusao direta e permitida somente para movimentacoes de entrada.");

        Guid? affectedSupplierId = null;
        if (movement.ItemType == InventoryItemType.Product)
        {
            var product = await productRepository.GetByIdAsync(movement.ItemId, cancellationToken)
                ?? throw new InvalidOperationException("Produto nao encontrado.");

            if (scopedSupplierId.HasValue && product.SupplierId != scopedSupplierId.Value)
            {
                throw new InvalidOperationException("Fornecedor so pode excluir movimentacoes dos proprios produtos.");
            }

            product.CurrentStock = ComputeStockAfterMovementRemoval(product.CurrentStock, movement);
            productRepository.Update(product);
            if (movement.Type is InventoryMovementType.Entry or InventoryMovementType.Adjustment)
            {
                await AdjustBottonSizeStockAsync(product, movement.Quantity, actor, cancellationToken);
            }
            affectedSupplierId = product.SupplierId;
        }
        else
        {
            if (scopedSupplierId.HasValue)
            {
                throw new InvalidOperationException("Fornecedor nao pode excluir movimentacoes de insumos.");
            }

            var supply = await supplyRepository.GetByIdAsync(movement.ItemId, cancellationToken)
                ?? throw new InvalidOperationException("Insumo nao encontrado.");
            supply.StockQuantity = ComputeStockAfterMovementRemoval(supply.StockQuantity, movement);
            supplyRepository.Update(supply);
        }

        inventoryRepository.Remove(movement);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(InventoryMovement),
            EntityId = movement.Id.ToString(),
            Action = AuditAction.Deleted,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new
            {
                movement.ItemType,
                movement.ItemId,
                movement.Type,
                movement.Quantity,
                Operation = "DeleteMovement"
            })
        }, cancellationToken);

        await inventoryRepository.SaveChangesAsync(cancellationToken);

        if (movement.ItemType == InventoryItemType.Product)
        {
            var supplierIds = affectedSupplierId.HasValue ? new[] { affectedSupplierId.Value } : [];
            await cacheInvalidationService.InvalidateProductReadModelsAsync(supplierIds, cancellationToken);
            await cacheInvalidationService.InvalidateDashboardAsync(supplierIds, cancellationToken: cancellationToken);
        }
    }

    private static decimal ComputeStockAfterMovementRemoval(decimal currentStock, InventoryMovement movement)
        => Math.Max(0m, currentStock - movement.Quantity);

    // Bottons consomem o estoque do tamanho selecionado a cada entrada em estoque do produto.
    // producedQuantityDelta > 0 devolve insumo (estorno/exclusao); < 0 consome.
    private async Task AdjustBottonSizeStockAsync(Product product, decimal producedQuantityDelta, string actor, CancellationToken cancellationToken)
    {
        if (product.ProductType != ProductType.Botton || !product.BottonSizeId.HasValue || producedQuantityDelta == 0m)
        {
            return;
        }

        var size = await bottonSizeRepository.GetByIdAsync(product.BottonSizeId.Value, cancellationToken);
        if (size is null)
        {
            return;
        }

        var perUnit = product.BottonSizeQuantity > 0m ? product.BottonSizeQuantity : 1m;
        var amount = Math.Abs(producedQuantityDelta) * perUnit;
        if (amount <= 0m)
        {
            return;
        }

        if (producedQuantityDelta > 0m)
        {
            size.IncreaseStock(amount);
        }
        else
        {
            size.DecreaseStock(amount);
        }

        bottonSizeRepository.Update(size);
        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(BottonSize),
            EntityId = size.Id.ToString(),
            Action = AuditAction.StockChanged,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new
            {
                ProductId = product.Id,
                ProductName = product.Name,
                Delta = producedQuantityDelta > 0m ? amount : -amount,
                RemainingStock = size.StockQuantity
            })
        }, cancellationToken);
    }
}
