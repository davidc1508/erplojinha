namespace Lojinha.Api.Entities;

public sealed class ProductRecipeItem : BaseEntity
{
    public Guid ProductRecipeId { get; set; }
    public ProductRecipe? ProductRecipe { get; set; }
    public Guid SupplyId { get; set; }
    public Supply? Supply { get; set; }
    public decimal Quantity { get; set; }
}