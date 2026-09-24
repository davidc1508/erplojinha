using Lojinha.Api.Contracts.PaintingPricing;
using Lojinha.Api.Data;
using Lojinha.Api.Domain.Services;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;
using Lojinha.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Tests.Services;

public sealed class PaintingPriceCalculatorTests
{
    [Fact]
    public void Calculate_ShouldCombineSizeLevelComplexityMaterialsAndPreparation()
    {
        var result = PaintingPriceCalculator.Calculate(Input(
            levelHourlyRate: 45m,
            baseHours: 5m,
            multiplier: 1.25m,
            preparations: [Preparation(PaintingPreparationChargeType.FixedAmount, 35m)]));

        Assert.Equal(6.25m, result.EstimatedHours);
        Assert.Equal(6.25m, result.TotalHours);
        Assert.Equal(45m, result.HourlyRate);
        Assert.Equal(PaintingHourlyRateSource.Level, result.HourlyRateSource);
        Assert.Equal(281.25m, result.LaborAmount);
        Assert.Equal(33.75m, result.MaterialsAmount);
        Assert.Equal(35m, result.PreparationAmount);
        Assert.Equal(0m, result.AddOnsAmount);
        Assert.Equal(350m, result.CostAmount);
        Assert.Equal(350m, result.SuggestedPrice);
        Assert.Equal(350m, result.FinalPrice);
    }

    [Fact]
    public void Calculate_ShouldUseMinimumMaterialsWhenPercentageIsLower()
    {
        var result = PaintingPriceCalculator.Calculate(Input(levelHourlyRate: 35m, baseHours: 1m, multiplier: 1m));

        Assert.Equal(35m, result.LaborAmount);
        Assert.Equal(20m, result.MaterialsAmount);
        Assert.True(result.MaterialsMinimumApplied);
    }

    [Fact]
    public void Calculate_ShouldApplyMinimumPaintingPrice()
    {
        var result = PaintingPriceCalculator.Calculate(Input(levelHourlyRate: 10m, baseHours: 1m, multiplier: 1m));

        Assert.Equal(30m, result.CostAmount);
        Assert.True(result.MinimumPriceApplied);
        Assert.Equal(50m, result.SuggestedPrice);
    }

    [Fact]
    public void Calculate_ShouldPrioritizeOverrideThenLevelThenDefaultHourlyRate()
    {
        var withOverride = PaintingPriceCalculator.Calculate(Input(levelHourlyRate: 60m, baseHours: 2m, multiplier: 1m) with { HourlyRateOverride = 80m });
        var withLevel = PaintingPriceCalculator.Calculate(Input(levelHourlyRate: 60m, baseHours: 2m, multiplier: 1m));
        var withDefault = PaintingPriceCalculator.Calculate(Input(levelHourlyRate: null, baseHours: 2m, multiplier: 1m));

        Assert.Equal((80m, PaintingHourlyRateSource.Override), (withOverride.HourlyRate, withOverride.HourlyRateSource));
        Assert.Equal((60m, PaintingHourlyRateSource.Level), (withLevel.HourlyRate, withLevel.HourlyRateSource));
        Assert.Equal((45m, PaintingHourlyRateSource.Default), (withDefault.HourlyRate, withDefault.HourlyRateSource));
    }

    [Fact]
    public void Calculate_ShouldApplyAddOnsByChargeType()
    {
        var result = PaintingPriceCalculator.Calculate(Input(
            levelHourlyRate: 50m,
            baseHours: 4m,
            multiplier: 1m,
            addOns:
            [
                AddOn(PaintingAddOnChargeType.AdditionalHours, additionalHours: 2m),
                AddOn(PaintingAddOnChargeType.Percentage, percentage: 10m),
                AddOn(PaintingAddOnChargeType.FixedAmount, value: 25m),
                AddOn(PaintingAddOnChargeType.Manual, value: 99m, manualAmount: 15m)
            ]));

        Assert.Equal(2m, result.AddOnHours);
        Assert.Equal(6m, result.TotalHours);
        Assert.Equal(300m, result.LaborAmount);
        Assert.Equal(70m, result.AddOnsAmount);
        Assert.Equal(300m + 36m + 70m, result.CostAmount);
    }

