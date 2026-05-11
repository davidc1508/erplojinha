using System.Text.Json;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.OperationalLists;
using Lojinha.Api.Domain.Services;
using Lojinha.Api.Contracts.Sales;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface ISalesService
{
    Task<IReadOnlyList<SaleDto>> GetRecentAsync(string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<SaleDto> CreateAsync(CreateSaleRequest request, string actor, Guid? scopedSupplierId = null, Guid? fairId = null, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
}

public sealed class SalesService(
    IAppCacheInvalidationService cacheInvalidationService,
    IProductRepository productRepository,
    IFairRepository fairRepository,
    ISaleRepository saleRepository,
    IInventoryRepository inventoryRepository,
    IRepository<Supplier> supplierRepository,
    IRepository<CardFeeSettings> cardFeeSettingsRepository,
    IRepository<FinancialEntry> financeRepository,
    IRepository<AuditLog> auditRepository,
    IOperationalListService operationalListService) : ISalesService
{
    public async Task<IReadOnlyList<SaleDto>> GetRecentAsync(string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var sales = (await saleRepository.GetRecentAsync(cancellationToken)).ToList();
        var authoredSaleIds = GetAuthoredSaleIds(actor, sales.Select(sale => sale.Id));

        if (scopedSupplierId.HasValue)
        {
            sales = sales
                .Where(sale => sale.Items.Any(item => item.SupplierId == scopedSupplierId.Value))
                .ToList();
        }

        return sales.Select(sale => Map(sale, !scopedSupplierId.HasValue || authoredSaleIds.Contains(sale.Id))).ToList();
    }

    public async Task<SaleDto> CreateAsync(CreateSaleRequest request, string actor, Guid? scopedSupplierId = null, Guid? fairId = null, CancellationToken cancellationToken = default)
    {
        var soldAtUtc = NormalizeUtc(request.SoldAtUtc ?? DateTime.UtcNow);
        Fair? fair = null;
        if (fairId.HasValue)
        {
            fair = await fairRepository.GetDetailedByIdAsync(fairId.Value, cancellationToken)
                ?? throw new InvalidOperationException("Feira não encontrada.");
            fair.EnsureOpen();
        }

        var productIds = request.Items.Select(x => x.ProductId).Distinct().ToHashSet();
        var supplierIds = request.Items.Where(x => x.SupplierId.HasValue).Select(x => x.SupplierId!.Value).Distinct().ToHashSet();
        var products = (await productRepository.GetAllDetailedAsync(cancellationToken))
            .Where(product => productIds.Contains(product.Id))
            .ToDictionary(product => product.Id);
        var suppliers = supplierRepository.Query()
            .Where(supplier => supplierIds.Contains(supplier.Id))
            .ToDictionary(supplier => supplier.Id);

        foreach (var item in request.Items)
        {
            if (!products.ContainsKey(item.ProductId))
            {
                throw new InvalidOperationException("Produto não encontrado para a venda.");
            }

            if (item.SupplierId.HasValue && !suppliers.ContainsKey(item.SupplierId.Value))
            {
                throw new InvalidOperationException("Fornecedor não encontrado para a venda.");
            }

            if (fair is not null && item.SupplierId.HasValue && fair.Suppliers.All(link => link.SupplierId != item.SupplierId.Value))
            {
                throw new InvalidOperationException("O fornecedor informado não está vinculado a esta feira.");
            }
        }

        var sale = new Sale
        {
            PaymentMethod = request.PaymentMethod,
            FairId = fair?.Id,
            Fair = fair,
            Notes = request.Notes?.Trim() ?? string.Empty,
            SoldAtUtc = soldAtUtc
        };

        foreach (var item in request.Items)
        {
            var product = products[item.ProductId];
            var selectedSupplierId = item.SupplierId ?? product.SupplierId;
            var selectedSupplier = selectedSupplierId.HasValue && suppliers.TryGetValue(selectedSupplierId.Value, out var supplier)
                ? supplier
                : product.Supplier;
            var unitPrice = item.UnitPrice ?? product.SalePrice;
            var lojinhaGainPercentage = selectedSupplierId.HasValue
                ? decimal.Round(Math.Clamp(item.LojinhaGainPercentage ?? 0m, 0m, 100m), 2)
                : 100m;
            var totalPrice = decimal.Round(item.Quantity * unitPrice, 2);
            var totalCost = decimal.Round(product.CostPrice * item.Quantity, 2);
            var baseProfit = totalPrice - totalCost;
            var lojinhaGainAmount = selectedSupplierId.HasValue
                ? decimal.Round(baseProfit * (lojinhaGainPercentage / 100m), 2)
                : baseProfit;

            sale.Items.Add(new SaleItem
            {
                ProductId = product.Id,
                Product = product,
                SupplierId = selectedSupplierId,
                Supplier = selectedSupplier,
                Quantity = item.Quantity,
                UnitPrice = unitPrice,
                CostPrice = product.CostPrice,
                TotalPrice = totalPrice,
                LojinhaGainPercentage = lojinhaGainPercentage,
                LojinhaGainAmount = lojinhaGainAmount
            });

            product.DecreaseStock(item.Quantity);
            productRepository.Update(product);

            await inventoryRepository.AddAsync(new InventoryMovement
            {
                ItemType = InventoryItemType.Product,
                ItemId = product.Id,
                Type = InventoryMovementType.Sale,
                Quantity = item.Quantity,
                UnitCost = product.CostPrice,
                Notes = $"Venda de {product.Name}",
                ReferenceId = sale.Id,
                OccurredAtUtc = sale.SoldAtUtc
            }, cancellationToken);
        }

        var cardFeeSettings = await GetCardFeeSettingsAsync(cancellationToken);
        CardFeeSettingsService.RecalculateSaleAmounts(sale, cardFeeSettings);

        await saleRepository.AddAsync(sale, cancellationToken);
        await financeRepository.AddAsync(new FinancialEntry
        {
            Type = FinancialEntryType.Income,
            Classification = FinancialClassification.Variable,
            Category = fair is null ? "Venda" : "Venda em feira",
            Description = fair is null ? $"Venda {sale.Id}" : $"Venda {sale.Id} na feira {fair.Name}",
            Amount = sale.NetReceivedAmount,
            OccurredOnUtc = sale.SoldAtUtc,
            ReferenceId = sale.Id
        }, cancellationToken);

        var productionExpenseAmount = decimal.Round(
            sale.Items
                .Where(item => item.Product is null || !item.Product.GenerateProductionExpenseOnStockEntry)
                .Sum(item => item.CostPrice * item.Quantity),
            2,
            MidpointRounding.AwayFromZero);

        if (productionExpenseAmount > 0)
        {
            await financeRepository.AddAsync(new FinancialEntry
            {
                Type = FinancialEntryType.Expense,
                Classification = FinancialClassification.Variable,
                Category = "Custo de producao na venda",
                Description = fair is null ? $"Custo de producao da venda {sale.Id}" : $"Custo de producao da venda {sale.Id} na feira {fair.Name}",
                Amount = productionExpenseAmount,
                OccurredOnUtc = sale.SoldAtUtc,
                ReferenceId = sale.Id
            }, cancellationToken);
        }

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Sale),
            EntityId = sale.Id.ToString(),
            Action = AuditAction.Sold,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { sale.PaymentMethod, Items = sale.Items.Count, sale.TotalAmount, sale.FeeAmount, sale.NetReceivedAmount })
        }, cancellationToken);

        if (request.CreateTodoForProducedItems)
        {
            var soldProducts = sale.Items
                .GroupBy(item => new { item.ProductId, item.SupplierId })
                .Select(group => new
                {
                    ProductName = group.First().Product?.Name ?? string.Empty,
                    SupplierId = group.Key.SupplierId,
                    Quantity = group.Sum(item => item.Quantity)
                })
                .ToList();

            foreach (var sold in soldProducts)
            {
                var itemName = sold.Quantity > 1
                    ? $"{sold.ProductName} (repor {decimal.Round(sold.Quantity, 2)} un)"
                    : sold.ProductName;
                var source = fair is null
                    ? $"Gerado automaticamente da venda {sale.Id}"
                    : $"Gerado automaticamente da venda {sale.Id} na feira {fair.Name}";

                await operationalListService.CreateTodoItemAsync(
                    new TodoItemRequest(itemName, OperationalItemPriority.Medium, source),
                    actor,
                    sold.SupplierId,
                    cancellationToken);
            }
        }

        await saleRepository.SaveChangesAsync(cancellationToken);
        var affectedSupplierIds = sale.Items.Where(item => item.SupplierId.HasValue).Select(item => item.SupplierId!.Value).Distinct().ToList();
        await cacheInvalidationService.InvalidateProductReadModelsAsync(affectedSupplierIds, cancellationToken);
        await cacheInvalidationService.InvalidateDashboardAsync(affectedSupplierIds, cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(fair?.Id, affectedSupplierIds, cancellationToken);
        return Map(sale, true);
    }

    public async Task<bool> DeleteAsync(Guid id, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var sale = await saleRepository.GetDetailedByIdAsync(id, cancellationToken);
        if (sale is null)
        {
            return false;
        }

        if (scopedSupplierId.HasValue && !CanDeleteSale(id, actor))
        {
            return false;
        }

        var productIds = sale.Items.Select(item => item.ProductId).Distinct().ToHashSet();
        var products = (await productRepository.GetAllDetailedAsync(cancellationToken))
            .Where(product => productIds.Contains(product.Id))
            .ToDictionary(product => product.Id);

        foreach (var item in sale.Items)
        {
            if (products.TryGetValue(item.ProductId, out var product))
            {
                product.CurrentStock += item.Quantity;
                productRepository.Update(product);
            }
        }

        var relatedMovements = inventoryRepository.Query()
            .Where(movement => movement.ReferenceId == sale.Id)
            .ToList();

        var relatedFinanceEntries = financeRepository.Query()
            .Where(entry => entry.ReferenceId == sale.Id)
            .ToList();

        var relatedAuditLogs = auditRepository.Query()
            .Where(log => log.EntityName == nameof(Sale) && log.EntityId == sale.Id.ToString())
            .ToList();

        var supplyRestocks = relatedMovements
            .Where(movement => movement.ItemType == InventoryItemType.Supply)
            .GroupBy(movement => movement.ItemId)
            .ToDictionary(group => group.Key, group => group.Sum(movement => movement.Quantity));

        foreach (var product in products.Values)
        {
            if (product.Recipe is null)
            {
                continue;
            }

            foreach (var recipeItem in product.Recipe.Items)
            {
                if (recipeItem.Supply is not null && supplyRestocks.TryGetValue(recipeItem.SupplyId, out var quantityToRestore))
                {
                    recipeItem.Supply.StockQuantity += quantityToRestore;
                }
            }
        }

        foreach (var movement in relatedMovements)
        {
            inventoryRepository.Remove(movement);
        }

        foreach (var entry in relatedFinanceEntries)
        {
            financeRepository.Remove(entry);
        }

        foreach (var auditLog in relatedAuditLogs)
        {
            auditRepository.Remove(auditLog);
        }

        var supplierIds = sale.Items.Where(item => item.SupplierId.HasValue).Select(item => item.SupplierId!.Value).Distinct().ToList();
        var fairId = sale.FairId;
        saleRepository.Remove(sale);
        await saleRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(supplierIds, cancellationToken);
        await cacheInvalidationService.InvalidateDashboardAsync(supplierIds, cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(fairId, supplierIds, cancellationToken);
        return true;
    }

    private SaleDto Map(Sale sale, bool canDelete)
        => new(
            sale.Id,
            sale.SoldAtUtc,
            sale.PaymentMethod,
            sale.Fair?.Name,
            sale.TotalAmount,
            sale.FeeAmount,
            sale.NetReceivedAmount,
            sale.CostAmount,
            sale.ProfitAmount,
            sale.Status,
            sale.Notes,
            sale.Items.Select(item => new SaleLineDto(
                item.Product?.Name ?? string.Empty,
                item.Quantity,
                item.UnitPrice,
                item.CostPrice,
                item.TotalPrice,
                item.SupplierId,
                item.Supplier?.Name ?? item.Product?.Supplier?.Name,
                item.LojinhaGainPercentage,
                item.LojinhaGainAmount)).ToList(),
            canDelete);

    private HashSet<Guid> GetAuthoredSaleIds(string actor, IEnumerable<Guid> saleIds)
    {
        var ids = saleIds.Select(id => id.ToString()).ToHashSet();
        if (ids.Count == 0)
        {
            return [];
        }

        return auditRepository.Query()
            .Where(log => log.EntityName == nameof(Sale)
                && log.Action == AuditAction.Sold
                && log.ChangedBy == actor
                && ids.Contains(log.EntityId))
            .Select(log => Guid.Parse(log.EntityId))
            .ToHashSet();
    }

    private bool CanDeleteSale(Guid saleId, string actor)
        => auditRepository.Query().Any(log => log.EntityName == nameof(Sale)
            && log.EntityId == saleId.ToString()
            && log.Action == AuditAction.Sold
            && log.ChangedBy == actor);

    private async Task<CardFeeSettings> GetCardFeeSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = cardFeeSettingsRepository.Query().FirstOrDefault();
        if (settings is not null)
        {
            return settings;
        }

        settings = CardFeeSettingsService.CreateDefaultSettings();
        await cardFeeSettingsRepository.AddAsync(settings, cancellationToken);
        await cardFeeSettingsRepository.SaveChangesAsync(cancellationToken);
        return settings;
    }

    private static DateTime NormalizeUtc(DateTime value)
        => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}