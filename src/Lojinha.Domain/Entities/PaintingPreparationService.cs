namespace Lojinha.Api.Entities;

public sealed class PaintingPreparationService : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public PaintingPreparationChargeType ChargeType { get; set; } = PaintingPreparationChargeType.FixedAmount;
    public decimal Value { get; set; }
    public decimal EstimatedHours { get; set; }
    public bool IsActive { get; set; } = true;
}
