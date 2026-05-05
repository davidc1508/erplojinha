using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Contracts.Projects;
using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Personalized;

public sealed record PersonalizedPricingTierRequest(
    int Order,
    decimal MinSizeCm,
    decimal? MaxSizeCm,
    decimal FinishedPriceBRL,
    decimal UnpaintedPriceBRL,
    bool IsActive);

public sealed record PersonalizedPricingTierDto(
    Guid Id,
    int Order,
    decimal MinSizeCm,
    decimal? MaxSizeCm,
    decimal FinishedPriceBRL,
    decimal UnpaintedPriceBRL,
    bool IsActive);

public sealed record CreatePersonalizedProjectRequest(
    string Name,
    string? Description,
    decimal SizeMinCm,
    decimal SizeMaxCm,
    bool IsPainted);

public sealed record UpdatePersonalizedBudgetRequest(
    decimal SizeMinCm,
    decimal SizeMaxCm,
    bool IsPainted);

public sealed record RejectPersonalizedBudgetRequest(
    string? Reason);

public sealed record PersonalizedPrintProductRequest(
    decimal RealSizeCm,
    string Name,
    string? Sku,
    string? Description,
    Guid? SupplierId,
    bool GenerateProductionExpenseOnStockEntry,
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

public sealed record CompletePersonalizedPrintingRequest(
    decimal TimeRealMinutes,
    decimal ProducedQuantity);

public sealed record CompletePersonalizedFinishingRequest(
    decimal TimeRealMinutes);

public sealed record FinalizePersonalizedProjectRequest(
    PaymentMethod PaymentMethod,
    DateTime? SoldAtUtc,
    decimal Quantity,
    string? Notes);

public sealed record PersonalizedProjectDto(
    ProjectDto Project,
    ProductDto? Product,
    Guid? SaleId);