    [Fact]
    public void Calculate_ShouldChargeHourlyPreparationWithCalculationRateWhenServiceHasNoValue()
    {
        var result = PaintingPriceCalculator.Calculate(Input(
            levelHourlyRate: 40m,
            baseHours: 1m,
            multiplier: 1m,
            preparations:
            [
                Preparation(PaintingPreparationChargeType.Hourly, 0m, estimatedHours: 1.5m),
                Preparation(PaintingPreparationChargeType.Hourly, 30m, estimatedHours: 1m),
                Preparation(PaintingPreparationChargeType.Percentage, 50m)
            ]));

        Assert.Equal(60m + 30m + 20m, result.PreparationAmount);
    }

    [Fact]
    public void Calculate_ShouldApplyAdditionalMargin()
    {
        var result = PaintingPriceCalculator.Calculate(Input(levelHourlyRate: 45m, baseHours: 5m, multiplier: 1.25m) with { DefaultMarginPercentage = 10m });

        Assert.Equal(315m, result.CostAmount);
        Assert.Equal(31.5m, result.MarginAmount);
        Assert.Equal(346.5m, result.CalculatedAmount);
    }

    [Fact]
    public void Calculate_ShouldRespectManualOverrides()
    {
        var result = PaintingPriceCalculator.Calculate(Input(levelHourlyRate: 45m, baseHours: 5m, multiplier: 1.25m) with
        {
            HoursOverride = 3m,
            MaterialsAmountOverride = 5m,
            PreparationAmountOverride = 7m,
            AddOnsAmountOverride = 8m,
            FinalPriceOverride = 30m
        });

        Assert.True(result.HoursOverridden);
        Assert.Equal(6.25m, result.EstimatedHours);
        Assert.Equal(3m, result.TotalHours);
        Assert.Equal(135m, result.LaborAmount);
        Assert.Equal(5m, result.MaterialsAmount);
        Assert.Equal(155m, result.CostAmount);
        Assert.Equal(155m, result.SuggestedPrice);
        Assert.True(result.FinalPriceOverridden);
        Assert.Equal(30m, result.FinalPrice);
    }

    [Theory]
    [InlineData(PaintingPriceRounding.None, 350.12, 350.12)]
    [InlineData(PaintingPriceRounding.NearestInteger, 350.12, 351)]
    [InlineData(PaintingPriceRounding.EndsWith90, 350.12, 350.90)]
    [InlineData(PaintingPriceRounding.EndsWith90, 350.95, 351.90)]
    [InlineData(PaintingPriceRounding.EndsWith99, 350.00, 350.99)]
    [InlineData(PaintingPriceRounding.MultipleOf5, 351.00, 355)]
    [InlineData(PaintingPriceRounding.MultipleOf10, 350.00, 350)]
    [InlineData(PaintingPriceRounding.MultipleOf10, 350.01, 360)]
    public void ApplyRounding_ShouldNeverRoundBelowCalculatedValue(PaintingPriceRounding rounding, double value, double expected)
    {
        Assert.Equal((decimal)expected, PaintingPriceCalculator.ApplyRounding((decimal)value, rounding));
    }

    private static PaintingCalculationInput Input(
        decimal? levelHourlyRate,
        decimal baseHours,
        decimal multiplier,
        IReadOnlyList<PaintingPreparationCharge>? preparations = null,
        IReadOnlyList<PaintingAddOnCharge>? addOns = null)
        => new(
            DefaultHourlyRate: 45m,
            DefaultMaterialsPercentage: 12m,
            MinimumMaterialsAmount: 20m,
            MinimumPaintingPrice: 50m,
            DefaultMarginPercentage: 0m,
            Rounding: PaintingPriceRounding.None,
            LevelHourlyRate: levelHourlyRate,
            BaseHours: baseHours,
            ComplexityMultiplier: multiplier,
            Preparations: preparations ?? [],
            AddOns: addOns ?? []);

