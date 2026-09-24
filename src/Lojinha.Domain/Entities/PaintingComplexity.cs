namespace Lojinha.Api.Entities;

public sealed class PaintingComplexity : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Multiplier { get; set; } = 1m;
    public int Order { get; set; }
    public bool IsActive { get; set; } = true;
}
