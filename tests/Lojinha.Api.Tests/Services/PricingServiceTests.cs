using Lojinha.Api.Entities;
using Lojinha.Api.Services;

namespace Lojinha.Api.Tests.Services;

public sealed class PricingServiceTests
{
    [Fact]
    public void Calculate_ShouldGenerateSuggestedAndMarketplacePrices()
    {
        var service = new PricingService();
        var product = new Product
        {
            ItemsPerPlate = 20,
            EstimatedWeightGrams = 100m,
            LengthMetersUsed = 30m,
            EstimatedPrintTimeMinutes = 180m,
            TariffPerKwh = 0.95m
        };
        var recipe = new ProductRecipe
        {
            LaborHours = 1m,
            LaborCostPerHour = 10m,
            AdditionalCosts = 3m,
            WholesaleMarkup = 2m,
            RetailMarkup = 2.5m,
            ResellerMarkup = 2.7m
        };
        var printer = new PrinterProfile
        {
            MachineCost = 7500m,
            ReturnMonths = 10m,
            WorkHoursPerDay = 15m,
            WorkingDaysPerMonth = 25m,
            PowerKw = 0.5m,
            FailureRate = 0.02m
        };
        var filament = new FilamentProfile
        {
            SpoolWeightKg = 1m,
            SpoolLengthMeters = 335m,
            CostBRL = 120m
        };
        var marketplace = new MarketplaceFee { FixedFee = 4m, PercentageFee = 0.14m };

        var result = service.Calculate(product, recipe, printer, [(filament, 100m)], marketplace);

        Assert.True(result.TotalCost > 0m);
        Assert.True(result.SuggestedPrice > result.TotalCost);
        Assert.True(result.MarketplaceAdjustedPrice > result.SuggestedPrice);
        Assert.True(result.EstimatedMargin > 0m);
    }

    [Fact]
    public void Calculate_ShouldUseUnitCost_WhenItemsPerPlateIsGreaterThanOne()
    {
        var service = new PricingService();
        var product = new Product
        {
            ItemsPerPlate = 20,
            EstimatedPrintTimeMinutes = 0m,
            TariffPerKwh = 0m
        };
        var recipe = new ProductRecipe
        {
            LaborHours = 0m,
            LaborCostPerHour = 0m,
            AdditionalCosts = 0m,
            WholesaleMarkup = 2m,
            RetailMarkup = 2.7m,
            ResellerMarkup = 3m,
            Items =
            [
                new ProductRecipeItem
                {
                    Quantity = 1m,
                    Supply = new Supply { CostPerUnit = 60m }
                }
            ]
        };

        var result = service.Calculate(product, recipe, null, [], null);

        Assert.Equal(3m, result.TotalCost);
        Assert.Equal(9m, result.SuggestedPrice);
    }
}