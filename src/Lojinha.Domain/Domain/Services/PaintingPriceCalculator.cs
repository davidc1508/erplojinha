using Lojinha.Api.Entities;

namespace Lojinha.Api.Domain.Services;

public enum PaintingHourlyRateSource
{
    Override = 1,
    Level = 2,
    Default = 3
}

public sealed record PaintingPreparationCharge(
    Guid Id,
    string Name,
    PaintingPreparationChargeType ChargeType,
    decimal Value,
    decimal EstimatedHours,
    decimal? ManualAmount,
    decimal? HoursOverride);

public sealed record PaintingAddOnCharge(
    Guid Id,
    string Name,
    PaintingAddOnChargeType ChargeType,
    decimal Value,
    decimal Percentage,
    decimal AdditionalHours,
    decimal? ManualAmount);

public sealed record PaintingCalculationInput(
    decimal DefaultHourlyRate,
    decimal DefaultMaterialsPercentage,
    decimal MinimumMaterialsAmount,
    decimal MinimumPaintingPrice,
    decimal DefaultMarginPercentage,
    PaintingPriceRounding Rounding,
    decimal? LevelHourlyRate,
    decimal BaseHours,
    decimal ComplexityMultiplier,
    IReadOnlyList<PaintingPreparationCharge> Preparations,
    IReadOnlyList<PaintingAddOnCharge> AddOns,
    decimal? HoursOverride = null,
    decimal? HourlyRateOverride = null,
    decimal? MaterialsPercentageOverride = null,
    decimal? MaterialsAmountOverride = null,
    decimal? PreparationAmountOverride = null,
    decimal? AddOnsAmountOverride = null,
    decimal? MarginPercentageOverride = null,
    decimal? FinalPriceOverride = null);

public sealed record PaintingChargeLine(
    Guid Id,
    string Name,
    string ChargeType,
    decimal Hours,
    decimal Amount);

public sealed record PaintingCalculationResult(
    decimal BaseHours,
    decimal ComplexityMultiplier,
    decimal EstimatedHours,
    bool HoursOverridden,
    decimal AddOnHours,
    decimal TotalHours,
    decimal HourlyRate,
    PaintingHourlyRateSource HourlyRateSource,
    decimal LaborAmount,
    decimal MaterialsPercentage,
    decimal MaterialsAmount,
    bool MaterialsMinimumApplied,
    bool MaterialsOverridden,
    IReadOnlyList<PaintingChargeLine> Preparations,
    decimal PreparationAmount,
    bool PreparationOverridden,
    IReadOnlyList<PaintingChargeLine> AddOns,
    decimal AddOnsAmount,
    bool AddOnsOverridden,
    decimal CostAmount,
    decimal MarginPercentage,
    decimal MarginAmount,
    decimal CalculatedAmount,
    decimal MinimumPaintingPrice,
    bool MinimumPriceApplied,
    PaintingPriceRounding Rounding,
    decimal SuggestedPrice,
    decimal FinalPrice,
    bool FinalPriceOverridden);

public static class PaintingPriceCalculator
{
    public static PaintingCalculationResult Calculate(PaintingCalculationInput input)
    {
        var estimatedHours = RoundHours(Math.Max(0m, input.BaseHours) * Math.Max(0m, input.ComplexityMultiplier));
        var addOnHours = RoundHours(input.AddOns
            .Where(addOn => addOn.ChargeType == PaintingAddOnChargeType.AdditionalHours)
            .Sum(addOn => Math.Max(0m, addOn.AdditionalHours)));
        var hoursOverridden = input.HoursOverride.HasValue;
        var totalHours = RoundHours((hoursOverridden ? Math.Max(0m, input.HoursOverride!.Value) : estimatedHours) + addOnHours);

        var (hourlyRate, hourlyRateSource) = ResolveHourlyRate(input);
        var laborAmount = Money(totalHours * hourlyRate);

        var materialsPercentage = Math.Max(0m, input.MaterialsPercentageOverride ?? input.DefaultMaterialsPercentage);
        var materialsByPercentage = Money(laborAmount * materialsPercentage / 100m);
        var minimumMaterials = Math.Max(0m, input.MinimumMaterialsAmount);
        var materialsOverridden = input.MaterialsAmountOverride.HasValue;
        var materialsMinimumApplied = !materialsOverridden && minimumMaterials > materialsByPercentage;
        var materialsAmount = materialsOverridden
            ? Money(Math.Max(0m, input.MaterialsAmountOverride!.Value))
            : Math.Max(materialsByPercentage, minimumMaterials);

        var preparations = input.Preparations
            .Select(preparation => CalculatePreparation(preparation, laborAmount, hourlyRate))
            .ToList();
        var preparationOverridden = input.PreparationAmountOverride.HasValue;
        var preparationAmount = preparationOverridden
            ? Money(Math.Max(0m, input.PreparationAmountOverride!.Value))
            : Money(preparations.Sum(line => line.Amount));

        var addOns = input.AddOns
            .Select(addOn => CalculateAddOn(addOn, laborAmount))
            .ToList();
        var addOnsOverridden = input.AddOnsAmountOverride.HasValue;
        var addOnsAmount = addOnsOverridden
            ? Money(Math.Max(0m, input.AddOnsAmountOverride!.Value))
            : Money(addOns.Sum(line => line.Amount));

        var costAmount = Money(laborAmount + materialsAmount + preparationAmount + addOnsAmount);
        var marginPercentage = Math.Max(0m, input.MarginPercentageOverride ?? input.DefaultMarginPercentage);
        var marginAmount = marginPercentage > 0m ? Money(costAmount * marginPercentage / 100m) : 0m;
        var calculatedAmount = Money(costAmount + marginAmount);

        var minimumPaintingPrice = Math.Max(0m, input.MinimumPaintingPrice);
        var minimumPriceApplied = calculatedAmount < minimumPaintingPrice;
        var priceBeforeRounding = minimumPriceApplied ? minimumPaintingPrice : calculatedAmount;
        var suggestedPrice = ApplyRounding(priceBeforeRounding, input.Rounding);

        var finalPriceOverridden = input.FinalPriceOverride.HasValue;
        var finalPrice = finalPriceOverridden ? Money(Math.Max(0m, input.FinalPriceOverride!.Value)) : suggestedPrice;

        return new PaintingCalculationResult(
            input.BaseHours,
            input.ComplexityMultiplier,
            estimatedHours,
            hoursOverridden,
            addOnHours,
            totalHours,
            hourlyRate,
            hourlyRateSource,
            laborAmount,
            materialsPercentage,
            materialsAmount,
            materialsMinimumApplied,
            materialsOverridden,
            preparations,
            preparationAmount,
            preparationOverridden,
            addOns,
            addOnsAmount,
            addOnsOverridden,
            costAmount,
            marginPercentage,
            marginAmount,
            calculatedAmount,
            minimumPaintingPrice,
            minimumPriceApplied,
            input.Rounding,
            suggestedPrice,
            finalPrice,
            finalPriceOverridden);
    }

