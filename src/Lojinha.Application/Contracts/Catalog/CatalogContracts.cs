namespace Lojinha.Api.Contracts.Catalog;

public sealed record ProductCategoryRequest(string Name, string Description, string ColorHex);

public sealed record ProductCategoryDto(Guid Id, int NumericIdentifier, string Name, string Description, string ColorHex);

public sealed record PrinterProfileRequest(
    string Name,
    string Brand,
    decimal ReturnMonths,
    decimal MachineCost,
    decimal WorkHoursPerDay,
    decimal WorkingDaysPerMonth,
    decimal PowerKw,
    string UsageLevel,
    decimal FailureRate);

public sealed record PrinterProfileDto(
    Guid Id,
    string Name,
    string Brand,
    decimal ReturnMonths,
    decimal MachineCost,
    decimal WorkHoursPerDay,
    decimal WorkingDaysPerMonth,
    decimal PowerKw,
    string UsageLevel,
    decimal FailureRate);

public sealed record BottonSizeRequest(
    string Name,
    decimal CostPerUnit,
    decimal StockQuantity,
    decimal MinimumStock,
    string? Notes);

public sealed record BottonSizeDto(
    Guid Id,
    string Name,
    decimal CostPerUnit,
    decimal StockQuantity,
    decimal MinimumStock,
    string Notes);