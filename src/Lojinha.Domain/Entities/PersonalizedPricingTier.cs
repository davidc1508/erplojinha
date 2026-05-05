namespace Lojinha.Api.Entities;

public sealed class PersonalizedPricingTier : AuditableEntity
{
    public int Order { get; set; }
    public decimal MinSizeCm { get; set; }
    public decimal? MaxSizeCm { get; set; }
    public decimal FinishedPriceBRL { get; set; }
    public decimal UnpaintedPriceBRL { get; set; }
    public bool IsActive { get; set; } = true;
}
