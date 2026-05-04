namespace Lojinha.Api.Entities;

public sealed class Supply : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Unit { get; set; } = "g";
    public decimal CostPerUnit { get; set; }
    public decimal StockQuantity { get; set; }
    public decimal MinimumStock { get; set; }
    public string Notes { get; set; } = string.Empty;
    public ICollection<ProductRecipeItem> RecipeItems { get; set; } = new List<ProductRecipeItem>();

    public void EnsureStockAvailable(decimal quantity)
    {
        if (StockQuantity < quantity)
        {
            throw new InvalidOperationException($"Insumo insuficiente: {Name}.");
        }
    }

    public void DecreaseStock(decimal quantity)
    {
        EnsureStockAvailable(quantity);
        StockQuantity -= quantity;
    }
}