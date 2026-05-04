using Lojinha.Api.Application.Abstractions;
using Lojinha.Api.Contracts.Dashboard;
using Lojinha.Api.Services;

namespace Lojinha.Api.Application.Features.Dashboard;

public sealed record GetDashboardSummaryQuery(Guid? SupplierId) : IQuery<DashboardSummaryDto>;

public sealed class GetDashboardSummaryQueryHandler(IDashboardService dashboardService)
    : IQueryHandler<GetDashboardSummaryQuery, DashboardSummaryDto>
{
    public Task<DashboardSummaryDto> HandleAsync(GetDashboardSummaryQuery query, CancellationToken cancellationToken = default)
        => dashboardService.GetSummaryAsync(query.SupplierId, cancellationToken);
}