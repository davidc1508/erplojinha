using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.PaintingPricing;

public sealed record UpdatePaintingSettingsRequest(
    decimal DefaultHourlyRate,
    decimal DefaultMaterialsPercentage,
    decimal MinimumMaterialsAmount,
    decimal MinimumPaintingPrice,
    decimal DefaultMarginPercentage,
    PaintingPriceRounding Rounding);

public sealed record PaintingSettingsDto(
    decimal DefaultHourlyRate,
    decimal DefaultMaterialsPercentage,
    decimal MinimumMaterialsAmount,
    decimal MinimumPaintingPrice,
    decimal DefaultMarginPercentage,
    PaintingPriceRounding Rounding,
    DateTime UpdatedAtUtc);

public sealed record PaintingLevelRequest(
    string Name,
    string? Description,
    decimal? HourlyRate,
    int Order,
    bool IsActive);

public sealed record PaintingLevelDto(
    Guid Id,
    string Name,
    string Description,
    decimal? HourlyRate,
    decimal EffectiveHourlyRate,
    int Order,
    bool IsActive);

public sealed record PaintingComplexityRequest(
    string Name,
    string? Description,
    decimal Multiplier,
    int Order,
    bool IsActive);

public sealed record PaintingComplexityDto(
    Guid Id,
    string Name,
    string Description,
    decimal Multiplier,
    int Order,
    bool IsActive);

public sealed record PaintingSizeRangeHoursRequest(
    Guid LevelId,
    decimal Hours);

public sealed record PaintingSizeRangeRequest(
    string Name,
    decimal MinHeightCm,
    decimal? MaxHeightCm,
    bool RequiresManualReview,
    int Order,
    bool IsActive,
    IReadOnlyList<PaintingSizeRangeHoursRequest>? Hours);

public sealed record PaintingSizeRangeHoursDto(
    Guid LevelId,
    decimal Hours);

public sealed record PaintingSizeRangeDto(
    Guid Id,
    string Name,
    decimal MinHeightCm,
    decimal? MaxHeightCm,
    bool RequiresManualReview,
    int Order,
    bool IsActive,
    IReadOnlyList<PaintingSizeRangeHoursDto> Hours);

public sealed record PaintingPreparationServiceRequest(
    string Name,
    string? Description,
    PaintingPreparationChargeType ChargeType,
    decimal Value,
    decimal EstimatedHours,
    bool IsActive);

public sealed record PaintingPreparationServiceDto(
    Guid Id,
    string Name,
    string Description,
    PaintingPreparationChargeType ChargeType,
    decimal Value,
    decimal EstimatedHours,
    bool IsActive);

public sealed record PaintingMaterialRequest(
    string Name,
    PaintingMaterialCategory Category,
    string? Unit,
    decimal UnitCost,
    decimal DefaultQuantity,
    bool IsActive);

public sealed record PaintingMaterialDto(
    Guid Id,
    string Name,
    PaintingMaterialCategory Category,
    string Unit,
    decimal UnitCost,
    decimal DefaultQuantity,
    bool IsActive);

public sealed record PaintingAddOnRequest(
    string Name,
    string? Description,
    PaintingAddOnChargeType ChargeType,
    decimal Value,
    decimal Percentage,
    decimal AdditionalHours,
    bool IsActive);

public sealed record PaintingAddOnDto(
    Guid Id,
    string Name,
    string Description,
    PaintingAddOnChargeType ChargeType,
    decimal Value,
    decimal Percentage,
    decimal AdditionalHours,
    bool IsActive);

public sealed record PaintingPricingOverviewDto(
    PaintingSettingsDto Settings,
    IReadOnlyList<PaintingLevelDto> Levels,
    IReadOnlyList<PaintingComplexityDto> Complexities,
    IReadOnlyList<PaintingSizeRangeDto> SizeRanges,
    IReadOnlyList<PaintingPreparationServiceDto> PreparationServices,
    IReadOnlyList<PaintingMaterialDto> Materials,
    IReadOnlyList<PaintingAddOnDto> AddOns);

public sealed record PaintingItemSelectionRequest(
    Guid Id,
    decimal? ManualAmount,
    decimal? Hours);

public sealed record PaintingPricingCalculationRequest(
    decimal HeightCm,
    Guid LevelId,
    Guid ComplexityId,
    IReadOnlyList<PaintingItemSelectionRequest>? Preparations,
    IReadOnlyList<PaintingItemSelectionRequest>? AddOns,
    decimal? HoursOverride,
    decimal? HourlyRateOverride,
    decimal? MaterialsPercentageOverride,
    decimal? MaterialsAmountOverride,
    decimal? PreparationAmountOverride,
    decimal? AddOnsAmountOverride,
    decimal? MarginPercentageOverride,
    decimal? FinalPriceOverride,
    PaintingBaseRequest? Base = null,
    PaintingOutsourcedRequest? Outsourced = null,
    PaintingExtraChargeRequest? ExtraPreparation = null,
    PaintingExtraChargeRequest? FreeAddOn = null);

public sealed record PaintingBaseRequest(
    PaintingBaseMode Mode,
    Guid? LevelId,
    decimal Hours,
    decimal ManualAmount,
    Guid? AddOnId);

public sealed record PaintingOutsourcedRequest(
    decimal ChargedAmount,
    decimal FreightAmount,
    decimal OtherCosts,
    decimal? IncorporatedPrice);

public sealed record PaintingExtraChargeRequest(
    string? Description,
    decimal Quantity,
    decimal UnitAmount);

public sealed record PaintingReferenceDto(
    Guid Id,
    string Name);

