using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Finance;

public sealed record CreateFinancialEntryRequest(
    FinancialEntryType Type,
    FinancialClassification Classification,
    string Category,
    string Description,
    decimal Amount,
    DateTime? OccurredOnUtc,
    Guid? SupplierId,
    Guid? ReferenceId);

public sealed record FinancialEntryDto(
    Guid Id,
    FinancialEntryType Type,
    FinancialClassification Classification,
    string Category,
    string Description,
    decimal Amount,
    DateTime OccurredOnUtc,
    Guid? SupplierId,
    string? SupplierName,
    Guid? ReferenceId);

public sealed record MonthlySeriesPointDto(string Label, decimal Value);

public sealed record CategoryBreakdownDto(string Category, decimal Amount);

public sealed record FinanceReportDto(
    decimal Revenue,
    decimal Expenses,
    decimal Profit,
    IReadOnlyList<MonthlySeriesPointDto> MonthlySeries,
    IReadOnlyList<CategoryBreakdownDto> Categories);