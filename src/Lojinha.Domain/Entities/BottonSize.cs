namespace Lojinha.Api.Entities;

public sealed class BottonSize : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public decimal CostPerUnit { get; set; }
    public decimal StockQuantity { get; set; }
    public decimal MinimumStock { get; set; }
    public string Notes { get; set; } = string.Empty;
    public ICollection<Product> Products { get; set; } = new List<Product>();

    public void DecreaseStock(decimal quantity)
    {
        if (quantity <= 0m)
        {
            return;
        }

        StockQuantity = Math.Max(0m, StockQuantity - quantity);
    }

    public void IncreaseStock(decimal quantity)
    {
        if (quantity <= 0m)
        {
            return;
        }

        StockQuantity += quantity;
    }
}