    public static decimal ApplyRounding(decimal value, PaintingPriceRounding rounding)
    {
        var amount = Money(Math.Max(0m, value));
        return rounding switch
        {
            PaintingPriceRounding.NearestInteger => Math.Ceiling(amount),
            PaintingPriceRounding.EndsWith90 => RoundUpToCents(amount, 0.90m),
            PaintingPriceRounding.EndsWith99 => RoundUpToCents(amount, 0.99m),
            PaintingPriceRounding.MultipleOf5 => Math.Ceiling(amount / 5m) * 5m,
            PaintingPriceRounding.MultipleOf10 => Math.Ceiling(amount / 10m) * 10m,
            _ => amount
        };
    }

    private static (decimal Rate, PaintingHourlyRateSource Source) ResolveHourlyRate(PaintingCalculationInput input)
    {
        if (input.HourlyRateOverride.HasValue)
        {
            return (Math.Max(0m, input.HourlyRateOverride.Value), PaintingHourlyRateSource.Override);
        }

        if (input.LevelHourlyRate.HasValue)
        {
            return (Math.Max(0m, input.LevelHourlyRate.Value), PaintingHourlyRateSource.Level);
        }

        return (Math.Max(0m, input.DefaultHourlyRate), PaintingHourlyRateSource.Default);
    }

    private static PaintingChargeLine CalculatePreparation(PaintingPreparationCharge preparation, decimal laborAmount, decimal hourlyRate)
    {
        var value = Math.Max(0m, preparation.Value);
        return preparation.ChargeType switch
        {
            PaintingPreparationChargeType.Hourly => HourlyLine(preparation, value > 0m ? value : hourlyRate),
            PaintingPreparationChargeType.Percentage => Line(preparation.Id, preparation.Name, preparation.ChargeType.ToString(), 0m, laborAmount * value / 100m),
            PaintingPreparationChargeType.Manual => Line(preparation.Id, preparation.Name, preparation.ChargeType.ToString(), 0m, preparation.ManualAmount ?? value),
            _ => Line(preparation.Id, preparation.Name, preparation.ChargeType.ToString(), 0m, value)
        };
    }

    private static PaintingChargeLine HourlyLine(PaintingPreparationCharge preparation, decimal rate)
    {
        var hours = RoundHours(Math.Max(0m, preparation.HoursOverride ?? preparation.EstimatedHours));
        return Line(preparation.Id, preparation.Name, preparation.ChargeType.ToString(), hours, hours * rate);
    }

    private static PaintingChargeLine CalculateAddOn(PaintingAddOnCharge addOn, decimal laborAmount)
        => addOn.ChargeType switch
        {
            PaintingAddOnChargeType.Percentage => Line(addOn.Id, addOn.Name, addOn.ChargeType.ToString(), 0m, laborAmount * Math.Max(0m, addOn.Percentage) / 100m),
            PaintingAddOnChargeType.AdditionalHours => Line(addOn.Id, addOn.Name, addOn.ChargeType.ToString(), RoundHours(Math.Max(0m, addOn.AdditionalHours)), 0m),
            PaintingAddOnChargeType.Manual => Line(addOn.Id, addOn.Name, addOn.ChargeType.ToString(), 0m, addOn.ManualAmount ?? addOn.Value),
            _ => Line(addOn.Id, addOn.Name, addOn.ChargeType.ToString(), 0m, addOn.Value)
        };

    private static PaintingChargeLine Line(Guid id, string name, string chargeType, decimal hours, decimal amount)
        => new(id, name, chargeType, hours, Money(Math.Max(0m, amount)));

    private static decimal RoundUpToCents(decimal amount, decimal cents)
    {
        var candidate = Math.Floor(amount) + cents;
        return candidate >= amount ? candidate : candidate + 1m;
    }

    private static decimal Money(decimal value)
        => decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    private static decimal RoundHours(decimal value)
        => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
