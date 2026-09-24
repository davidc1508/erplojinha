namespace Lojinha.Api.Entities;

public sealed class PaintingMaterial : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public PaintingMaterialCategory Category { get; set; } = PaintingMaterialCategory.Outros;
    public string Unit { get; set; } = string.Empty;
    public decimal UnitCost { get; set; }
    public decimal DefaultQuantity { get; set; }
    public bool IsActive { get; set; } = true;
}
