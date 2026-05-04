using Lojinha.Api.Entities;

namespace Lojinha.Api.Services;

public sealed record PricingSnapshot(
    decimal CompositionCost,
    decimal TotalCost,
    decimal MaterialCost,
    decimal EnergyCost,
    decimal MaintenanceCost,
    decimal FailureCost,
    decimal FinishingCost,
    decimal LaborCost,
    decimal AdditionalCosts,
    decimal WholesalePrice,
    decimal RetailPrice,
    decimal ResellerPrice,
    decimal DesiredMarkup,
    decimal SuggestedPrice,
    decimal CommissionPercentage,
    decimal CommissionAmount,
    decimal SuggestedPriceWithCommission,
    decimal FinalPriceWithoutCommission,
    decimal FinalPriceWithCommission,
    decimal MarketplaceAdjustedPrice,
    decimal EstimatedMargin);

public interface IPricingService
{
    PricingSnapshot Calculate(Product product, ProductRecipe? recipe, PrinterProfile? printer, IReadOnlyList<(FilamentProfile filament, decimal weightGrams)> filaments, MarketplaceFee? marketplace);
}

public sealed class PricingService : IPricingService
{
    private const decimal DepreciationDivisor = 2058.333333m;

    public PricingSnapshot Calculate(Product product, ProductRecipe? recipe, PrinterProfile? printer, IReadOnlyList<(FilamentProfile filament, decimal weightGrams)> filaments, MarketplaceFee? marketplace)
    {
        var recipeSupplyCost = recipe?.Items.Sum(item => item.Quantity * (item.Supply?.CostPerUnit ?? 0m)) ?? 0m;

        var byWeight = (filaments ?? []).Sum(f =>
            f.filament.SpoolWeightKg > 0 && f.weightGrams > 0
                ? (f.weightGrams / (f.filament.SpoolWeightKg * 1000m)) * f.filament.CostBRL
                : 0m);

        var materialCost = recipeSupplyCost > 0 ? recipeSupplyCost : byWeight;
        var printHours = product.EstimatedPrintTimeMinutes / 60m;
        var energyCost = printHours * (printer?.PowerKw ?? 0m) * product.TariffPerKwh;
        var wearLevel = GetWearLevel(printer?.UsageLevel);
        var maintenanceCost = printer is null
            ? 0m
            : ((printer.MachineCost * wearLevel) / Math.Max(1m, printer.WorkHoursPerDay * printer.WorkingDaysPerMonth * 12m)) * printHours;
        var failureCost = materialCost * (printer?.FailureRate ?? 0m);
        var finishingCost = materialCost * product.FinishingPercentage;
        var returnInvestmentCost = printer is null || printer.ReturnMonths <= 0m
            ? 0m
            : (printer.MachineCost / Math.Max(1m, printer.ReturnMonths * printer.WorkHoursPerDay * printer.WorkingDaysPerMonth)) * printHours;
        var depreciationCost = printer is null || printer.ReturnMonths <= 0m
            ? 0m
            : ((printer.ReturnMonths * printer.WorkHoursPerDay * printer.WorkingDaysPerMonth) / DepreciationDivisor);
        var laborCost = (recipe?.LaborHours ?? 0m) * (recipe?.LaborCostPerHour ?? 0m);
        var additionalCosts = recipe?.AdditionalCosts ?? 0m;
        var plateCompositionCost = materialCost + maintenanceCost + failureCost + finishingCost + returnInvestmentCost + depreciationCost + laborCost + additionalCosts;
        var plateTotalCost = plateCompositionCost + energyCost;
        var itemsPerPlate = Math.Max(1, product.ItemsPerPlate);
        var compositionCost = plateCompositionCost / itemsPerPlate;
        var totalCost = plateTotalCost / itemsPerPlate;
        var wholesalePrice = RoundPrice(totalCost * (recipe?.WholesaleMarkup ?? 2m));
        var retailPrice = RoundPrice(totalCost * (recipe?.RetailMarkup ?? 2.7m));
        var desiredMarkup = recipe?.ResellerMarkup ?? 2.7m;
        var resellerPrice = RoundPrice(totalCost * desiredMarkup);
        var commissionRate = product.CommissionPercentage <= 0m ? 0m : product.CommissionPercentage / 100m;
        var finalPriceWithoutCommission = product.SalePrice > 0m ? product.SalePrice : resellerPrice;
        var commissionAmount = RoundPrice(finalPriceWithoutCommission * commissionRate);
        var suggestedPriceWithCommission = RoundPrice(resellerPrice + (resellerPrice * commissionRate));
        var finalPriceWithCommission = RoundPrice(finalPriceWithoutCommission + commissionAmount);
        var marketplaceCommission = resellerPrice * (marketplace?.PercentageFee ?? 0m);
        var marketplaceAdjustedPrice = resellerPrice + marketplaceCommission + (marketplace?.FixedFee ?? 0m);
        var estimatedMargin = marketplaceAdjustedPrice <= 0m
            ? 0m
            : (marketplaceAdjustedPrice - marketplaceCommission - totalCost) / marketplaceAdjustedPrice;

        return new PricingSnapshot(
            decimal.Round(compositionCost, 2),
            decimal.Round(totalCost, 2),
            decimal.Round(materialCost, 2),
            decimal.Round(energyCost, 2),
            decimal.Round(maintenanceCost, 2),
            decimal.Round(failureCost, 2),
            decimal.Round(finishingCost, 2),
            decimal.Round(laborCost, 2),
            decimal.Round(additionalCosts, 2),
            wholesalePrice,
            retailPrice,
            resellerPrice,
            desiredMarkup,
            resellerPrice,
            decimal.Round(product.CommissionPercentage, 2),
            commissionAmount,
            suggestedPriceWithCommission,
            decimal.Round(finalPriceWithoutCommission, 2),
            finalPriceWithCommission,
            decimal.Round(marketplaceAdjustedPrice, 2),
            decimal.Round(estimatedMargin, 4));
    }

    private static decimal RoundPrice(decimal value)
    {
        return value <= 0m ? 0m : decimal.Round(value, 2, MidpointRounding.AwayFromZero);
    }

    private static decimal GetWearLevel(string? usageLevel)
        => usageLevel?.Trim().ToLowerInvariant() switch
        {
            "basico" => 0.10m,
            "medio" => 0.20m,
            "profissional" => 0.30m,
            _ => 0.45m
        };
}