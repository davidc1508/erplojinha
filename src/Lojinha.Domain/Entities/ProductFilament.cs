namespace Lojinha.Api.Entities;

public sealed class ProductFilament : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid FilamentProfileId { get; set; }
    public FilamentProfile? FilamentProfile { get; set; }
    public decimal WeightGrams { get; set; }
}
