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
    Task<IReadOnlyList<SaleDto>> GetRecentAsync(string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default);
    Task<SaleDto?> GetByIdAsync(Guid id, string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default);
    Task<SaleDto> CreateAsync(CreateSaleRequest request, string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, Guid? fairId = null, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default);
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
    public async Task<IReadOnlyList<SaleDto>> GetRecentAsync(string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default)
    {
        var sales = (await saleRepository.GetRecentAsync(cancellationToken)).ToList();
        var cardFeeSettings = await GetCardFeeSettingsAsync(cancellationToken);

        foreach (var sale in sales)
        {
            // Keep legacy sales consistent with current commission and card-fee rules.
            CardFeeSettingsService.RecalculateSaleAmounts(sale, cardFeeSettings);
        }

        var authoredSaleIds = GetAuthoredSaleIds(actor, sales.Select(sale => sale.Id));

        if (!string.IsNullOrWhiteSpace(scopedResellerActor))
        {
            sales = sales
                .Where(sale => authoredSaleIds.Contains(sale.Id))
                .ToList();
        }

        if (scopedSupplierId.HasValue)
        {
            sales = sales
                .Where(sale => sale.Items.Any(item => item.SupplierId == scopedSupplierId.Value))
                .ToList();
        }

        var isResellerView = !string.IsNullOrWhiteSpace(scopedResellerActor);
        return sales
            .Select(sale => Map(
                sale,
                isResellerView ? authoredSaleIds.Contains(sale.Id) : true,
                isResellerView))
            .ToList();
    }

    public async Task<SaleDto?> GetByIdAsync(Guid id, string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default)
    {
        var sale = await saleRepository.GetDetailedByIdAsync(id, cancellationToken);
        if (sale is null)
        {
            return null;
        }

        var cardFeeSettings = await GetCardFeeSettingsAsync(cancellationToken);
        CardFeeSettingsService.RecalculateSaleAmounts(sale, cardFeeSettings);

        if (scopedSupplierId.HasValue && sale.Items.All(item => item.SupplierId != scopedSupplierId.Value))
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(scopedResellerActor) && !CanDeleteSale(id, scopedResellerActor))
        {
            return null;
        }

        var canDelete = string.IsNullOrWhiteSpace(scopedResellerActor)
            ? true
            : CanDeleteSale(id, scopedResellerActor);

        return Map(sale, canDelete, !string.IsNullOrWhiteSpace(scopedResellerActor));
    }

    public async Task<SaleDto> CreateAsync(CreateSaleRequest request, string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, Guid? fairId = null, CancellationToken cancellationToken = default)
    {
        var isReseller = !string.IsNullOrWhiteSpace(scopedResellerActor);
        var soldAtUtc = NormalizeUtc(request.SoldAtUtc ?? DateTime.UtcNow);
        Fair? fair = null;
        if (fairId.HasValue)
        {
            fair = await fairRepository.GetDetailedByIdAsync(fairId.Value, cancellationToken)
                ?? throw new InvalidOperationException("Feira não encontrada.");
            fair.EnsureOpen();
        }

        var productIds = request.Items.Select(x => x.ProductId).Distinct().ToHashSet();
        var supplierIds = request.Items
            .SelectMany(x => new[] { x.SupplierId, x.CommissionSellerSupplierId })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToHashSet();
        var products = (await productRepository.GetAllDetailedAsync(cancellationToken))
            .Where(product => productIds.Contains(product.Id))
            .ToDictionary(product => product.Id);
        var suppliers = isReseller
            ? new Dictionary<Guid, Supplier>()
            : supplierRepository.Query()
                .Where(supplier => supplierIds.Contains(supplier.Id))
                .ToDictionary(supplier => supplier.Id);

        foreach (var item in request.Items)
        {
            if (!products.ContainsKey(item.ProductId))
            {
                throw new InvalidOperationException("Produto não encontrado para a venda.");
            }

            if (!isReseller && item.SupplierId.HasValue && !suppliers.ContainsKey(item.SupplierId.Value))
            {
                throw new InvalidOperationException("Fornecedor não encontrado para a venda.");
            }

            if (!isReseller && item.CommissionSellerSupplierId.HasValue && !suppliers.ContainsKey(item.CommissionSellerSupplierId.Value))
            {
                throw new InvalidOperationException("Fornecedor vendedor não encontrado para a venda comissionada.");
            }

            if (isReseller && item.SupplierId.HasValue)
            {
                throw new InvalidOperationException("Venda de revendedor não aceita fornecedor no item.");
            }

            if (isReseller && item.IsCommissionedSale)
            {
                throw new InvalidOperationException("Venda de revendedor não aceita marcação de venda comissionada.");
            }

            if (!isReseller && fair is not null && item.SupplierId.HasValue && fair.Suppliers.All(link => link.SupplierId != item.SupplierId.Value))
            {
                throw new InvalidOperationException("O fornecedor informado não está vinculado a esta feira.");
            }

            if (!isReseller && fair is not null && item.CommissionSellerSupplierId.HasValue && fair.Suppliers.All(link => link.SupplierId != item.CommissionSellerSupplierId.Value))
            {
                throw new InvalidOperationException("O fornecedor vendedor informado não está vinculado a esta feira.");
            }

            if (item.IsCommissionedSale && !item.CommissionSellerSupplierId.HasValue)
            {
                throw new InvalidOperationException("Selecione o fornecedor vendedor para a venda comissionada.");
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
            var selectedSupplierId = isReseller ? null : item.SupplierId ?? product.SupplierId;
            var selectedSupplier = selectedSupplierId.HasValue && suppliers.TryGetValue(selectedSupplierId.Value, out var supplier)
                ? supplier
                : product.Supplier;
            var unitPrice = item.UnitPrice ?? (isReseller ? ResolveResellerUnitPrice(product) : product.SalePrice);
            var lojinhaGainPercentage = selectedSupplierId.HasValue
                ? decimal.Round(Math.Clamp(item.LojinhaGainPercentage ?? 0m, 0m, 100m), 2)
                : 100m;
            if (isReseller)
            {
                lojinhaGainPercentage = 100m;
            }
            var totalPrice = decimal.Round(item.Quantity * unitPrice, 2);
            var totalCost = decimal.Round(product.CostPrice * item.Quantity, 2);
            var baseProfit = totalPrice - totalCost;
            var lojinhaGainAmount = selectedSupplierId.HasValue
                ? decimal.Round(baseProfit * (lojinhaGainPercentage / 100m), 2)
                : baseProfit;
            var commissionSellerSupplier = item.CommissionSellerSupplierId.HasValue && suppliers.TryGetValue(item.CommissionSellerSupplierId.Value, out var commissionSeller)
                ? commissionSeller
                : null;
            var defaultCommissionAmountPerUnit = Math.Max(0m, unitPrice - product.SalePrice);
            var commissionAmountPerUnit = !isReseller && item.IsCommissionedSale
                ? decimal.Round(Math.Max(0m, item.CommissionAmount ?? defaultCommissionAmountPerUnit), 2, MidpointRounding.AwayFromZero)
                : 0m;
            var commissionAmount = decimal.Round(commissionAmountPerUnit * item.Quantity, 2, MidpointRounding.AwayFromZero);

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
                LojinhaGainAmount = lojinhaGainAmount,
                IsCommissionedSale = !isReseller && item.IsCommissionedSale,
                CommissionSellerSupplierId = !isReseller ? item.CommissionSellerSupplierId : null,
                CommissionSellerSupplier = commissionSellerSupplier,
                CommissionAmount = commissionAmount
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

        var commissionedPayoutsBySeller = sale.Items
            .Where(item => item.IsCommissionedSale && item.CommissionSellerSupplierId.HasValue)
            .GroupBy(item => item.CommissionSellerSupplierId!.Value)
            .Select(group => new
            {
                SupplierId = group.Key,
                Amount = decimal.Round(group.Sum(item => item.TotalPrice - item.CommissionAmount), 2, MidpointRounding.AwayFromZero)
            })
            .Where(item => item.Amount > 0m)
            .ToList();

        foreach (var payout in commissionedPayoutsBySeller)
        {
            await financeRepository.AddAsync(new FinancialEntry
            {
                Type = FinancialEntryType.Income,
                Classification = FinancialClassification.Variable,
                Category = fair is null ? "Venda comissionada" : "Venda comissionada em feira",
                Description = fair is null
                    ? $"Repasse liquido da venda {sale.Id}"
                    : $"Repasse liquido da venda {sale.Id} na feira {fair.Name}",
                Amount = payout.Amount,
                OccurredOnUtc = sale.SoldAtUtc,
                SupplierId = payout.SupplierId,
                ReferenceId = sale.Id
            }, cancellationToken);
        }

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Sale),
            EntityId = sale.Id.ToString(),
            Action = AuditAction.Sold,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new
            {
                sale.PaymentMethod,
                Items = sale.Items.Count,
                sale.TotalAmount,
                sale.FeeAmount,
                sale.NetReceivedAmount,
                CreateTodoForProducedItems = request.CreateTodoForProducedItems
            })
        }, cancellationToken);

        if (request.CreateTodoForProducedItems)
        {
            var soldProducts = sale.Items
                .GroupBy(item => new { item.ProductId, item.SupplierId })
                .Select(group => new
                {
                    ProductId = group.Key.ProductId,
                    SupplierId = group.Key.SupplierId,
                    Quantity = group.Sum(item => item.Quantity)
                })
                .ToList();

            foreach (var sold in soldProducts)
            {
                var source = fair is null
                    ? $"Gerado automaticamente da venda {sale.Id}"
                    : $"Gerado automaticamente da venda {sale.Id} na feira {fair.Name}";

                await operationalListService.CreateRestockItemAsync(
                    new RestockItemRequest(sold.ProductId, decimal.Round(sold.Quantity, 2), source),
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
        return Map(sale, true, isReseller);
    }

    public async Task<bool> DeleteAsync(Guid id, string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default)
    {
        var sale = await saleRepository.GetDetailedByIdAsync(id, cancellationToken);
        if (sale is null)
        {
            return false;
        }

        if (scopedSupplierId.HasValue && sale.Items.All(item => item.SupplierId != scopedSupplierId.Value))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(scopedResellerActor) && !CanDeleteSale(id, scopedResellerActor))
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

        if (ShouldReverseGeneratedRestockTargets(sale.Id, relatedAuditLogs))
        {
            var soldProducts = sale.Items
                .GroupBy(item => new { item.ProductId, item.SupplierId })
                .Select(group => new
                {
                    ProductId = group.Key.ProductId,
                    SupplierId = group.Key.SupplierId,
                    Quantity = group.Sum(item => item.Quantity)
                })
                .ToList();

            foreach (var sold in soldProducts)
            {
                await operationalListService.DecreaseRestockTargetAsync(
                    sold.ProductId,
                    decimal.Round(sold.Quantity, 2),
                    sold.SupplierId,
                    actor,
                    cancellationToken);
            }
        }

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

    private SaleDto Map(Sale sale, bool canDelete, bool isResellerView)
        => new(
            sale.Id,
            sale.SoldAtUtc,
            sale.PaymentMethod,
            sale.Fair?.Name,
            sale.TotalAmount,
            sale.FeeAmount,
            sale.NetReceivedAmount,
            isResellerView
                ? decimal.Round(sale.Items.Sum(item => item.CostPrice * item.Quantity), 2, MidpointRounding.AwayFromZero)
                : sale.CostAmount,
            isResellerView
                ? decimal.Round(sale.Items.Sum(item => item.TotalPrice - (item.CostPrice * item.Quantity)), 2, MidpointRounding.AwayFromZero)
                : sale.ProfitAmount,
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
                item.LojinhaGainAmount,
                item.IsCommissionedSale,
                item.CommissionSellerSupplierId,
                item.CommissionSellerSupplier?.Name,
                item.CommissionAmount)).ToList(),
            canDelete);

    private static decimal ResolveResellerUnitPrice(Product product)
    {
        var commissionPercentage = product.CommissionPercentage <= 0m ? 20m : product.CommissionPercentage;
        if (product.SalePrice <= 0m)
        {
            return 0m;
        }

        var rate = commissionPercentage / 100m;
        if (rate >= 1m)
        {
            return 0m;
        }

        return decimal.Round(product.SalePrice / (1m - rate), 2, MidpointRounding.AwayFromZero);
    }

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

    private static bool ShouldReverseGeneratedRestockTargets(Guid saleId, IReadOnlyCollection<AuditLog> relatedAuditLogs)
    {
        var soldAudit = relatedAuditLogs
            .OrderByDescending(log => log.CreatedAtUtc)
            .FirstOrDefault(log => log.Action == AuditAction.Sold);

        if (soldAudit is not null && !string.IsNullOrWhiteSpace(soldAudit.PayloadJson))
        {
            try
            {
                using var payload = JsonDocument.Parse(soldAudit.PayloadJson);
                if (payload.RootElement.TryGetProperty("CreateTodoForProducedItems", out var createTodoProperty)
                    && createTodoProperty.ValueKind is JsonValueKind.True or JsonValueKind.False)
                {
                    return createTodoProperty.GetBoolean();
                }
            }
            catch (JsonException)
            {
                // Keep backward compatibility with legacy audit payloads.
            }
        }

        return relatedAuditLogs.Any(log =>
            !string.IsNullOrWhiteSpace(log.PayloadJson)
            && log.PayloadJson.Contains(saleId.ToString(), StringComparison.OrdinalIgnoreCase)
            && log.PayloadJson.Contains("Gerado automaticamente da venda", StringComparison.OrdinalIgnoreCase));
    }

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