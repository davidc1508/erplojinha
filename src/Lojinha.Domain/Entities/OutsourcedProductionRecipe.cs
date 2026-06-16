namespace Lojinha.Api.Entities;

public sealed class OutsourcedProductionRecipe : AuditableEntity
{
    public Guid OutsourcedProductionId { get; set; }
    public OutsourcedProduction? OutsourcedProduction { get; set; }
    public decimal LaborHours { get; set; }
    public decimal LaborCostPerHour { get; set; }
    public decimal AdditionalCosts { get; set; }
    public decimal WholesaleMarkup { get; set; }
    public decimal RetailMarkup { get; set; }
    public decimal ResellerMarkup { get; set; }
    public decimal TotalCost { get; set; }
}
