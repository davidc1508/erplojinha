using System.Text.Json;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IProductService
{
    Task<IReadOnlyList<ProductDto>> GetAllAsync(Guid? scopedSupplierId = null, bool includeAllForSupplier = false, bool? isBudget = null, CancellationToken cancellationToken = default);
    Task<ProductDto?> GetByIdAsync(Guid id, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<ProductDto> CreateAsync(ProductRequest request, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<ProductDto?> UpdateAsync(Guid id, ProductRequest request, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<PriceSuggestionDto?> GetPriceSuggestionAsync(Guid id, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProductPriceHistoryEntryDto>> GetPriceHistoryAsync(Guid id, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<PriceSuggestionDto> PreviewPriceSuggestionAsync(ProductRequest request, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<ProductMetadataDto> GetMetadataAsync(Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
    Task<int> RecalculateSuggestedPricesAsync(CancellationToken cancellationToken = default);
    Task<ProductDto?> ConvertBudgetToProductAsync(Guid id, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default);
}

public sealed class ProductService(
    IAppCache cache,
    IAppCacheInvalidationService cacheInvalidationService,
    IProductRepository productRepository,
    IProductRecipeRepository recipeRepository,
    IInventoryRepository inventoryRepository,
    IRepository<FinancialEntry> financeRepository,
    IRepository<ProductCategory> categoryRepository,
    IRepository<Supplier> supplierRepository,
    IRepository<PrinterProfile> printerRepository,
    IRepository<FilamentProfile> filamentRepository,
    IRepository<MarketplaceFee> marketplaceRepository,
    IRepository<Supply> supplyRepository,
    IRepository<BottonSize> bottonSizeRepository,
    IRepository<AuditLog> auditRepository,
    IRepository<ProductFilament> productFilamentRepository,
    IPricingService pricingService,
    IOperationalListService operationalListService) : IProductService
    {
    public async Task<IReadOnlyList<ProductDto>> GetAllAsync(Guid? scopedSupplierId = null, bool includeAllForSupplier = false, bool? isBudget = null, CancellationToken cancellationToken = default)
        => await cache.GetOrCreateAsync(
            AppCacheKeys.Products(scopedSupplierId, includeAllForSupplier) + $":budget:{(isBudget.HasValue ? (isBudget.Value ? "1" : "0") : "all")}",
            async token =>
            {
                var products = await productRepository.GetAllDetailedAsync(token);
                if (scopedSupplierId.HasValue && !includeAllForSupplier)
                {
                    products = products.Where(product => product.SupplierId == scopedSupplierId.Value).ToList();
                }

                if (isBudget.HasValue)
                {
                    products = products
                        .Where(product => (product.LifecycleStatus == ProductLifecycleStatus.Orcamento) == isBudget.Value)
                        .ToList();
                }

                return (IReadOnlyList<ProductDto>)products.Select(Map).ToList();
            },
            AppCacheDurations.ProductList,
            cancellationToken);

    public async Task<ProductDto?> GetByIdAsync(Guid id, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetDetailedByIdAsync(id, cancellationToken);
        return product is null || !IsProductVisible(product, scopedSupplierId) ? null : Map(product);
    }

    public async Task<ProductDto> CreateAsync(ProductRequest request, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        if (request.ProductType == ProductType.Impressao3D)
        {
            EnsurePrinterWhenFilaments(request.Filaments, request.PrinterProfileId);
        }

        var supplierId = scopedSupplierId ?? request.SupplierId;
        var category = await categoryRepository.GetByIdAsync(request.CategoryId, cancellationToken)
            ?? throw new InvalidOperationException("Categoria não encontrada para gerar o SKU do produto.");
        var product = new Product
        {
            NumericIdentifier = GetNextProductNumericIdentifier(),
            Name = NormalizeProductName(request.Name),
            Description = request.Description?.Trim() ?? string.Empty,
            CategoryId = request.CategoryId,
            SupplierId = supplierId,
            GenerateProductionExpenseOnStockEntry = request.GenerateProductionExpenseOnStockEntry,
            CurrentStock = request.CurrentStock,
            ItemsPerPlate = request.ItemsPerPlate,
            EstimatedPrintTimeMinutes = request.EstimatedPrintTimeMinutes,
            HeightCentimeters = request.HeightCentimeters,
            LengthMetersUsed = request.LengthMetersUsed,
            TariffPerKwh = request.TariffPerKwh,
            FinishingPercentage = NormalizeFinishingPercentage(request.FinishingPercentage),
            CommissionPercentage = NormalizeCommissionPercentage(request.CommissionPercentage),
                        LifecycleStatus = request.IsBudget ? ProductLifecycleStatus.Orcamento : ProductLifecycleStatus.Disponivel,
              EstimatedWeightGrams = request.Filaments.Count > 0 ? request.Filaments.Sum(f => f.WeightGrams) : 0m,
              DefaultMarketplaceFeeId = request.MarketplaceFeeId
        };

        ApplyProductTypeFields(product, request);
        var materialCostOverride = await ResolveMaterialCostOverrideAsync(request, cancellationToken);

        product.Sku = await ResolveSkuAsync(request.Sku, category.NumericIdentifier, product.NumericIdentifier, null, cancellationToken);

        var recipe = new ProductRecipe
        {
            Product = product,
            LaborHours = 1m,
            LaborCostPerHour = Math.Max(0m, request.LaborCost),
            AdditionalCosts = request.AdditionalCost,
            WholesaleMarkup = 2m,
            RetailMarkup = 2.7m,
            ResellerMarkup = request.DesiredMarkup
        };

        await ApplyPricingAsync(product, recipe, request.SalePrice, request.Filaments, materialCostOverride, cancellationToken);

        await productRepository.AddAsync(product, cancellationToken);
        await recipeRepository.AddAsync(recipe, cancellationToken);
        if (product.CurrentStock > 0)
        {
            await inventoryRepository.AddAsync(new InventoryMovement
            {
                ItemType = InventoryItemType.Product,
                ItemId = product.Id,
                Type = InventoryMovementType.Entry,
                Quantity = product.CurrentStock,
                UnitCost = product.CostPrice,
                Notes = "Estoque inicial do cadastro",
                OccurredAtUtc = DateTime.UtcNow
            }, cancellationToken);

            if (product.GenerateProductionExpenseOnStockEntry)
            {
                await AddProductionFinancialEntriesAsync(product, product.CurrentStock, cancellationToken);
            }
        }

        await auditRepository.AddAsync(CreateAudit(product, AuditAction.Created, actor), cancellationToken);
        await productRepository.SaveChangesAsync(cancellationToken);
        if (product.CurrentStock > 0)
        {
            await operationalListService.ConsumeRestockTargetAsync(product.Id, product.CurrentStock, product.SupplierId, actor, cancellationToken);
            await ConsumeBottonSizeStockAsync(product, product.CurrentStock, actor, cancellationToken);
        }
        await cacheInvalidationService.InvalidateProductReadModelsAsync(product.SupplierId.HasValue ? [product.SupplierId.Value] : [], cancellationToken);

        foreach (var item in request.Filaments)
        {
            await productFilamentRepository.AddAsync(new ProductFilament
            {
                ProductId = product.Id,
                FilamentProfileId = item.FilamentProfileId,
                WeightGrams = item.WeightGrams
            }, cancellationToken);
        }
        if (request.Filaments.Count > 0)
        {
            await productFilamentRepository.SaveChangesAsync(cancellationToken);
        }

        var loaded = await productRepository.GetDetailedByIdAsync(product.Id, cancellationToken) ?? product;
        return Map(loaded);
    }

    public async Task<ProductDto?> UpdateAsync(Guid id, ProductRequest request, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        if (request.ProductType == ProductType.Impressao3D)
        {
            EnsurePrinterWhenFilaments(request.Filaments, request.PrinterProfileId);
        }

        var product = await productRepository.GetDetailedByIdAsync(id, cancellationToken);
        if (product is null || !IsProductVisible(product, scopedSupplierId))
        {
            return null;
        }

        if (product.NumericIdentifier <= 0)
        {
            product.NumericIdentifier = GetNextProductNumericIdentifier();
        }

        var previousSupplierId = product.SupplierId;
        var previousStock = product.CurrentStock;

        var category = await categoryRepository.GetByIdAsync(request.CategoryId, cancellationToken)
            ?? throw new InvalidOperationException("Categoria não encontrada para gerar o SKU do produto.");

        var supplierId = scopedSupplierId ?? request.SupplierId;

        product.Name = NormalizeProductName(request.Name);
        product.Sku = await ResolveSkuAsync(request.Sku, category.NumericIdentifier, product.NumericIdentifier, product.Id, cancellationToken);
        product.Description = request.Description?.Trim() ?? string.Empty;
        product.CategoryId = request.CategoryId;
        product.SupplierId = supplierId;
        product.GenerateProductionExpenseOnStockEntry = request.GenerateProductionExpenseOnStockEntry;
        product.CurrentStock = request.CurrentStock;
        product.ItemsPerPlate = request.ItemsPerPlate;
        product.EstimatedPrintTimeMinutes = request.EstimatedPrintTimeMinutes;
        product.HeightCentimeters = request.HeightCentimeters;
        product.LengthMetersUsed = request.LengthMetersUsed;
        product.TariffPerKwh = request.TariffPerKwh;
        product.FinishingPercentage = NormalizeFinishingPercentage(request.FinishingPercentage);
        product.CommissionPercentage = NormalizeCommissionPercentage(request.CommissionPercentage);
        if (request.IsBudget)
        {
            product.LifecycleStatus = ProductLifecycleStatus.Orcamento;
        }
        else if (product.LifecycleStatus == ProductLifecycleStatus.Orcamento)
        {
            product.LifecycleStatus = ProductLifecycleStatus.Disponivel;
        }
            product.EstimatedWeightGrams = request.Filaments.Count > 0 ? request.Filaments.Sum(f => f.WeightGrams) : 0m;
            product.DefaultMarketplaceFeeId = request.MarketplaceFeeId;

        ApplyProductTypeFields(product, request);
        var materialCostOverride = await ResolveMaterialCostOverrideAsync(request, cancellationToken);

        var recipe = product.Recipe ?? new ProductRecipe
        {
            ProductId = product.Id,
            LaborHours = 1m,
            LaborCostPerHour = Math.Max(0m, request.LaborCost),
            WholesaleMarkup = 2m,
            RetailMarkup = 2.7m,
            ResellerMarkup = request.DesiredMarkup
        };
        recipe.AdditionalCosts = request.AdditionalCost;
        recipe.ResellerMarkup = request.DesiredMarkup;
        recipe.LaborHours = 1m;
        recipe.LaborCostPerHour = Math.Max(0m, request.LaborCost);

        await ApplyPricingAsync(product, recipe, request.SalePrice, request.Filaments, materialCostOverride, cancellationToken);

        productRepository.Update(product);
        if (recipe.Id == Guid.Empty)
        {
            await recipeRepository.AddAsync(recipe, cancellationToken);
        }
        else
        {
            recipeRepository.Update(recipe);
        }

        await auditRepository.AddAsync(CreateAudit(product, AuditAction.Updated, actor), cancellationToken);
        await productRepository.SaveChangesAsync(cancellationToken);
        var stockIncrease = product.CurrentStock - previousStock;
        if (stockIncrease > 0)
        {
            await operationalListService.ConsumeRestockTargetAsync(product.Id, stockIncrease, product.SupplierId, actor, cancellationToken);
            await ConsumeBottonSizeStockAsync(product, stockIncrease, actor, cancellationToken);
        }
            await ReplaceProductFilamentsAsync(product.Id, request.Filaments, cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(
            new[] { previousSupplierId, product.SupplierId }.Where(supplierId => supplierId.HasValue).Select(supplierId => supplierId!.Value),
            cancellationToken);
        return Map(product);
        }

        private async Task ReplaceProductFilamentsAsync(Guid productId, IReadOnlyList<FilamentItemRequest> filaments, CancellationToken cancellationToken)
        {
            var existing = productFilamentRepository.Query().Where(x => x.ProductId == productId).ToList();
            foreach (var item in existing)
                productFilamentRepository.Remove(item);
            if (existing.Count > 0)
                await productFilamentRepository.SaveChangesAsync(cancellationToken);

            foreach (var item in filaments)
            {
                await productFilamentRepository.AddAsync(new ProductFilament
                {
                    ProductId = productId,
                    FilamentProfileId = item.FilamentProfileId,
                    WeightGrams = item.WeightGrams
                }, cancellationToken);
            }
            if (filaments.Count > 0)
                await productFilamentRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> DeleteAsync(Guid id, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetDetailedByIdAsync(id, cancellationToken);
        if (product is null || !IsProductVisible(product, scopedSupplierId))
        {
            return false;
        }

        if (product.SaleItems.Count > 0)
        {
            throw new InvalidOperationException("Nao e possivel excluir um produto que ja possui vendas registradas.");
        }

        var supplierId = product.SupplierId;

        productRepository.Remove(product);
        await auditRepository.AddAsync(CreateAudit(product, AuditAction.Deleted, actor), cancellationToken);
        await productRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(supplierId.HasValue ? [supplierId.Value] : [], cancellationToken);
        return true;
    }

    public async Task<ProductDto?> ConvertBudgetToProductAsync(Guid id, string actor, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetDetailedByIdAsync(id, cancellationToken);
        if (product is null || !IsProductVisible(product, scopedSupplierId))
        {
            return null;
        }

        if (product.LifecycleStatus == ProductLifecycleStatus.Orcamento)
        {
            product.LifecycleStatus = ProductLifecycleStatus.Disponivel;
            productRepository.Update(product);
            await auditRepository.AddAsync(CreateAudit(product, AuditAction.Updated, actor), cancellationToken);
            await productRepository.SaveChangesAsync(cancellationToken);
            await cacheInvalidationService.InvalidateProductReadModelsAsync(product.SupplierId.HasValue ? [product.SupplierId.Value] : [], cancellationToken);
        }

        return Map(product);
    }

    public async Task<PriceSuggestionDto?> GetPriceSuggestionAsync(Guid id, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetDetailedByIdAsync(id, cancellationToken);
        if (product is null || !IsProductVisible(product, scopedSupplierId))
        {
            return null;
        }

        return Map(pricingService.Calculate(
            product,
            product.Recipe,
            product.PrinterProfile,
                product.Filaments
                    .Where(f => f.FilamentProfile is not null)
                    .Select(f => (f.FilamentProfile!, f.WeightGrams))
                    .ToList(),
            product.DefaultMarketplaceFee,
            ResolveMaterialCostOverrideFromProduct(product)));
    }

    public async Task<IReadOnlyList<ProductPriceHistoryEntryDto>> GetPriceHistoryAsync(Guid id, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetDetailedByIdAsync(id, cancellationToken);
        if (product is null || !IsProductVisible(product, scopedSupplierId))
        {
            return [];
        }

        var logs = auditRepository.Query()
            .Where(log => log.EntityName == nameof(Product)
                && log.EntityId == id.ToString()
                && (log.Action == AuditAction.Created || log.Action == AuditAction.Updated || log.Action == AuditAction.PriceChanged))
            .OrderByDescending(log => log.CreatedAtUtc)
            .ToList();

        return logs.Select(MapPriceHistory).ToList();
    }

    public async Task<PriceSuggestionDto> PreviewPriceSuggestionAsync(ProductRequest request, Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
    {
        if (request.ProductType == ProductType.Impressao3D)
        {
            EnsurePrinterWhenFilaments(request.Filaments, request.PrinterProfileId);
        }

        var product = new Product
        {
            Name = NormalizeProductName(request.Name),
            Sku = NormalizeSku(request.Sku),
            Description = request.Description?.Trim() ?? string.Empty,
            CategoryId = request.CategoryId,
            SupplierId = scopedSupplierId ?? request.SupplierId,
            GenerateProductionExpenseOnStockEntry = request.GenerateProductionExpenseOnStockEntry,
            CurrentStock = request.CurrentStock,
            ItemsPerPlate = request.ItemsPerPlate,
            EstimatedPrintTimeMinutes = request.EstimatedPrintTimeMinutes,
            HeightCentimeters = request.HeightCentimeters,
            LengthMetersUsed = request.LengthMetersUsed,
            TariffPerKwh = request.TariffPerKwh,
            FinishingPercentage = NormalizeFinishingPercentage(request.FinishingPercentage),
            CommissionPercentage = NormalizeCommissionPercentage(request.CommissionPercentage),
            PrinterProfileId = request.ProductType == ProductType.Impressao3D ? request.PrinterProfileId : null,
                EstimatedWeightGrams = request.Filaments.Count > 0 ? request.Filaments.Sum(f => f.WeightGrams) : 0m,
                DefaultMarketplaceFeeId = request.MarketplaceFeeId,
                ProductType = request.ProductType,
                PingenteCost = request.ProductType == ProductType.Brinco ? Math.Max(0m, request.PingenteCost) : 0m,
                BottonSizeQuantity = request.BottonSizeQuantity > 0m ? request.BottonSizeQuantity : 1m
        };

            var materialCostOverride = await ResolveMaterialCostOverrideAsync(request, cancellationToken);

            // Load FilamentProfile nav for each filament in preview request
            foreach (var item in request.Filaments)
            {
                var profile = await filamentRepository.GetByIdAsync(item.FilamentProfileId, cancellationToken);
                if (profile is not null)
                {
                    product.Filaments.Add(new ProductFilament
                    {
                        FilamentProfile = profile,
                        WeightGrams = item.WeightGrams
                    });
                }
            }

        var recipe = new ProductRecipe
        {
            Product = product,
            LaborHours = 1m,
            LaborCostPerHour = Math.Max(0m, request.LaborCost),
            AdditionalCosts = request.AdditionalCost,
            WholesaleMarkup = 2m,
            RetailMarkup = 2.7m,
            ResellerMarkup = request.DesiredMarkup
        };

        return Map(await BuildPricingAsync(product, recipe, request.Filaments, materialCostOverride, cancellationToken));
    }

    public async Task<ProductMetadataDto> GetMetadataAsync(Guid? scopedSupplierId = null, CancellationToken cancellationToken = default)
        => await cache.GetOrCreateAsync(
            AppCacheKeys.ProductMetadata(scopedSupplierId),
            token => Task.FromResult(new ProductMetadataDto(
                categoryRepository.Query().OrderBy(x => x.Name).Select(x => new CatalogItemDto(x.Id, x.Name)).ToList(),
                supplierRepository.Query().OrderBy(x => x.Name).Select(x => new CatalogItemDto(x.Id, x.Name)).ToList(),
                printerRepository.Query().OrderBy(x => x.Name).Select(x => new CatalogItemDto(x.Id, x.Name)).ToList(),
                filamentRepository.Query().OrderBy(x => x.Name).Select(x => new CatalogItemDto(x.Id, x.Name)).ToList(),
                marketplaceRepository.Query().OrderBy(x => x.Name).Select(x => new CatalogItemDto(x.Id, x.Name)).ToList(),
                supplyRepository.Query().OrderBy(x => x.Name).Select(x => new CatalogItemDto(x.Id, x.Name)).ToList(),
                bottonSizeRepository.Query().OrderBy(x => x.Name).Select(x => new CatalogItemDto(x.Id, x.Name)).ToList())),
            AppCacheDurations.ProductMetadata,
            cancellationToken);

    public async Task<int> RecalculateSuggestedPricesAsync(CancellationToken cancellationToken = default)
    {
        var products = await productRepository.GetAllDetailedAsync(cancellationToken);

        foreach (var product in products)
        {
            var recipe = product.Recipe ?? new ProductRecipe
            {
                ProductId = product.Id,
                LaborHours = 1m,
                LaborCostPerHour = 0.5m,
                AdditionalCosts = product.Recipe?.AdditionalCosts ?? 0m,
                WholesaleMarkup = 2m,
                RetailMarkup = 2.7m,
                ResellerMarkup = 2.7m
            };

            var pricing = await BuildPricingAsync(product, recipe, null, ResolveMaterialCostOverrideFromProduct(product), cancellationToken);
            product.CostPrice = pricing.TotalCost;
            product.SuggestedPrice = pricing.SuggestedPrice;
            product.ProfitMargin = product.SalePrice <= 0m
                ? 0m
                : decimal.Round((product.SalePrice - product.CostPrice) / product.SalePrice, 4);
            product.CommissionedSalePrice = CalculateCommissionedSalePrice(product.SalePrice, product.CommissionPercentage);
            productRepository.Update(product);
        }

        await productRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(
            products.Where(product => product.SupplierId.HasValue).Select(product => product.SupplierId!.Value).Distinct(),
            cancellationToken);
        return products.Count;
    }

    private async Task ApplyPricingAsync(Product product, ProductRecipe recipe, decimal? manualSale, IReadOnlyList<FilamentItemRequest>? requestFilaments, decimal? materialCostOverride, CancellationToken cancellationToken)
    {
        // Pricing in ProductForm must be based on the same inputs shown in preview.
        // Ignore recipe supply items here so material cost comes from selected filaments.
        var pricingRecipe = new ProductRecipe
        {
            LaborHours = recipe.LaborHours,
            LaborCostPerHour = recipe.LaborCostPerHour,
            AdditionalCosts = recipe.AdditionalCosts,
            WholesaleMarkup = recipe.WholesaleMarkup,
            RetailMarkup = recipe.RetailMarkup,
            ResellerMarkup = recipe.ResellerMarkup
        };

        var pricing = await BuildPricingAsync(product, pricingRecipe, requestFilaments, materialCostOverride, cancellationToken);
        product.CostPrice = pricing.TotalCost;
        product.SuggestedPrice = pricing.SuggestedPrice;
        var minimumSalePrice = decimal.Round(product.CostPrice * 2m, 2);
        product.SalePrice = manualSale ?? pricing.SuggestedPrice;
        if (product.SalePrice < minimumSalePrice)
        {
            throw new InvalidOperationException("O preco final nao pode ser menor do que o dobro do custo do produto.");
        }

        product.CommissionedSalePrice = CalculateCommissionedSalePrice(product.SalePrice, product.CommissionPercentage);

        product.ProfitMargin = product.SalePrice <= 0m ? 0m : decimal.Round((product.SalePrice - product.CostPrice) / product.SalePrice, 4);
        recipe.TotalCost = pricing.CompositionCost;
    }

    private async Task<PricingSnapshot> BuildPricingAsync(Product product, ProductRecipe recipe, IReadOnlyList<FilamentItemRequest>? requestFilaments, decimal? materialCostOverride, CancellationToken cancellationToken)
    {
        var printer = product.PrinterProfileId.HasValue
            ? await printerRepository.GetByIdAsync(product.PrinterProfileId.Value, cancellationToken)
            : null;
        var marketplace = product.DefaultMarketplaceFeeId.HasValue
            ? await marketplaceRepository.GetByIdAsync(product.DefaultMarketplaceFeeId.Value, cancellationToken)
            : null;

        var filaments = materialCostOverride.HasValue
            ? Array.Empty<(FilamentProfile filament, decimal weightGrams)>()
            : await ResolveFilamentsForPricingAsync(product, requestFilaments, cancellationToken);
        return pricingService.Calculate(product, recipe, printer, filaments, marketplace, materialCostOverride);
    }

    private async Task<IReadOnlyList<(FilamentProfile filament, decimal weightGrams)>> ResolveFilamentsForPricingAsync(
        Product product,
        IReadOnlyList<FilamentItemRequest>? requestFilaments,
        CancellationToken cancellationToken)
    {
        var requested = requestFilaments?
            .Where(item => item.FilamentProfileId != Guid.Empty && item.WeightGrams > 0m)
            .ToList();

        if (requested is { Count: > 0 })
        {
            var profileIds = requested.Select(item => item.FilamentProfileId).Distinct().ToList();
            var profilesById = filamentRepository.Query()
                .Where(profile => profileIds.Contains(profile.Id))
                .ToDictionary(profile => profile.Id);

            return requested
                .Where(item => profilesById.ContainsKey(item.FilamentProfileId))
                .Select(item => (profilesById[item.FilamentProfileId], item.WeightGrams))
                .ToList();
        }

        return product.Filaments
            .Where(f => f.FilamentProfile is not null && f.WeightGrams > 0m)
            .Select(f => (f.FilamentProfile!, f.WeightGrams))
            .ToList();
    }

    private async Task AddProductionFinancialEntriesAsync(Product product, decimal quantity, CancellationToken cancellationToken)
    {
        var isOutsourced = product.OutsourcedProductionId.HasValue && product.ProducerSupplierId.HasValue && product.ProductionFeeAmount > 0m;
        var expenseAmount = decimal.Round(
            isOutsourced ? product.ProductionFeeAmount * quantity : product.CostPrice * quantity,
            2, MidpointRounding.AwayFromZero);

        await financeRepository.AddAsync(new FinancialEntry
        {
            Type = FinancialEntryType.Expense,
            Classification = FinancialClassification.Variable,
            Category = isOutsourced ? "Custo de producao terceirizada" : "Custo de producao",
            Description = $"Entrada em estoque do produto {product.Name}",
            Amount = expenseAmount,
            OccurredOnUtc = DateTime.UtcNow,
            SupplierId = product.SupplierId,
            ReferenceId = product.Id
        }, cancellationToken);

        if (isOutsourced)
        {
            await financeRepository.AddAsync(new FinancialEntry
            {
                Type = FinancialEntryType.Income,
                Classification = FinancialClassification.Variable,
                Category = "Producao terceirizada",
                Description = $"Repasse de producao do produto {product.Name}",
                Amount = expenseAmount,
                OccurredOnUtc = DateTime.UtcNow,
                SupplierId = product.ProducerSupplierId,
                ReferenceId = product.Id
            }, cancellationToken);
        }
    }

    private static void ApplyProductTypeFields(Product product, ProductRequest request)
    {
        product.ProductType = request.ProductType;

        switch (request.ProductType)
        {
            case ProductType.Brinco:
                product.PingenteSupplyId = request.PingenteSupplyId;
                product.PingenteCost = Math.Max(0m, request.PingenteCost);
                product.BottonSizeId = null;
                product.BottonSizeQuantity = 1m;
                product.PrinterProfileId = null;
                product.EstimatedPrintTimeMinutes = 0m;
                product.EstimatedWeightGrams = 0m;
                break;
            case ProductType.Botton:
                product.BottonSizeId = request.BottonSizeId;
                product.BottonSizeQuantity = request.BottonSizeQuantity > 0m ? request.BottonSizeQuantity : 1m;
                product.PingenteSupplyId = null;
                product.PingenteCost = 0m;
                product.PrinterProfileId = null;
                product.EstimatedPrintTimeMinutes = 0m;
                product.EstimatedWeightGrams = 0m;
                break;
            default:
                product.PrinterProfileId = request.PrinterProfileId;
                product.PingenteSupplyId = null;
                product.PingenteCost = 0m;
                product.BottonSizeId = null;
                product.BottonSizeQuantity = 1m;
                break;
        }
    }

    private async Task<decimal?> ResolveMaterialCostOverrideAsync(ProductRequest request, CancellationToken cancellationToken)
        => request.ProductType switch
        {
            ProductType.Brinco => Math.Max(0m, request.PingenteCost),
            ProductType.Botton => await ResolveBottonMaterialCostAsync(request.BottonSizeId, request.BottonSizeQuantity, cancellationToken),
            _ => null
        };

    private async Task<decimal> ResolveBottonMaterialCostAsync(Guid? bottonSizeId, decimal quantity, CancellationToken cancellationToken)
    {
        if (!bottonSizeId.HasValue)
        {
            return 0m;
        }

        var size = await bottonSizeRepository.GetByIdAsync(bottonSizeId.Value, cancellationToken);
        return size is null ? 0m : Math.Max(0m, size.CostPerUnit * Math.Max(0m, quantity));
    }

    private static decimal? ResolveMaterialCostOverrideFromProduct(Product product)
        => product.ProductType switch
        {
            ProductType.Brinco => Math.Max(0m, product.PingenteCost),
            ProductType.Botton => Math.Max(0m, (product.BottonSize?.CostPerUnit ?? 0m) * Math.Max(0m, product.BottonSizeQuantity)),
            _ => null
        };

    private async Task ConsumeBottonSizeStockAsync(Product product, decimal producedQuantity, string actor, CancellationToken cancellationToken)
    {
        if (product.ProductType != ProductType.Botton || !product.BottonSizeId.HasValue || producedQuantity <= 0m)
        {
            return;
        }

        var size = await bottonSizeRepository.GetByIdAsync(product.BottonSizeId.Value, cancellationToken);
        if (size is null)
        {
            return;
        }

        var consumed = Math.Max(0m, producedQuantity) * (product.BottonSizeQuantity > 0m ? product.BottonSizeQuantity : 1m);
        if (consumed <= 0m)
        {
            return;
        }

        size.DecreaseStock(consumed);
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
                Consumed = consumed,
                RemainingStock = size.StockQuantity
            })
        }, cancellationToken);
        await bottonSizeRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateCatalogAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
    }

    private static void EnsurePrinterWhenFilaments(IReadOnlyList<FilamentItemRequest> filaments, Guid? printerProfileId)
    {
        var hasFilaments = filaments.Any(item => item.FilamentProfileId != Guid.Empty && item.WeightGrams > 0m);
        if (hasFilaments && !printerProfileId.HasValue)
        {
            throw new InvalidOperationException("Selecione uma impressora quando houver filamentos para manter o calculo de custo consistente.");
        }
    }

    private static ProductDto Map(Product product)
        => new(
            product.Id,
            product.Name,
            product.Sku ?? string.Empty,
            product.Description,
            product.CategoryId,
            product.Category?.Name ?? string.Empty,
            product.SupplierId,
            product.Supplier?.Name,
            product.GenerateProductionExpenseOnStockEntry,
            product.CostPrice,
            product.SalePrice,
            product.SuggestedPrice,
            product.Recipe?.ResellerMarkup ?? 2.7m,
            product.ProfitMargin,
            product.CurrentStock,
            product.ItemsPerPlate,
            product.EstimatedPrintTimeMinutes,
            product.HeightCentimeters,
            product.EstimatedWeightGrams,
            product.LengthMetersUsed,
            product.TariffPerKwh,
            DenormalizeFinishingPercentage(product.FinishingPercentage),
            DenormalizeCommissionPercentage(product.CommissionPercentage),
            product.CommissionedSalePrice,
            product.Recipe?.AdditionalCosts ?? 0m,
            product.PrinterProfileId,
            product.Filaments
                .Select(f => new ProductFilamentDto(f.FilamentProfileId, f.FilamentProfile?.Name ?? string.Empty, f.WeightGrams))
                .ToList(),
            product.PrinterProfile?.Name,
            product.DefaultMarketplaceFee?.Name,
            product.DefaultMarketplaceFeeId,
            product.LifecycleStatus,
            product.OutsourcedProductionId,
            product.ProducerSupplierId,
            product.ProducerSupplier?.Name,
            product.ProductionFeeAmount,
            product.ProductType,
            product.PingenteSupplyId,
            product.PingenteSupply?.Name,
            product.PingenteCost,
            product.BottonSizeId,
            product.BottonSize?.Name,
            product.BottonSizeQuantity,
            product.BottonSize?.StockQuantity ?? 0m,
            product.BottonSize?.CostPerUnit ?? 0m,
            product.Recipe is null ? 0.5m : decimal.Round(product.Recipe.LaborHours * product.Recipe.LaborCostPerHour, 2));

    private static PriceSuggestionDto Map(PricingSnapshot pricing)
        => new(
            pricing.CompositionCost,
            pricing.TotalCost,
            pricing.MaterialCost,
            pricing.EnergyCost,
            pricing.MaintenanceCost,
            pricing.FailureCost,
            pricing.FinishingCost,
            pricing.LaborCost,
            pricing.AdditionalCosts,
            pricing.WholesalePrice,
            pricing.RetailPrice,
            pricing.ResellerPrice,
            pricing.DesiredMarkup,
            pricing.SuggestedPrice,
            pricing.CommissionPercentage,
            pricing.CommissionAmount,
            pricing.SuggestedPriceWithCommission,
            pricing.FinalPriceWithoutCommission,
            pricing.FinalPriceWithCommission,
            pricing.MarketplaceAdjustedPrice,
            pricing.EstimatedMargin);

    private static ProductPriceHistoryEntryDto MapPriceHistory(AuditLog log)
    {
        decimal? costPrice = null;
        decimal? salePrice = null;
        decimal? currentStock = null;

        if (!string.IsNullOrWhiteSpace(log.PayloadJson))
        {
            using var document = JsonDocument.Parse(log.PayloadJson);
            var root = document.RootElement;
            costPrice = TryGetDecimal(root, "CostPrice");
            salePrice = TryGetDecimal(root, "SalePrice");
            currentStock = TryGetDecimal(root, "CurrentStock");
        }

        return new ProductPriceHistoryEntryDto(
            log.CreatedAtUtc,
            log.ChangedBy,
            log.Action.ToString(),
            costPrice,
            salePrice,
            currentStock);
    }

    private static decimal? TryGetDecimal(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetDecimal(out var number))
        {
            return number;
        }

        return null;
    }

    private static AuditLog CreateAudit(Product product, AuditAction action, string actor)
        => new()
        {
            EntityName = nameof(Product),
            EntityId = product.Id.ToString(),
            Action = action,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { product.Name, product.Sku, product.CostPrice, product.SalePrice, product.CurrentStock })
        };

    private static string? NormalizeSku(string? value)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static string NormalizeProductName(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(normalized))
        {
            return normalized;
        }

        return char.ToUpperInvariant(normalized[0]) + normalized[1..];
    }

    private int GetNextProductNumericIdentifier()
        => (productRepository.Query().Select(x => (int?)x.NumericIdentifier).Max() ?? 0) + 1;

    private async Task<string> ResolveSkuAsync(string? requestedSku, int categoryNumericIdentifier, int productNumericIdentifier, Guid? currentProductId, CancellationToken cancellationToken)
    {
        var normalizedSku = NormalizeSku(requestedSku);
        var resolvedSku = normalizedSku ?? BuildGeneratedSku(categoryNumericIdentifier, productNumericIdentifier);
        await EnsureSkuIsUniqueAsync(resolvedSku, currentProductId, cancellationToken);
        return resolvedSku;
    }

    private async Task EnsureSkuIsUniqueAsync(string sku, Guid? currentProductId, CancellationToken cancellationToken)
    {
        var existing = await productRepository.GetBySkuAsync(sku, cancellationToken);
        if (existing is not null && existing.Id != currentProductId)
        {
            throw new InvalidOperationException("Já existe um produto cadastrado com este SKU.");
        }
    }

    private static string BuildGeneratedSku(int categoryNumericIdentifier, int productNumericIdentifier)
        => $"{categoryNumericIdentifier:D5}-{productNumericIdentifier:D8}";

    private static decimal NormalizeFinishingPercentage(decimal value)
        => value > 1m ? decimal.Round(value / 100m, 4, MidpointRounding.AwayFromZero) : value;

    private static decimal DenormalizeFinishingPercentage(decimal value)
        => decimal.Round(value * 100m, 2, MidpointRounding.AwayFromZero);

    private static decimal NormalizeCommissionPercentage(decimal value)
        => decimal.Round(Math.Clamp(value, 0m, 99.99m), 2, MidpointRounding.AwayFromZero);

    private static decimal DenormalizeCommissionPercentage(decimal value)
        => decimal.Round(Math.Clamp(value, 0m, 99.99m), 2, MidpointRounding.AwayFromZero);

    private static decimal CalculateCommissionedSalePrice(decimal finalPrice, decimal commissionPercentage)
    {
        if (finalPrice <= 0m)
        {
            return 0m;
        }

        var rate = commissionPercentage <= 0m ? 0m : commissionPercentage / 100m;
        if (rate <= 0m)
        {
            return decimal.Round(finalPrice, 2, MidpointRounding.AwayFromZero);
        }

        if (rate >= 1m)
        {
            return 0m;
        }

        return decimal.Round(finalPrice / (1m - rate), 2, MidpointRounding.AwayFromZero);
    }

    private static bool IsProductVisible(Product product, Guid? scopedSupplierId)
        => !scopedSupplierId.HasValue || product.SupplierId == scopedSupplierId.Value;
}