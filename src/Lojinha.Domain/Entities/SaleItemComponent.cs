namespace Lojinha.Api.Entities;

public sealed class SaleItemComponent : BaseEntity
{
    public Guid SaleItemId { get; set; }
    public SaleItem? SaleItem { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid? SupplierId { get; set; }
    public decimal Quantity { get; set; }
    public decimal CostPrice { get; set; }
}