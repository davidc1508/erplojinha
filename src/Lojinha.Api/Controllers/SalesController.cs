using Lojinha.Api.Contracts.Sales;
using Lojinha.Api.Entities;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class SalesController(ISalesService salesService) : ControllerBase
{
    private Guid? ScopedSupplierId => User.IsInRole(UserRole.Supplier.ToString()) ? User.GetSupplierId() : null;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SaleDto>>> GetRecent(CancellationToken cancellationToken)
        => Ok(await salesService.GetRecentAsync(User.GetEmail(), ScopedSupplierId, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<SaleDto>> Create([FromBody] CreateSaleRequest request, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await salesService.CreateAsync(request, User.GetEmail(), ScopedSupplierId, null, cancellationToken));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Supplier")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await salesService.DeleteAsync(id, User.GetEmail(), ScopedSupplierId, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }
}