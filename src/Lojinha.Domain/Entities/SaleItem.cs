namespace Lojinha.Api.Entities;

public sealed class SaleItem : BaseEntity
{
    public Guid SaleId { get; set; }
    public Sale? Sale { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal CostPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal LojinhaGainPercentage { get; set; }
    public decimal LojinhaGainAmount { get; set; }
    public bool IsCommissionedSale { get; set; }
    public Guid? CommissionSellerSupplierId { get; set; }
    public Supplier? CommissionSellerSupplier { get; set; }
    public decimal CommissionAmount { get; set; }
}