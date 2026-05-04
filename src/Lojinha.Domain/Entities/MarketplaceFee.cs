namespace Lojinha.Api.Entities;

public sealed class MarketplaceFee : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public decimal FixedFee { get; set; }
    public decimal PercentageFee { get; set; }
    public ICollection<Product> Products { get; set; } = new List<Product>();
}