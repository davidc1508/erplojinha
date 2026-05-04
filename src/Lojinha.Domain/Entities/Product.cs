namespace Lojinha.Api.Entities;

public sealed class Product : AuditableEntity
{
    public int NumericIdentifier { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public string Description { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
    public ProductCategory? Category { get; set; }
    public Guid? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    public decimal CostPrice { get; set; }
    public decimal SalePrice { get; set; }
    public decimal SuggestedPrice { get; set; }
    public decimal ProfitMargin { get; set; }
    public bool GenerateProductionExpenseOnStockEntry { get; set; }
    public decimal CurrentStock { get; set; }
    public decimal MinimumStock { get; set; }
    public int ItemsPerPlate { get; set; } = 1;
    public decimal EstimatedPrintTimeMinutes { get; set; }
    public decimal HeightCentimeters { get; set; }
    public decimal EstimatedWeightGrams { get; set; }
    public decimal LengthMetersUsed { get; set; }
    public decimal TariffPerKwh { get; set; }
    public decimal FinishingPercentage { get; set; }
    public decimal CommissionPercentage { get; set; }
    public Guid? PrinterProfileId { get; set; }
    public PrinterProfile? PrinterProfile { get; set; }
    public Guid? DefaultMarketplaceFeeId { get; set; }
    public MarketplaceFee? DefaultMarketplaceFee { get; set; }
    public ProductRecipe? Recipe { get; set; }
    public ICollection<SaleItem> SaleItems { get; set; } = new List<SaleItem>();
    public ICollection<ProductFilament> Filaments { get; set; } = [];

    public void DecreaseStock(decimal quantity)
    {
        CurrentStock = Math.Max(0, CurrentStock - quantity);
    }
}