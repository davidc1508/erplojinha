using Lojinha.Api.Contracts.Finance;
using Lojinha.Api.Entities;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class FinanceController(IFinanceService financeService) : ControllerBase
{
    private Guid? ScopedSupplierId => User.IsInRole(UserRole.Supplier.ToString()) ? User.GetSupplierId() : null;

    [HttpGet("entries")]
    public async Task<ActionResult<IReadOnlyList<FinancialEntryDto>>> GetEntries(CancellationToken cancellationToken)
        => Ok(await financeService.GetEntriesAsync(ScopedSupplierId, cancellationToken));

    [HttpGet("report")]
    public async Task<ActionResult<FinanceReportDto>> GetReport([FromQuery] int? year, CancellationToken cancellationToken)
        => Ok(await financeService.GetReportAsync(year ?? DateTime.UtcNow.Year, ScopedSupplierId, cancellationToken));

    [HttpPost("entries")]
    [Authorize(Roles = "Admin,Supplier")]
    public async Task<ActionResult<FinancialEntryDto>> Create([FromBody] CreateFinancialEntryRequest request, CancellationToken cancellationToken)
        => Ok(await financeService.CreateAsync(request, User.GetEmail(), ScopedSupplierId, cancellationToken));
}