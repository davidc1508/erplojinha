namespace Lojinha.Api.Entities;

public sealed class OutsourcedProduction : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid? CategoryId { get; set; }
    public ProductCategory? Category { get; set; }

    // Who produces the item
    public Guid ProducerSupplierId { get; set; }
    public Supplier? ProducerSupplier { get; set; }

    // Who will own/sell the item
    public Guid OwnerSupplierId { get; set; }
    public Supplier? OwnerSupplier { get; set; }

    // Production cost fields (mirrors Product)
    public int ItemsPerPlate { get; set; } = 1;
    public decimal EstimatedPrintTimeMinutes { get; set; }
    public decimal HeightCentimeters { get; set; }
    public decimal EstimatedWeightGrams { get; set; }
    public decimal LengthMetersUsed { get; set; }
    public decimal TariffPerKwh { get; set; }
    public decimal FinishingPercentage { get; set; }
    public Guid? PrinterProfileId { get; set; }
    public PrinterProfile? PrinterProfile { get; set; }
    public Guid? DefaultMarketplaceFeeId { get; set; }
    public MarketplaceFee? DefaultMarketplaceFee { get; set; }

    // Calculated costs
    public decimal ProductionCost { get; set; }
    public decimal ProductionFeePercentage { get; set; } = 50m;
    // ProductionCost * (1 + ProductionFeePercentage/100) — what the owner owes the producer
    public decimal SupplierCost { get; set; }

    public OutsourcedProductionStatus Status { get; set; } = OutsourcedProductionStatus.Pendente;

    public Guid? ConvertedProductId { get; set; }
    public Product? ConvertedProduct { get; set; }

    public OutsourcedProductionRecipe? Recipe { get; set; }
    public ICollection<OutsourcedProductionFilament> Filaments { get; set; } = [];
}
