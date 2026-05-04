namespace Lojinha.Api.Entities;

public sealed class ProductCategory : AuditableEntity
{
    public int NumericIdentifier { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ColorHex { get; set; } = "#f5b2c5";
    public ICollection<Product> Products { get; set; } = new List<Product>();
}