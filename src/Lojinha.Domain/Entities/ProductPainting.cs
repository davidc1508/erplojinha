namespace Lojinha.Api.Entities;

public sealed class ProductPainting : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public bool Enabled { get; set; }
    public PaintingPricingMode Mode { get; set; } = PaintingPricingMode.Automatic;
    public PaintingExecution Execution { get; set; } = PaintingExecution.Internal;
    public PaintingPriceApplication Application { get; set; } = PaintingPriceApplication.IncorporatePrice;
    public decimal HeightCm { get; set; }
    public bool HeightOverridden { get; set; }
    public Guid? LevelId { get; set; }
    public Guid? ComplexityId { get; set; }
    public int CharacterCount { get; set; } = 1;
    public decimal? HoursOverride { get; set; }
    public decimal? HourlyRateOverride { get; set; }
    public decimal? MaterialsAmountOverride { get; set; }
    public decimal? PreparationAmountOverride { get; set; }
    public decimal? AddOnsAmountOverride { get; set; }
    public decimal? MarginPercentageOverride { get; set; }
    public decimal? FinalPriceOverride { get; set; }
    public string PreparationSelectionsJson { get; set; } = "[]";
    public string AddOnSelectionsJson { get; set; } = "[]";
    public string ExtraPreparationDescription { get; set; } = string.Empty;
    public decimal ExtraPreparationAmount { get; set; }
    public string FreeAddOnDescription { get; set; } = string.Empty;
    public decimal FreeAddOnQuantity { get; set; } = 1m;
    public decimal FreeAddOnUnitAmount { get; set; }
    public bool BaseNeedsPainting { get; set; }
    public PaintingBaseMode BaseMode { get; set; } = PaintingBaseMode.SameLevel;
    public Guid? BaseLevelId { get; set; }
    public decimal BaseHours { get; set; }
    public decimal BaseManualAmount { get; set; }
    public Guid? BaseAddOnId { get; set; }
    public Guid? OutsourcedSupplierId { get; set; }
    public decimal OutsourcedChargedAmount { get; set; }
    public decimal OutsourcedFreightAmount { get; set; }
    public decimal OutsourcedOtherCosts { get; set; }
    public decimal? OutsourcedIncorporatedPrice { get; set; }
    public decimal ManualCost { get; set; }
    public decimal ManualPrice { get; set; }
    public decimal ManualIncorporatedAmount { get; set; }
    public string Notes { get; set; } = string.Empty;
    public string ColorReferences { get; set; } = string.Empty;
    public bool NeedsReview { get; set; }
    public decimal CostAmount { get; set; }
    public decimal SuggestedPrice { get; set; }
    public decimal PriceUsed { get; set; }
    public decimal IncorporatedCost { get; set; }
    public decimal IncorporatedPrice { get; set; }
    public string SnapshotJson { get; set; } = string.Empty;
    public DateTime? CalculatedAtUtc { get; set; }
}
