using System.Text.Json;
using Lojinha.Api.Contracts.PaintingPricing;
using Lojinha.Api.Entities;

namespace Lojinha.Api.Services;

public static class ProductPaintingMapper
{
    public static ProductPaintingRequest ToRequest(ProductPainting painting)
        => new()
        {
            Enabled = painting.Enabled,
            Mode = painting.Mode,
            Execution = painting.Execution,
            Application = painting.Application,
            HeightCm = painting.HeightCm,
            HeightOverridden = painting.HeightOverridden,
            LevelId = painting.LevelId,
            ComplexityId = painting.ComplexityId,
            CharacterCount = painting.CharacterCount,
            HoursOverride = painting.HoursOverride,
            HourlyRateOverride = painting.HourlyRateOverride,
            MaterialsAmountOverride = painting.MaterialsAmountOverride,
            PreparationAmountOverride = painting.PreparationAmountOverride,
            AddOnsAmountOverride = painting.AddOnsAmountOverride,
            MarginPercentageOverride = painting.MarginPercentageOverride,
            FinalPriceOverride = painting.FinalPriceOverride,
            Preparations = ReadSelections(painting.PreparationSelectionsJson),
            AddOns = ReadSelections(painting.AddOnSelectionsJson),
            ExtraPreparationDescription = painting.ExtraPreparationDescription,
            ExtraPreparationAmount = painting.ExtraPreparationAmount,
            FreeAddOnDescription = painting.FreeAddOnDescription,
            FreeAddOnQuantity = painting.FreeAddOnQuantity,
            FreeAddOnUnitAmount = painting.FreeAddOnUnitAmount,
            BaseNeedsPainting = painting.BaseNeedsPainting,
            BaseMode = painting.BaseMode,
            BaseLevelId = painting.BaseLevelId,
            BaseHours = painting.BaseHours,
            BaseManualAmount = painting.BaseManualAmount,
            BaseAddOnId = painting.BaseAddOnId,
            OutsourcedSupplierId = painting.OutsourcedSupplierId,
            OutsourcedChargedAmount = painting.OutsourcedChargedAmount,
            OutsourcedFreightAmount = painting.OutsourcedFreightAmount,
            OutsourcedOtherCosts = painting.OutsourcedOtherCosts,
            OutsourcedIncorporatedPrice = painting.OutsourcedIncorporatedPrice,
            ManualCost = painting.ManualCost,
            ManualPrice = painting.ManualPrice,
            ManualIncorporatedAmount = painting.ManualIncorporatedAmount,
            Notes = painting.Notes,
            ColorReferences = painting.ColorReferences,
            NeedsReview = painting.NeedsReview,
            SourceProductId = painting.ProductId
        };

    public static void Apply(ProductPainting painting, ProductPaintingRequest request, ProductPaintingCalculationDto? calculation)
    {
        painting.Enabled = request.Enabled;
        painting.Mode = request.Mode;
        painting.Execution = request.Execution;
        painting.Application = request.Application;
        painting.HeightCm = Money(request.HeightCm);
        painting.HeightOverridden = request.HeightOverridden;
        painting.LevelId = request.LevelId;
        painting.ComplexityId = request.ComplexityId;
        painting.CharacterCount = Math.Max(1, request.CharacterCount);
        painting.HoursOverride = request.HoursOverride;
        painting.HourlyRateOverride = request.HourlyRateOverride;
        painting.MaterialsAmountOverride = request.MaterialsAmountOverride;
        painting.PreparationAmountOverride = request.PreparationAmountOverride;
        painting.AddOnsAmountOverride = request.AddOnsAmountOverride;
        painting.MarginPercentageOverride = request.MarginPercentageOverride;
        painting.FinalPriceOverride = request.FinalPriceOverride;
        painting.PreparationSelectionsJson = JsonSerializer.Serialize(request.Preparations ?? []);
        painting.AddOnSelectionsJson = JsonSerializer.Serialize(request.AddOns ?? []);
        painting.ExtraPreparationDescription = request.ExtraPreparationDescription?.Trim() ?? string.Empty;
        painting.ExtraPreparationAmount = Money(request.ExtraPreparationAmount);
        painting.FreeAddOnDescription = request.FreeAddOnDescription?.Trim() ?? string.Empty;
        painting.FreeAddOnQuantity = Math.Max(1m, request.FreeAddOnQuantity);
        painting.FreeAddOnUnitAmount = Money(request.FreeAddOnUnitAmount);
        painting.BaseNeedsPainting = request.BaseNeedsPainting;
        painting.BaseMode = request.BaseMode;
        painting.BaseLevelId = request.BaseLevelId;
        painting.BaseHours = Money(request.BaseHours);
        painting.BaseManualAmount = Money(request.BaseManualAmount);
        painting.BaseAddOnId = request.BaseAddOnId;
        painting.OutsourcedSupplierId = request.OutsourcedSupplierId;
        painting.OutsourcedChargedAmount = Money(request.OutsourcedChargedAmount);
        painting.OutsourcedFreightAmount = Money(request.OutsourcedFreightAmount);
        painting.OutsourcedOtherCosts = Money(request.OutsourcedOtherCosts);
        painting.OutsourcedIncorporatedPrice = request.OutsourcedIncorporatedPrice;
        painting.ManualCost = Money(request.ManualCost);
        painting.ManualPrice = Money(request.ManualPrice);
        painting.ManualIncorporatedAmount = Money(request.ManualIncorporatedAmount);
        painting.Notes = request.Notes?.Trim() ?? string.Empty;
        painting.ColorReferences = request.ColorReferences?.Trim() ?? string.Empty;
        painting.NeedsReview = request.NeedsReview;

        if (calculation is null)
        {
            painting.IncorporatedCost = 0m;
            painting.IncorporatedPrice = 0m;
            return;
        }

        painting.CostAmount = calculation.CostAmount;
        painting.SuggestedPrice = calculation.SuggestedPrice;
        painting.PriceUsed = calculation.PriceUsed;
        painting.IncorporatedCost = calculation.IncorporatedCost;
        painting.IncorporatedPrice = calculation.IncorporatedPrice;
        if (!calculation.FromStoredSnapshot || string.IsNullOrEmpty(painting.SnapshotJson))
        {
            painting.SnapshotJson = JsonSerializer.Serialize(calculation);
            painting.CalculatedAtUtc = calculation.CalculatedAtUtc;
        }
    }

    public static ProductPaintingCalculationDto? ReadSnapshot(ProductPainting painting)
    {
        if (string.IsNullOrWhiteSpace(painting.SnapshotJson))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<ProductPaintingCalculationDto>(painting.SnapshotJson);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static ProductPaintingDto ToDto(ProductPainting painting, bool hasNewerParameters)
    {
        var snapshot = ReadSnapshot(painting);
        return new ProductPaintingDto(
            ToRequest(painting),
            snapshot,
            snapshot?.Details?.Level.Name,
            snapshot?.Details?.Complexity.Name,
            snapshot?.Details?.TotalHours ?? 0m,
            hasNewerParameters);
    }

    private static IReadOnlyList<PaintingItemSelectionRequest> ReadSelections(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<PaintingItemSelectionRequest>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static decimal Money(decimal value)
        => decimal.Round(Math.Max(0m, value), 2, MidpointRounding.AwayFromZero);
}
