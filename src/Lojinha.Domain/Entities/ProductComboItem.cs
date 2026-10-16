namespace Lojinha.Api.Entities;

public sealed class ProductComboItem : BaseEntity
{
    public Guid ComboId { get; set; }
    public Product? Combo { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal Quantity { get; set; }
}