    private static PaintingPreparationCharge Preparation(PaintingPreparationChargeType chargeType, decimal value, decimal estimatedHours = 0m)
        => new(Guid.NewGuid(), chargeType.ToString(), chargeType, value, estimatedHours, null, null);

    private static PaintingAddOnCharge AddOn(PaintingAddOnChargeType chargeType, decimal value = 0m, decimal percentage = 0m, decimal additionalHours = 0m, decimal? manualAmount = null)
        => new(Guid.NewGuid(), chargeType.ToString(), chargeType, value, percentage, additionalHours, manualAmount);
}

public sealed class PaintingPricingServiceTests
{
    [Fact]
    public async Task CalculateAsync_ShouldUsePersistedSeedParameters()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);
        var level = dbContext.PaintingLevels.Single(x => x.Name == "Colecionável");
        var complexity = dbContext.PaintingComplexities.Single(x => x.Name == "Normal");
        var sanding = dbContext.PaintingPreparationServices.Single(x => x.Name == "Remoção de marcas de suporte e lixamento");

        var result = await service.CalculateAsync(Request(20m, level.Id, complexity.Id) with
        {
            Preparations = [new PaintingItemSelectionRequest(sanding.Id, null, null)]
        });

        Assert.Equal("16 a 20 cm", result.SizeRange?.Name);
        Assert.Equal(5m, result.BaseHours);
        Assert.Equal(1.25m, result.ComplexityMultiplier);
        Assert.Equal(6.25m, result.TotalHours);
        Assert.Equal(281.25m, result.LaborAmount);
        Assert.Equal(33.75m, result.MaterialsAmount);
        Assert.Equal(35m, result.PreparationAmount);
        Assert.Equal(350m, result.CostAmount);
        Assert.Equal(350m, result.SuggestedPrice);
    }

    [Fact]
    public async Task CalculateAsync_ShouldFollowUpdatedSettingsWithoutHardcodedValues()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);
        var level = dbContext.PaintingLevels.Single(x => x.Name == "Colecionável");
        var complexity = dbContext.PaintingComplexities.Single(x => x.Name == "Normal");

        var before = await service.CalculateAsync(Request(20m, level.Id, complexity.Id));
        await service.UpdateSettingsAsync(new UpdatePaintingSettingsRequest(45m, 20m, 20m, 50m, 10m, PaintingPriceRounding.EndsWith90), "teste");
        await service.UpdateLevelAsync(level.Id, new PaintingLevelRequest(level.Name, level.Description, 50m, level.Order, true), "teste");
        var after = await service.CalculateAsync(Request(20m, level.Id, complexity.Id));

        Assert.Equal(315m, before.SuggestedPrice);
        Assert.Equal(312.5m, after.LaborAmount);
        Assert.Equal(62.5m, after.MaterialsAmount);
        Assert.Equal(37.5m, after.MarginAmount);
        Assert.Equal(412.90m, after.SuggestedPrice);
    }

    [Fact]
    public async Task CalculateAsync_ShouldFlagManualReviewForOpenEndedRange()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);
        var level = dbContext.PaintingLevels.Single(x => x.Name == "Detalhada");
        var complexity = dbContext.PaintingComplexities.Single(x => x.Name == "Simples");

        var result = await service.CalculateAsync(Request(45m, level.Id, complexity.Id));

        Assert.Equal("Acima de 40 cm", result.SizeRange?.Name);
        Assert.Contains("Recomendada avaliação manual.", result.Warnings);
        Assert.True(result.MinimumPriceApplied);
        Assert.Equal(50m, result.SuggestedPrice);
    }

    [Fact]
    public async Task CalculateAsync_ShouldRejectInactiveLevel()
    {
        await using var dbContext = CreateSeededDbContext();
        var level = dbContext.PaintingLevels.Single(x => x.Name == "Premium / Display");
        level.IsActive = false;
        await dbContext.SaveChangesAsync();
        var service = CreateService(dbContext);
        var complexity = dbContext.PaintingComplexities.First();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CalculateAsync(Request(10m, level.Id, complexity.Id)));
    }

    [Fact]
    public async Task CalculateAsync_ShouldRejectInactiveAddOn()
    {
        await using var dbContext = CreateSeededDbContext();
        var addOn = dbContext.PaintingAddOns.Single(x => x.Name == "NMM");
        addOn.IsActive = false;
        await dbContext.SaveChangesAsync();
        var service = CreateService(dbContext);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CalculateAsync(Request(10m, dbContext.PaintingLevels.First().Id, dbContext.PaintingComplexities.First().Id) with
        {
            AddOns = [new PaintingItemSelectionRequest(addOn.Id, null, null)]
        }));
    }

    [Fact]
    public async Task CreateSizeRangeAsync_ShouldRejectOverlappingActiveRange()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateSizeRangeAsync(
            new PaintingSizeRangeRequest("12 a 18 cm", 12m, 18m, false, 99, true, []), "teste"));
    }

    [Fact]
    public async Task UpdateSizeRangeAsync_ShouldUpdateHoursAndRecordHistory()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);
        var range = dbContext.PaintingSizeRanges.Single(x => x.Name == "16 a 20 cm");
        var level = dbContext.PaintingLevels.Single(x => x.Name == "Colecionável");
        var hours = dbContext.PaintingSizeRangeHours.Where(x => x.SizeRangeId == range.Id).ToList()
            .Select(x => new PaintingSizeRangeHoursRequest(x.LevelId, x.LevelId == level.Id ? 5.5m : x.Hours))
            .ToList();

        var updated = await service.UpdateSizeRangeAsync(range.Id, new PaintingSizeRangeRequest(range.Name, range.MinHeightCm, range.MaxHeightCm, false, range.Order, true, hours), "teste");
        var history = await service.GetHistoryAsync(10);

        Assert.Equal(5.5m, updated!.Hours.Single(x => x.LevelId == level.Id).Hours);
        Assert.Equal(4, dbContext.PaintingSizeRangeHours.Count(x => x.SizeRangeId == range.Id));
        var entry = Assert.Single(history);
        Assert.Equal("Faixa de tamanho", entry.EntityType);
        var change = Assert.Single(entry.Changes);
        Assert.Equal("Horas — Colecionável", change.Field);
        Assert.Equal("5 h", change.Before);
        Assert.Equal("5,5 h", change.After);
    }

    [Fact]
    public async Task CalculateForProductAsync_ShouldReturnAcceptanceScenarioFromCentralService()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);

        var result = await service.CalculateForProductAsync(ProductRequest(dbContext));

        Assert.NotNull(result);
        Assert.Equal(20m, result!.Details!.HeightCm);
        Assert.Equal("16 a 20 cm", result.Details.SizeRange?.Name);
        Assert.Equal(5m, result.Details.BaseHours);
        Assert.Equal(1.25m, result.Details.ComplexityMultiplier);
        Assert.Equal(6.25m, result.Details.TotalHours);
        Assert.Equal(45m, result.Details.HourlyRate);
        Assert.Equal(281.25m, result.Details.LaborAmount);
        Assert.Equal(33.75m, result.Details.MaterialsAmount);
        Assert.Equal(35m, result.Details.PreparationAmount);
        Assert.Equal(0m, result.Details.AddOnsAmount);
        Assert.Equal(350m, result.CostAmount);
        Assert.Equal(350m, result.IncorporatedCost);
        Assert.Equal(0m, result.IncorporatedPrice);
    }

    [Theory]
    [InlineData(PaintingPriceApplication.IncorporateCost, 350, 0)]
    [InlineData(PaintingPriceApplication.IncorporatePrice, 0, 350)]
    [InlineData(PaintingPriceApplication.ReferenceOnly, 0, 0)]
    [InlineData(PaintingPriceApplication.ManualAmount, 120, 0)]
    public async Task CalculateForProductAsync_ShouldApplyPaintingToProductPriceAsChosen(PaintingPriceApplication application, double expectedCost, double expectedPrice)
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);

        var result = await service.CalculateForProductAsync(ProductRequest(dbContext) with { Application = application, ManualIncorporatedAmount = 120m });

        Assert.Equal((decimal)expectedCost, result!.IncorporatedCost);
        Assert.Equal((decimal)expectedPrice, result.IncorporatedPrice);
    }

    [Fact]
    public async Task CalculateForProductAsync_ShouldIgnoreOverridesInAutomaticModeAndHonorThemInSemiAutomatic()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);
        var request = ProductRequest(dbContext) with { HoursOverride = 7m, HourlyRateOverride = 50m };

        var automatic = await service.CalculateForProductAsync(request);
        var semiAutomatic = await service.CalculateForProductAsync(request with { Mode = PaintingPricingMode.SemiAutomatic });

        Assert.Equal(350m, automatic!.CostAmount);
        Assert.Equal(7m, semiAutomatic!.Details!.TotalHours);
        Assert.Equal(50m, semiAutomatic.Details.HourlyRate);
        Assert.Equal(350m + 42m + 35m, semiAutomatic.CostAmount);
    }

    [Fact]
    public async Task CalculateForProductAsync_ShouldUseInformedValuesInManualMode()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);

        var result = await service.CalculateForProductAsync(new ProductPaintingRequest { Enabled = true, Mode = PaintingPricingMode.Manual, ManualCost = 300m, ManualPrice = 420m });

        Assert.Null(result!.Details);
        Assert.Equal(300m, result.CostAmount);
        Assert.Equal(420m, result.PriceUsed);
        Assert.Equal(300m, result.IncorporatedCost);
    }

    [Fact]
    public async Task CalculateForProductAsync_ShouldPriceOutsourcedPaintingFromChargedCosts()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);

        var result = await service.CalculateForProductAsync(ProductRequest(dbContext) with
        {
            Execution = PaintingExecution.Outsourced,
            OutsourcedChargedAmount = 200m,
            OutsourcedFreightAmount = 20m,
            OutsourcedOtherCosts = 10m,
            OutsourcedIncorporatedPrice = 320m
        });

        Assert.True(result!.Details!.IsOutsourced);
        Assert.Equal(0m, result.Details.LaborAmount);
        Assert.Equal(230m, result.CostAmount);
        Assert.Equal(320m, result.PriceUsed);
    }

    [Fact]
    public async Task CalculateForProductAsync_ShouldAddBaseExtraPreparationAndFreeAddOn()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);
        var basica = dbContext.PaintingLevels.Single(x => x.Name == "Básica / Comercial");

        var result = await service.CalculateForProductAsync(ProductRequest(dbContext) with
        {
            BaseNeedsPainting = true,
            BaseMode = PaintingBaseMode.OtherLevel,
            BaseLevelId = basica.Id,
            BaseHours = 2m,
            ExtraPreparationDescription = "Remover resina",
            ExtraPreparationAmount = 15m,
            FreeAddOnDescription = "Gema",
            FreeAddOnQuantity = 2m,
            FreeAddOnUnitAmount = 5m
        });

        Assert.Equal(70m, result!.Details!.BaseAmount);
        Assert.Equal(50m, result.Details.PreparationAmount);
        Assert.Equal(10m, result.Details.AddOnsAmount);
        Assert.Equal(281.25m + 33.75m + 50m + 10m + 70m, result.CostAmount);
    }

    [Fact]
    public async Task ProductPainting_ShouldKeepStoredSnapshotUntilExplicitRecalculation()
    {
        await using var dbContext = CreateSeededDbContext();
        var service = CreateService(dbContext);
        var productId = Guid.NewGuid();
        var request = ProductRequest(dbContext);
        var calculation = await service.CalculateForProductAsync(request);
        var stored = new ProductPainting { ProductId = productId };
        ProductPaintingMapper.Apply(stored, request, calculation);
        dbContext.ProductPaintings.Add(stored);
        await dbContext.SaveChangesAsync();

        var level = dbContext.PaintingLevels.Single(x => x.Name == "Colecionável");
        await service.UpdateLevelAsync(level.Id, new PaintingLevelRequest(level.Name, level.Description, 55m, level.Order, true), "teste");

        var kept = await service.CalculateForProductAsync(request with { KeepStoredSnapshot = true, SourceProductId = productId });
        var hasNewer = await service.HasNewerParametersAsync(stored);
        var recalculation = await service.RecalculateForProductAsync(productId);

        Assert.True(kept!.FromStoredSnapshot);
        Assert.Equal(350m, kept.CostAmount);
        Assert.Equal(350m, stored.CostAmount);
        Assert.True(hasNewer);
        Assert.True(recalculation!.HasDifferences);
        Assert.Equal(350m, recalculation.Stored!.CostAmount);
        Assert.Equal(343.75m + 41.25m + 35m, recalculation.Recalculated.CostAmount);
        Assert.Equal(70m, recalculation.CostDifference);
    }

    private static ProductPaintingRequest ProductRequest(AppDbContext dbContext)
        => new()
        {
            Enabled = true,
            HeightCm = 20m,
            LevelId = dbContext.PaintingLevels.Single(x => x.Name == "Colecionável").Id,
            ComplexityId = dbContext.PaintingComplexities.Single(x => x.Name == "Normal").Id,
            Preparations = [new PaintingItemSelectionRequest(dbContext.PaintingPreparationServices.Single(x => x.Name == "Remoção de marcas de suporte e lixamento").Id, null, null)]
        };

    private static PaintingPricingCalculationRequest Request(decimal heightCm, Guid levelId, Guid complexityId)
        => new(heightCm, levelId, complexityId, [], [], null, null, null, null, null, null, null, null);

    private static PaintingPricingService CreateService(AppDbContext dbContext)
        => new(
            new Repository<PaintingSettings>(dbContext),
            new Repository<PaintingLevel>(dbContext),
            new Repository<PaintingComplexity>(dbContext),
            new Repository<PaintingSizeRange>(dbContext),
            new Repository<PaintingSizeRangeHours>(dbContext),
            new Repository<PaintingPreparationService>(dbContext),
            new Repository<PaintingMaterial>(dbContext),
            new Repository<PaintingAddOn>(dbContext),
            new Repository<AuditLog>(dbContext),
            new Repository<ProductPainting>(dbContext));

    private static AppDbContext CreateSeededDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var dbContext = new AppDbContext(options);
        var seed = PaintingPricingSeed.Create();
        dbContext.PaintingSettings.Add(seed.Settings);
        dbContext.PaintingLevels.AddRange(seed.Levels);
        dbContext.PaintingComplexities.AddRange(seed.Complexities);
        dbContext.PaintingSizeRanges.AddRange(seed.SizeRanges);
        dbContext.PaintingSizeRangeHours.AddRange(seed.SizeRangeHours);
        dbContext.PaintingPreparationServices.AddRange(seed.PreparationServices);
        dbContext.PaintingAddOns.AddRange(seed.AddOns);
        dbContext.SaveChanges();
        return dbContext;
    }
}
