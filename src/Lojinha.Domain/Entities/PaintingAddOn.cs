namespace Lojinha.Api.Entities;

public sealed class PaintingAddOn : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public PaintingAddOnChargeType ChargeType { get; set; } = PaintingAddOnChargeType.FixedAmount;
    public decimal Value { get; set; }
    public decimal Percentage { get; set; }
    public decimal AdditionalHours { get; set; }
    public bool IsActive { get; set; } = true;
}
