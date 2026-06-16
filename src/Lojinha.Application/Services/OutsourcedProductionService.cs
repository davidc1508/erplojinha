using System.Text.Json;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.OutsourcedProduction;
using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IOutsourcedProductionService
{
    Task<IReadOnlyList<OutsourcedProductionDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<OutsourcedProductionDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<OutsourcedProductionDto> CreateAsync(OutsourcedProductionRequest request, string actor, CancellationToken cancellationToken = default);
    Task<OutsourcedProductionDto?> UpdateAsync(Guid id, OutsourcedProductionRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default);
    Task<ProductDto?> ConvertToProductAsync(Guid id, ConvertToProductRequest request, string actor, CancellationToken cancellationToken = default);
    Task<PriceSuggestionDto> PreviewPricingAsync(OutsourcedProductionRequest request, CancellationToken cancellationToken = default);
}

public sealed class OutsourcedProductionService(
    IOutsourcedProductionRepository repository,
    IRepository<OutsourcedProductionRecipe> recipeRepository,
    IRepository<OutsourcedProductionFilament> outsourcedFilamentRepository,
    IProductRepository productRepository,
    IProductRecipeRepository productRecipeRepository,
    IRepository<ProductFilament> productFilamentRepository,
    IRepository<Supplier> supplierRepository,
    IRepository<ProductCategory> categoryRepository,
    IRepository<PrinterProfile> printerRepository,
    IRepository<FilamentProfile> filamentProfileRepository,
    IRepository<MarketplaceFee> marketplaceRepository,
    IRepository<AuditLog> auditRepository,
    IAppCacheInvalidationService cacheInvalidationService,
    IPricingService pricingService) : IOutsourcedProductionService
{
    public async Task<IReadOnlyList<OutsourcedProductionDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var productions = await repository.GetAllDetailedAsync(cancellationToken);
        return productions.Select(Map).ToList();
    }

    public async Task<OutsourcedProductionDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var production = await repository.GetDetailedByIdAsync(id, cancellationToken);
        return production is null ? null : Map(production);
    }

    public async Task<OutsourcedProductionDto> CreateAsync(OutsourcedProductionRequest request, string actor, CancellationToken cancellationToken = default)
    {
        await ValidateSuppliersAsync(request.ProducerSupplierId, request.OwnerSupplierId, cancellationToken);

        var production = new OutsourcedProduction
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            CategoryId = request.CategoryId,
            ProducerSupplierId = request.ProducerSupplierId,
            OwnerSupplierId = request.OwnerSupplierId,
            ItemsPerPlate = Math.Max(1, request.ItemsPerPlate),
            EstimatedPrintTimeMinutes = request.EstimatedPrintTimeMinutes,
            HeightCentimeters = request.HeightCentimeters,
            LengthMetersUsed = request.LengthMetersUsed,
            TariffPerKwh = request.TariffPerKwh,
            FinishingPercentage = NormalizePercentage(request.FinishingPercentage),
            PrinterProfileId = request.PrinterProfileId,
            DefaultMarketplaceFeeId = request.MarketplaceFeeId,
            ProductionFeePercentage = Math.Max(0m, request.ProductionFeePercentage),
            EstimatedWeightGrams = request.Filaments.Count > 0 ? request.Filaments.Sum(f => f.WeightGrams) : 0m
        };

        var recipe = new OutsourcedProductionRecipe
        {
            OutsourcedProduction = production,
            LaborHours = 1m,
            LaborCostPerHour = 0.5m,
            AdditionalCosts = request.AdditionalCost,
            WholesaleMarkup = 2m,
            RetailMarkup = 2.7m,
            ResellerMarkup = request.DesiredMarkup
        };

        await ApplyCostAsync(production, recipe, request.Filaments, cancellationToken);

        await repository.AddAsync(production, cancellationToken);
        await recipeRepository.AddAsync(recipe, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        await SaveFilamentsAsync(production.Id, request.Filaments, cancellationToken);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(OutsourcedProduction),
            EntityId = production.Id.ToString(),
            Action = AuditAction.Created,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { production.Name, production.ProducerSupplierId, production.OwnerSupplierId })
        }, cancellationToken);
        await auditRepository.SaveChangesAsync(cancellationToken);

        var loaded = await repository.GetDetailedByIdAsync(production.Id, cancellationToken) ?? production;
        return Map(loaded);
    }

    public async Task<OutsourcedProductionDto?> UpdateAsync(Guid id, OutsourcedProductionRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var production = await repository.GetDetailedByIdAsync(id, cancellationToken);
        if (production is null || production.Status == OutsourcedProductionStatus.ConvertidoEmProduto)
        {
            return null;
        }

        await ValidateSuppliersAsync(request.ProducerSupplierId, request.OwnerSupplierId, cancellationToken);

        production.Name = request.Name.Trim();
        production.Description = request.Description?.Trim() ?? string.Empty;
        production.CategoryId = request.CategoryId;
        production.ProducerSupplierId = request.ProducerSupplierId;
        production.OwnerSupplierId = request.OwnerSupplierId;
        production.ItemsPerPlate = Math.Max(1, request.ItemsPerPlate);
        production.EstimatedPrintTimeMinutes = request.EstimatedPrintTimeMinutes;
        production.HeightCentimeters = request.HeightCentimeters;
        production.LengthMetersUsed = request.LengthMetersUsed;
        production.TariffPerKwh = request.TariffPerKwh;
        production.FinishingPercentage = NormalizePercentage(request.FinishingPercentage);
        production.PrinterProfileId = request.PrinterProfileId;
        production.DefaultMarketplaceFeeId = request.MarketplaceFeeId;
        production.ProductionFeePercentage = Math.Max(0m, request.ProductionFeePercentage);
        production.EstimatedWeightGrams = request.Filaments.Count > 0 ? request.Filaments.Sum(f => f.WeightGrams) : 0m;

        var recipe = production.Recipe ?? new OutsourcedProductionRecipe
        {
            OutsourcedProductionId = production.Id,
            LaborHours = 1m,
            LaborCostPerHour = 0.5m,
            WholesaleMarkup = 2m,
            RetailMarkup = 2.7m,
            ResellerMarkup = request.DesiredMarkup
        };
        recipe.AdditionalCosts = request.AdditionalCost;
        recipe.ResellerMarkup = request.DesiredMarkup;

        await ApplyCostAsync(production, recipe, request.Filaments, cancellationToken);

        repository.Update(production);
        if (recipe.Id == Guid.Empty)
        {
            await recipeRepository.AddAsync(recipe, cancellationToken);
        }
        else
        {
            recipeRepository.Update(recipe);
        }

        await repository.SaveChangesAsync(cancellationToken);
        await ReplaceFilamentsAsync(production.Id, request.Filaments, cancellationToken);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(OutsourcedProduction),
            EntityId = production.Id.ToString(),
            Action = AuditAction.Updated,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { production.Name, production.ProductionCost, production.SupplierCost })
        }, cancellationToken);
        await auditRepository.SaveChangesAsync(cancellationToken);

        return Map(production);
    }

    public async Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var production = await repository.GetDetailedByIdAsync(id, cancellationToken);
        if (production is null)
        {
            return false;
        }

        if (production.Status == OutsourcedProductionStatus.ConvertidoEmProduto)
        {
            throw new InvalidOperationException("Não é possível excluir uma produção que já foi convertida em produto.");
        }

        repository.Remove(production);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(OutsourcedProduction),
            EntityId = production.Id.ToString(),
            Action = AuditAction.Deleted,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { production.Name })
        }, cancellationToken);

        await repository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ProductDto?> ConvertToProductAsync(Guid id, ConvertToProductRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var production = await repository.GetDetailedByIdAsync(id, cancellationToken);
        if (production is null)
        {
            return null;
        }

        if (production.Status == OutsourcedProductionStatus.ConvertidoEmProduto)
        {
            throw new InvalidOperationException("Esta produção já foi convertida em produto.");
        }

        var category = production.CategoryId.HasValue
            ? await categoryRepository.GetByIdAsync(production.CategoryId.Value, cancellationToken)
            : null;

        var finishingPct = request.FinishingPercentage.HasValue
            ? NormalizePercentage(request.FinishingPercentage.Value)
            : production.FinishingPercentage;

        var commissionPct = request.CommissionPercentage.HasValue
            ? NormalizePercentage(request.CommissionPercentage.Value)
            : 0m;

        var baseAdditionalCost = production.Recipe?.AdditionalCosts ?? 0m;
        var feeAdditionalCost = request.IncludeProductionFeeAsAdditionalCost
            ? production.SupplierCost - production.ProductionCost
            : 0m;

        var productNumeric = GetNextProductNumericIdentifier();
        var product = new Product
        {
            NumericIdentifier = productNumeric,
            Name = production.Name,
            Description = production.Description,
            CategoryId = production.CategoryId ?? Guid.Empty,
            SupplierId = production.OwnerSupplierId,
            GenerateProductionExpenseOnStockEntry = true,
            CurrentStock = 0,
            ItemsPerPlate = production.ItemsPerPlate,
            EstimatedPrintTimeMinutes = production.EstimatedPrintTimeMinutes,
            HeightCentimeters = production.HeightCentimeters,
            LengthMetersUsed = production.LengthMetersUsed,
            TariffPerKwh = production.TariffPerKwh,
            FinishingPercentage = finishingPct,
            CommissionPercentage = commissionPct,
            PrinterProfileId = production.PrinterProfileId,
            EstimatedWeightGrams = production.EstimatedWeightGrams,
            DefaultMarketplaceFeeId = production.DefaultMarketplaceFeeId,
            OutsourcedProductionId = production.Id,
            ProducerSupplierId = production.ProducerSupplierId,
            ProductionFeeAmount = production.SupplierCost
        };

        if (category is not null)
        {
            product.Sku = $"{category.NumericIdentifier:D3}-{productNumeric:D4}";
        }

        var resellerMarkup = request.DesiredMarkup ?? production.Recipe?.ResellerMarkup ?? 2.7m;
        var productRecipe = new ProductRecipe
        {
            Product = product,
            LaborHours = production.Recipe?.LaborHours ?? 1m,
            LaborCostPerHour = production.Recipe?.LaborCostPerHour ?? 0.5m,
            AdditionalCosts = baseAdditionalCost + feeAdditionalCost,
            WholesaleMarkup = 2m,
            RetailMarkup = 2.7m,
            ResellerMarkup = resellerMarkup
        };

        var filaments = production.Filaments
            .Where(f => f.FilamentProfile is not null)
            .Select(f => (f.FilamentProfile!, f.WeightGrams))
            .ToList();

        var printer = production.PrinterProfileId.HasValue
            ? await printerRepository.GetByIdAsync(production.PrinterProfileId.Value, cancellationToken)
            : null;

        var marketplace = production.DefaultMarketplaceFeeId.HasValue
            ? await marketplaceRepository.GetByIdAsync(production.DefaultMarketplaceFeeId.Value, cancellationToken)
            : null;

        var pricingRecipe = new ProductRecipe
        {
            LaborHours = productRecipe.LaborHours,
            LaborCostPerHour = productRecipe.LaborCostPerHour,
            AdditionalCosts = productRecipe.AdditionalCosts,
            WholesaleMarkup = productRecipe.WholesaleMarkup,
            RetailMarkup = productRecipe.RetailMarkup,
            ResellerMarkup = productRecipe.ResellerMarkup
        };

        var pricing = pricingService.Calculate(product, pricingRecipe, printer, filaments, marketplace);
        product.CostPrice = pricing.TotalCost;
        product.SuggestedPrice = pricing.SuggestedPrice;
        productRecipe.TotalCost = pricing.CompositionCost;

        var salePrice = request.SalePrice ?? pricing.SuggestedPrice;
        var minimumSalePrice = decimal.Round(product.CostPrice * 2m, 2);
        product.SalePrice = Math.Max(salePrice, minimumSalePrice);
        product.ProfitMargin = product.SalePrice <= 0m ? 0m : decimal.Round((product.SalePrice - product.CostPrice) / product.SalePrice, 4);
        product.CommissionedSalePrice = commissionPct > 0m
            ? decimal.Round(product.SalePrice / (1m - commissionPct), 2)
            : product.SalePrice;

        await productRepository.AddAsync(product, cancellationToken);
        await productRecipeRepository.AddAsync(productRecipe, cancellationToken);
        await productRepository.SaveChangesAsync(cancellationToken);

        foreach (var pf in production.Filaments)
        {
            await productFilamentRepository.AddAsync(new ProductFilament
            {
                ProductId = product.Id,
                FilamentProfileId = pf.FilamentProfileId,
                WeightGrams = pf.WeightGrams
            }, cancellationToken);
        }

        if (production.Filaments.Count > 0)
        {
            await productFilamentRepository.SaveChangesAsync(cancellationToken);
        }

        production.Status = OutsourcedProductionStatus.ConvertidoEmProduto;
        production.ConvertedProductId = product.Id;
        repository.Update(production);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(OutsourcedProduction),
            EntityId = production.Id.ToString(),
            Action = AuditAction.Updated,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { Action = "ConvertidoEmProduto", ProductId = product.Id })
        }, cancellationToken);

        await repository.SaveChangesAsync(cancellationToken);

        await cacheInvalidationService.InvalidateProductReadModelsAsync([production.OwnerSupplierId], cancellationToken);

        var loaded = await productRepository.GetDetailedByIdAsync(product.Id, cancellationToken) ?? product;
        return MapProduct(loaded);
    }

    public async Task<PriceSuggestionDto> PreviewPricingAsync(OutsourcedProductionRequest request, CancellationToken cancellationToken = default)
    {
        var (proxy, recipe, printer, filaments, marketplace) = await BuildPricingInputsAsync(request, cancellationToken);
        var snapshot = pricingService.Calculate(proxy, recipe, printer, filaments, marketplace);
        return MapPricing(snapshot);
    }

    private async Task ApplyCostAsync(OutsourcedProduction production, OutsourcedProductionRecipe recipe, IReadOnlyList<OutsourcedProductionFilamentRequest> filaments, CancellationToken cancellationToken)
    {
        var printer = production.PrinterProfileId.HasValue
            ? await printerRepository.GetByIdAsync(production.PrinterProfileId.Value, cancellationToken)
            : null;

        var marketplace = production.DefaultMarketplaceFeeId.HasValue
            ? await marketplaceRepository.GetByIdAsync(production.DefaultMarketplaceFeeId.Value, cancellationToken)
            : null;

        var filamentProfiles = await ResolveFilamentsAsync(filaments, cancellationToken);

        var proxy = BuildProductProxy(production);
        var proxyRecipe = new ProductRecipe
        {
            LaborHours = recipe.LaborHours,
            LaborCostPerHour = recipe.LaborCostPerHour,
            AdditionalCosts = recipe.AdditionalCosts,
            WholesaleMarkup = recipe.WholesaleMarkup,
            RetailMarkup = recipe.RetailMarkup,
            ResellerMarkup = recipe.ResellerMarkup
        };

        var snapshot = pricingService.Calculate(proxy, proxyRecipe, printer, filamentProfiles, marketplace);
        production.ProductionCost = snapshot.TotalCost;
        production.SupplierCost = decimal.Round(snapshot.TotalCost * (1m + production.ProductionFeePercentage / 100m), 2);
        recipe.TotalCost = snapshot.CompositionCost;
    }

    private async Task<(Product proxy, ProductRecipe recipe, PrinterProfile? printer, IReadOnlyList<(FilamentProfile, decimal)> filaments, MarketplaceFee? marketplace)>
        BuildPricingInputsAsync(OutsourcedProductionRequest request, CancellationToken cancellationToken)
    {
        var proxy = new Product
        {
            ItemsPerPlate = Math.Max(1, request.ItemsPerPlate),
            EstimatedPrintTimeMinutes = request.EstimatedPrintTimeMinutes,
            HeightCentimeters = request.HeightCentimeters,
            LengthMetersUsed = request.LengthMetersUsed,
            TariffPerKwh = request.TariffPerKwh,
            FinishingPercentage = NormalizePercentage(request.FinishingPercentage),
            PrinterProfileId = request.PrinterProfileId,
            CommissionPercentage = 0m,
            SalePrice = 0m
        };

        var recipe = new ProductRecipe
        {
            LaborHours = 1m,
            LaborCostPerHour = 0.5m,
            AdditionalCosts = request.AdditionalCost,
            WholesaleMarkup = 2m,
            RetailMarkup = 2.7m,
            ResellerMarkup = request.DesiredMarkup
        };

        var printer = request.PrinterProfileId.HasValue
            ? await printerRepository.GetByIdAsync(request.PrinterProfileId.Value, cancellationToken)
            : null;

        var marketplace = request.MarketplaceFeeId.HasValue
            ? await marketplaceRepository.GetByIdAsync(request.MarketplaceFeeId.Value, cancellationToken)
            : null;

        var filaments = await ResolveFilamentsAsync(request.Filaments, cancellationToken);

        return (proxy, recipe, printer, filaments, marketplace);
    }

    private async Task<IReadOnlyList<(FilamentProfile filament, decimal weightGrams)>> ResolveFilamentsAsync(
        IReadOnlyList<OutsourcedProductionFilamentRequest> filaments,
        CancellationToken cancellationToken)
    {
        var valid = filaments.Where(f => f.FilamentProfileId != Guid.Empty && f.WeightGrams > 0m).ToList();
        if (valid.Count == 0)
        {
            return [];
        }

        var ids = valid.Select(f => f.FilamentProfileId).Distinct().ToList();
        var profilesById = filamentProfileRepository.Query()
            .Where(p => ids.Contains(p.Id))
            .ToDictionary(p => p.Id);

        return valid
            .Where(f => profilesById.ContainsKey(f.FilamentProfileId))
            .Select(f => (profilesById[f.FilamentProfileId], f.WeightGrams))
            .ToList();
    }

    private static Product BuildProductProxy(OutsourcedProduction production)
        => new()
        {
            ItemsPerPlate = production.ItemsPerPlate,
            EstimatedPrintTimeMinutes = production.EstimatedPrintTimeMinutes,
            HeightCentimeters = production.HeightCentimeters,
            LengthMetersUsed = production.LengthMetersUsed,
            TariffPerKwh = production.TariffPerKwh,
            FinishingPercentage = production.FinishingPercentage,
            PrinterProfileId = production.PrinterProfileId,
            CommissionPercentage = 0m,
            SalePrice = 0m
        };

    private async Task ValidateSuppliersAsync(Guid? producerId, Guid ownerId, CancellationToken cancellationToken)
    {
        if (producerId.HasValue)
        {
            _ = await supplierRepository.GetByIdAsync(producerId.Value, cancellationToken)
                ?? throw new InvalidOperationException("Fornecedor produtor não encontrado.");
        }
        _ = await supplierRepository.GetByIdAsync(ownerId, cancellationToken)
            ?? throw new InvalidOperationException("Fornecedor destinatário não encontrado.");
    }

    private async Task SaveFilamentsAsync(Guid productionId, IReadOnlyList<OutsourcedProductionFilamentRequest> filaments, CancellationToken cancellationToken)
    {
        var valid = filaments.Where(f => f.FilamentProfileId != Guid.Empty && f.WeightGrams > 0m).ToList();
        foreach (var item in valid)
        {
            await outsourcedFilamentRepository.AddAsync(new OutsourcedProductionFilament
            {
                OutsourcedProductionId = productionId,
                FilamentProfileId = item.FilamentProfileId,
                WeightGrams = item.WeightGrams
            }, cancellationToken);
        }

        if (valid.Count > 0)
        {
            await outsourcedFilamentRepository.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task ReplaceFilamentsAsync(Guid productionId, IReadOnlyList<OutsourcedProductionFilamentRequest> filaments, CancellationToken cancellationToken)
    {
        var existing = outsourcedFilamentRepository.Query().Where(x => x.OutsourcedProductionId == productionId).ToList();
        foreach (var item in existing)
        {
            outsourcedFilamentRepository.Remove(item);
        }

        if (existing.Count > 0)
        {
            await outsourcedFilamentRepository.SaveChangesAsync(cancellationToken);
        }

        await SaveFilamentsAsync(productionId, filaments, cancellationToken);
    }

    private int GetNextProductNumericIdentifier()
    {
        var max = productRepository.Query()
            .OrderByDescending(x => x.NumericIdentifier)
            .Select(x => x.NumericIdentifier)
            .FirstOrDefault();
        return max + 1;
    }

    private static decimal NormalizePercentage(decimal value)
        => value > 1m ? value / 100m : value;

    private static OutsourcedProductionDto Map(OutsourcedProduction p)
        => new(
            p.Id,
            p.Name,
            p.Description,
            p.CategoryId,
            p.Category?.Name,
            p.ProducerSupplierId,
            p.ProducerSupplier?.Name ?? (p.ProducerSupplierId.HasValue ? string.Empty : "Lojinha"),
            p.OwnerSupplierId,
            p.OwnerSupplier?.Name ?? string.Empty,
            p.ItemsPerPlate,
            p.EstimatedPrintTimeMinutes,
            p.HeightCentimeters,
            p.EstimatedWeightGrams,
            p.LengthMetersUsed,
            p.TariffPerKwh,
            p.FinishingPercentage > 1m ? p.FinishingPercentage : p.FinishingPercentage * 100m,
            p.Recipe?.AdditionalCosts ?? 0m,
            p.PrinterProfileId,
            p.PrinterProfile?.Name,
            p.Filaments.Select(f => new OutsourcedProductionFilamentDto(f.FilamentProfileId, f.FilamentProfile?.Name ?? string.Empty, f.WeightGrams)).ToList(),
            p.DefaultMarketplaceFeeId,
            p.DefaultMarketplaceFee?.Name,
            p.Recipe?.ResellerMarkup ?? 2.7m,
            p.ProductionFeePercentage,
            p.ProductionCost,
            p.SupplierCost,
            p.Status,
            p.ConvertedProductId,
            p.CreatedAtUtc,
            p.UpdatedAtUtc);

    private static ProductDto MapProduct(Product product)
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
            product.FinishingPercentage > 1m ? product.FinishingPercentage : product.FinishingPercentage * 100m,
            product.CommissionPercentage > 1m ? product.CommissionPercentage : product.CommissionPercentage * 100m,
            product.CommissionedSalePrice,
            product.Recipe?.AdditionalCosts ?? 0m,
            product.PrinterProfileId,
            product.Filaments.Select(f => new ProductFilamentDto(f.FilamentProfileId, f.FilamentProfile?.Name ?? string.Empty, f.WeightGrams)).ToList(),
            product.PrinterProfile?.Name,
            product.DefaultMarketplaceFee?.Name,
            product.DefaultMarketplaceFeeId,
            product.LifecycleStatus,
            product.OutsourcedProductionId,
            product.ProducerSupplierId,
            product.ProducerSupplier?.Name,
            product.ProductionFeeAmount);

    private static PriceSuggestionDto MapPricing(PricingSnapshot s)
        => new(s.CompositionCost, s.TotalCost, s.MaterialCost, s.EnergyCost, s.MaintenanceCost, s.FailureCost,
               s.FinishingCost, s.LaborCost, s.AdditionalCosts, s.WholesalePrice, s.RetailPrice, s.ResellerPrice,
               s.DesiredMarkup, s.SuggestedPrice, s.CommissionPercentage, s.CommissionAmount,
               s.SuggestedPriceWithCommission, s.FinalPriceWithoutCommission, s.FinalPriceWithCommission,
               s.MarketplaceAdjustedPrice, s.EstimatedMargin);
}
