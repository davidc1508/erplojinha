namespace Lojinha.Api.Entities;

public sealed class OutsourcedProductionFilament : BaseEntity
{
    public Guid OutsourcedProductionId { get; set; }
    public OutsourcedProduction? OutsourcedProduction { get; set; }
    public Guid FilamentProfileId { get; set; }
    public FilamentProfile? FilamentProfile { get; set; }
    public decimal WeightGrams { get; set; }
}
