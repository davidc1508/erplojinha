using Lojinha.Api.Contracts.Dashboard;
using Lojinha.Api.Contracts.Sales;
using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Fairs;

public sealed record FairSupplierDto(Guid SupplierId, string SupplierName);

public sealed record FairRegistrationInstallmentRequest(DateTime DueDateUtc, decimal Amount);

public sealed record FairRequest(
    string Name,
    DateTime EventDateUtc,
    DateTime EndDateUtc,
    string Location,
    decimal RegistrationFee,
    int RegistrationFeeSplitCount,
    DateTime RegistrationPaymentStartDateUtc,
    IReadOnlyList<FairRegistrationInstallmentRequest> RegistrationInstallments,
    IReadOnlyList<Guid>? SupplierIds,
    string? Notes);

public sealed record FairDto(
    Guid Id,
    string Name,
    DateTime EventDateUtc,
    DateTime EndDateUtc,
    string Location,
    decimal RegistrationFee,
    int RegistrationFeeSplitCount,
    IReadOnlyList<FairSupplierDto> Suppliers,
    decimal StoreRegistrationFee,
    string Notes,
    FairStatus Status,
    DateTime? FinalizedAtUtc,
    int TotalSales,
    decimal GrossRevenue,
    decimal NetRevenue,
    decimal PiggyBankAmount);

public sealed record FairReportSeriesDto(string Label, decimal GrossRevenue, decimal NetRevenue, decimal ItemsSold);

public sealed record FairSupplierQuotaStatusDto(
    Guid SupplierId,
    string SupplierName,
    decimal QuotaAmount,
    decimal PaidAmount,
    decimal OutstandingAmount,
    bool IsSettled);

public sealed record FairReportDto(
    Guid FairId,
    string FairName,
    FairStatus Status,
    DateTime EventDateUtc,
    DateTime EndDateUtc,
    string Location,
    decimal RegistrationFee,
    int RegistrationFeeSplitCount,
    IReadOnlyList<FairSupplierDto> Suppliers,
    decimal StoreRegistrationFee,
    decimal GrossRevenue,
    decimal NetRevenue,
    decimal PiggyBankAmount,
    decimal Result,
    decimal TotalItemsSold,
    IReadOnlyList<FairSupplierQuotaStatusDto> SupplierQuotaStatus,
    IReadOnlyList<TopProductDto> TopProducts,
    IReadOnlyList<SaleDto> Sales,
    IReadOnlyList<FairReportSeriesDto> Series);