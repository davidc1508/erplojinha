using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Products;

public sealed record FilamentItemRequest(Guid FilamentProfileId, decimal WeightGrams);

public sealed record ProductFilamentDto(Guid FilamentProfileId, string FilamentName, decimal WeightGrams);

public sealed record ProductRequest(
    string Name,
    string Sku,
    string? Description,
    Guid CategoryId,
    Guid? SupplierId,
    bool GenerateProductionExpenseOnStockEntry,
    decimal CurrentStock,
    decimal MinimumStock,
    int ItemsPerPlate,
    decimal EstimatedPrintTimeMinutes,
    decimal HeightCentimeters,
    decimal LengthMetersUsed,
    decimal TariffPerKwh,
    decimal FinishingPercentage,
    decimal CommissionPercentage,
    Guid? PrinterProfileId,
    IReadOnlyList<FilamentItemRequest> Filaments,
    Guid? MarketplaceFeeId,
    decimal AdditionalCost,
    decimal DesiredMarkup,
    decimal? CostPrice,
    decimal? SalePrice);

public sealed record ProductDto(
    Guid Id,
    string Name,
    string Sku,
    string Description,
    Guid CategoryId,
    string Category,
    Guid? SupplierId,
    string? Supplier,
    bool GenerateProductionExpenseOnStockEntry,
    decimal CostPrice,
    decimal SalePrice,
    decimal SuggestedPrice,
    decimal DesiredMarkup,
    decimal ProfitMargin,
    decimal CurrentStock,
    decimal MinimumStock,
    int ItemsPerPlate,
    decimal EstimatedPrintTimeMinutes,
    decimal HeightCentimeters,
    decimal EstimatedWeightGrams,
    decimal LengthMetersUsed,
    decimal TariffPerKwh,
    decimal FinishingPercentage,
    decimal CommissionPercentage,
    decimal AdditionalCost,
    Guid? PrinterProfileId,
    IReadOnlyList<ProductFilamentDto> Filaments,
    string? Printer,
    string? Marketplace,
    Guid? MarketplaceFeeId,
    ProductLifecycleStatus LifecycleStatus = ProductLifecycleStatus.Disponivel);

public sealed record ProductPriceHistoryEntryDto(
    DateTime ChangedAtUtc,
    string ChangedBy,
    string Action,
    decimal? CostPrice,
    decimal? SalePrice,
    decimal? CurrentStock);

public sealed record DeleteProductErrorDto(string Message);

public sealed record CatalogItemDto(Guid Id, string Name);

public sealed record ProductMetadataDto(
    IReadOnlyList<CatalogItemDto> Categories,
    IReadOnlyList<CatalogItemDto> Suppliers,
    IReadOnlyList<CatalogItemDto> Printers,
    IReadOnlyList<CatalogItemDto> Filaments,
    IReadOnlyList<CatalogItemDto> Marketplaces,
    IReadOnlyList<CatalogItemDto> Supplies);

public sealed record PriceSuggestionDto(
    decimal CompositionCost,
    decimal TotalCost,
    decimal MaterialCost,
    decimal EnergyCost,
    decimal MaintenanceCost,
    decimal FailureCost,
    decimal FinishingCost,
    decimal LaborCost,
    decimal AdditionalCosts,
    decimal WholesalePrice,
    decimal RetailPrice,
    decimal ResellerPrice,
    decimal DesiredMarkup,
    decimal SuggestedPrice,
    decimal CommissionPercentage,
    decimal CommissionAmount,
    decimal SuggestedPriceWithCommission,
    decimal FinalPriceWithoutCommission,
    decimal FinalPriceWithCommission,
    decimal MarketplaceAdjustedPrice,
    decimal EstimatedMargin);