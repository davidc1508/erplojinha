namespace Lojinha.Api.Entities;

public sealed class ProductRecipe : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal LaborHours { get; set; }
    public decimal LaborCostPerHour { get; set; }
    public decimal AdditionalCosts { get; set; }
    public decimal WholesaleMarkup { get; set; }
    public decimal RetailMarkup { get; set; }
    public decimal ResellerMarkup { get; set; }
    public decimal TotalCost { get; set; }
    public ICollection<ProductRecipeItem> Items { get; set; } = new List<ProductRecipeItem>();
}