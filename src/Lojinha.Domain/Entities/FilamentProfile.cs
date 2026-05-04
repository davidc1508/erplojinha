namespace Lojinha.Api.Entities;

public sealed class FilamentProfile : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal SpoolWeightKg { get; set; }
    public decimal SpoolLengthMeters { get; set; }
    public decimal CostBRL { get; set; }
    public ICollection<ProductFilament> ProductFilaments { get; set; } = [];
}