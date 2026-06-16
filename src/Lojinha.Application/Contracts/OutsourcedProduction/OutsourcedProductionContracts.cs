using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.OutsourcedProduction;

public sealed record OutsourcedProductionFilamentRequest(Guid FilamentProfileId, decimal WeightGrams);

public sealed record OutsourcedProductionRequest(
    string Name,
    string? Description,
    Guid? CategoryId,
    Guid? ProducerSupplierId,
    Guid OwnerSupplierId,
    int ItemsPerPlate,
    decimal EstimatedPrintTimeMinutes,
    decimal HeightCentimeters,
    decimal LengthMetersUsed,
    decimal TariffPerKwh,
    decimal FinishingPercentage,
    decimal AdditionalCost,
    Guid? PrinterProfileId,
    IReadOnlyList<OutsourcedProductionFilamentRequest> Filaments,
    Guid? MarketplaceFeeId,
    decimal DesiredMarkup,
    decimal ProductionFeePercentage);

public sealed record ConvertToProductRequest(
    decimal? SalePrice,
    decimal? FinishingPercentage,
    decimal? CommissionPercentage,
    decimal? DesiredMarkup,
    bool IncludeProductionFeeAsAdditionalCost);

public sealed record OutsourcedProductionFilamentDto(
    Guid FilamentProfileId,
    string FilamentName,
    decimal WeightGrams);

public sealed record OutsourcedProductionDto(
    Guid Id,
    string Name,
    string Description,
    Guid? CategoryId,
    string? Category,
    Guid? ProducerSupplierId,
    string ProducerSupplier,
    Guid OwnerSupplierId,
    string OwnerSupplier,
    int ItemsPerPlate,
    decimal EstimatedPrintTimeMinutes,
    decimal HeightCentimeters,
    decimal EstimatedWeightGrams,
    decimal LengthMetersUsed,
    decimal TariffPerKwh,
    decimal FinishingPercentage,
    decimal AdditionalCost,
    Guid? PrinterProfileId,
    string? Printer,
    IReadOnlyList<OutsourcedProductionFilamentDto> Filaments,
    Guid? MarketplaceFeeId,
    string? Marketplace,
    decimal DesiredMarkup,
    decimal ProductionFeePercentage,
    decimal ProductionCost,
    decimal SupplierCost,
    OutsourcedProductionStatus Status,
    Guid? ConvertedProductId,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);