public sealed record PaintingSizeRangeReferenceDto(
    Guid Id,
    string Name,
    decimal MinHeightCm,
    decimal? MaxHeightCm,
    bool RequiresManualReview);

public sealed record PaintingChargeLineDto(
    Guid Id,
    string Name,
    string ChargeType,
    decimal Hours,
    decimal Amount);

public sealed record PaintingPricingResultDto(
    decimal HeightCm,
    PaintingReferenceDto Level,
    PaintingReferenceDto Complexity,
    PaintingSizeRangeReferenceDto? SizeRange,
    decimal BaseHours,
    decimal ComplexityMultiplier,
    decimal EstimatedHours,
    bool HoursOverridden,
    decimal AddOnHours,
    decimal TotalHours,
    decimal HourlyRate,
    string HourlyRateSource,
    decimal LaborAmount,
    decimal MaterialsPercentage,
    decimal MinimumMaterialsAmount,
    decimal MaterialsAmount,
    bool MaterialsMinimumApplied,
    bool MaterialsOverridden,
    IReadOnlyList<PaintingChargeLineDto> Preparations,
    decimal PreparationAmount,
    bool PreparationOverridden,
    IReadOnlyList<PaintingChargeLineDto> AddOns,
    decimal AddOnsAmount,
    bool AddOnsOverridden,
    decimal BaseAmount,
    bool IsOutsourced,
    decimal OutsourcedAmount,
    decimal CostAmount,
    decimal MarginPercentage,
    decimal MarginAmount,
    decimal CalculatedAmount,
    decimal MinimumPaintingPrice,
    bool MinimumPriceApplied,
    PaintingPriceRounding Rounding,
    decimal SuggestedPrice,
    decimal FinalPrice,
    bool FinalPriceOverridden,
    IReadOnlyList<string> Warnings,
    DateTime CalculatedAtUtc,
    decimal MaterialsByPercentageAmount = 0m);

public sealed record PaintingHistoryChangeDto(
    string Field,
    string? Before,
    string? After);

public sealed record PaintingHistoryEntryDto(
    Guid Id,
    string EntityType,
    string EntityId,
    string Name,
    AuditAction Action,
    string ChangedBy,
    DateTime ChangedAtUtc,
    IReadOnlyList<PaintingHistoryChangeDto> Changes);

public sealed record ProductPaintingRequest
{
    public bool Enabled { get; init; }
    public PaintingPricingMode Mode { get; init; } = PaintingPricingMode.Automatic;
    public PaintingExecution Execution { get; init; } = PaintingExecution.Internal;
    public PaintingPriceApplication Application { get; init; } = PaintingPriceApplication.IncorporatePrice;
    public decimal HeightCm { get; init; }
    public bool HeightOverridden { get; init; }
    public Guid? LevelId { get; init; }
    public Guid? ComplexityId { get; init; }
    public int CharacterCount { get; init; } = 1;
    public decimal? HoursOverride { get; init; }
    public decimal? HourlyRateOverride { get; init; }
    public decimal? MaterialsAmountOverride { get; init; }
    public decimal? PreparationAmountOverride { get; init; }
    public decimal? AddOnsAmountOverride { get; init; }
    public decimal? MarginPercentageOverride { get; init; }
    public decimal? FinalPriceOverride { get; init; }
    public IReadOnlyList<PaintingItemSelectionRequest> Preparations { get; init; } = [];
    public IReadOnlyList<PaintingItemSelectionRequest> AddOns { get; init; } = [];
    public string? ExtraPreparationDescription { get; init; }
    public decimal ExtraPreparationAmount { get; init; }
    public string? FreeAddOnDescription { get; init; }
    public decimal FreeAddOnQuantity { get; init; } = 1m;
    public decimal FreeAddOnUnitAmount { get; init; }
    public bool BaseNeedsPainting { get; init; }
    public PaintingBaseMode BaseMode { get; init; } = PaintingBaseMode.SameLevel;
    public Guid? BaseLevelId { get; init; }
    public decimal BaseHours { get; init; }
    public decimal BaseManualAmount { get; init; }
    public Guid? BaseAddOnId { get; init; }
    public Guid? OutsourcedSupplierId { get; init; }
    public decimal OutsourcedChargedAmount { get; init; }
    public decimal OutsourcedFreightAmount { get; init; }
    public decimal OutsourcedOtherCosts { get; init; }
    public decimal? OutsourcedIncorporatedPrice { get; init; }
    public decimal ManualCost { get; init; }
    public decimal ManualPrice { get; init; }
    public decimal ManualIncorporatedAmount { get; init; }
    public string? Notes { get; init; }
    public string? ColorReferences { get; init; }
    public bool NeedsReview { get; init; }
    public bool KeepStoredSnapshot { get; init; }
    public Guid? SourceProductId { get; init; }
}

public sealed record ProductPaintingCalculationDto(
    PaintingPricingMode Mode,
    PaintingExecution Execution,
    PaintingPriceApplication Application,
    decimal CostAmount,
    decimal SuggestedPrice,
    decimal PriceUsed,
    decimal IncorporatedCost,
    decimal IncorporatedPrice,
    PaintingPricingResultDto? Details,
    bool FromStoredSnapshot,
    DateTime CalculatedAtUtc);

public sealed record ProductPaintingDto(
    ProductPaintingRequest Configuration,
    ProductPaintingCalculationDto? Snapshot,
    string? LevelName,
    string? ComplexityName,
    decimal TotalHours,
    bool HasNewerParameters);

public sealed record ProductPaintingRecalculationDto(
    ProductPaintingCalculationDto? Stored,
    ProductPaintingCalculationDto Recalculated,
    decimal CostDifference,
    decimal PriceDifference,
    bool HasDifferences);
