using Lojinha.Api.Application.Abstractions;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.Fairs;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Application.Features.Fairs;

public sealed record GetFairsQuery(Guid? SupplierId = null) : IQuery<IReadOnlyList<FairDto>>;

public sealed class GetFairsQueryHandler(IFairRepository fairRepository, IAppCache cache) : IQueryHandler<GetFairsQuery, IReadOnlyList<FairDto>>
{
    public async Task<IReadOnlyList<FairDto>> HandleAsync(GetFairsQuery query, CancellationToken cancellationToken = default)
        => await cache.GetOrCreateAsync(
            AppCacheKeys.Fairs(query.SupplierId),
            async token => (IReadOnlyList<FairDto>)(await fairRepository.GetAllDetailedAsync(token)).Select(fair => fair.ToDto(query.SupplierId)).ToList(),
            AppCacheDurations.Fairs,
            cancellationToken);
}

public sealed record GetFairByIdQuery(Guid FairId) : IQuery<FairDto?>;

public sealed class GetFairByIdQueryHandler(IFairRepository fairRepository) : IQueryHandler<GetFairByIdQuery, FairDto?>
{
    public async Task<FairDto?> HandleAsync(GetFairByIdQuery query, CancellationToken cancellationToken = default)
    {
        var fair = await fairRepository.GetDetailedByIdAsync(query.FairId, cancellationToken);
        return fair?.ToDto();
    }
}

public sealed record GetFairReportQuery(Guid FairId) : IQuery<FairReportDto?>;

public sealed class GetFairReportQueryHandler(
    IFairRepository fairRepository,
    IRepository<FinancialEntry> financeRepository) : IQueryHandler<GetFairReportQuery, FairReportDto?>
{
    private const string SupplierFairPayableCategory = "Contas a pagar de feiras";
    private const string SupplierFairLegacyPendingCategory = "Pendencia de pagamento em feiras";
    private const string SupplierFairPaymentCategory = "Pagamento de cota de feira";

    public async Task<FairReportDto?> HandleAsync(GetFairReportQuery query, CancellationToken cancellationToken = default)
    {
        var fair = await fairRepository.GetDetailedByIdAsync(query.FairId, cancellationToken);
        if (fair is null)
        {
            return null;
        }

        var financialEntries = financeRepository.Query()
            .Where(entry => entry.ReferenceId == fair.Id && entry.SupplierId.HasValue)
            .Select(entry => new
            {
                entry.SupplierId,
                entry.Category,
                entry.Amount,
                entry.Type
            })
            .ToList();

        var supplierQuotaStatus = fair.Suppliers
            .OrderBy(link => link.Supplier!.Name)
            .Select(link =>
            {
                var supplierId = link.SupplierId;
                var quotaAmount = decimal.Round(
                    financialEntries
                        .Where(entry => entry.SupplierId == supplierId
                            && entry.Type == FinancialEntryType.Expense
                            && (string.Equals(entry.Category, SupplierFairPayableCategory, StringComparison.OrdinalIgnoreCase)
                                || string.Equals(entry.Category, SupplierFairLegacyPendingCategory, StringComparison.OrdinalIgnoreCase)))
                        .Sum(entry => entry.Amount),
                    2,
                    MidpointRounding.AwayFromZero);

                if (quotaAmount == 0m && fair.Suppliers.Count > 0 && fair.Status != FairStatus.Cancelled)
                {
                    quotaAmount = decimal.Round(fair.SupplierRegistrationFee / fair.Suppliers.Count, 2, MidpointRounding.AwayFromZero);
                }

                var paidAmount = decimal.Round(
                    financialEntries
                        .Where(entry => entry.SupplierId == supplierId
                            && entry.Type == FinancialEntryType.Expense
                            && string.Equals(entry.Category, SupplierFairPaymentCategory, StringComparison.OrdinalIgnoreCase))
                        .Sum(entry => entry.Amount),
                    2,
                    MidpointRounding.AwayFromZero);

                var outstandingAmount = decimal.Round(Math.Max(quotaAmount - paidAmount, 0m), 2, MidpointRounding.AwayFromZero);
                return new FairSupplierQuotaStatusDto(
                    supplierId,
                    link.Supplier?.Name ?? string.Empty,
                    quotaAmount,
                    paidAmount,
                    outstandingAmount,
                    outstandingAmount <= 0m && quotaAmount > 0m);
            })
            .ToList();

        return fair.ToReportDto(supplierQuotaStatus);
    }
}