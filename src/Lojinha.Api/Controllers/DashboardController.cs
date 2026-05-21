using Lojinha.Api.Application.Abstractions;
using Lojinha.Api.Application.Features.Dashboard;
using Lojinha.Api.Contracts.Dashboard;
using Lojinha.Api.Entities;
using Lojinha.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier,Reseller")]
[Route("api/[controller]")]
public sealed class DashboardController(IQueryHandler<GetDashboardSummaryQuery, DashboardSummaryDto> queryHandler) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardSummaryDto>> Get(CancellationToken cancellationToken)
    {
        var supplierId = User.IsSupplier() ? User.GetSupplierId() : null;
        var resellerActor = User.IsReseller() ? User.GetEmail() : null;
        return Ok(await queryHandler.HandleAsync(new GetDashboardSummaryQuery(supplierId, resellerActor), cancellationToken));
    }
}