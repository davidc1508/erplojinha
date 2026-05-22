using Lojinha.Api.Contracts.Inventory;
using Lojinha.Api.Entities;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class InventoryController(IInventoryService inventoryService) : ControllerBase
{
    private Guid? ScopedSupplierId => User.IsInRole(UserRole.Supplier.ToString()) ? User.GetSupplierId() : null;

    [HttpGet("movements")]
    public async Task<ActionResult<IReadOnlyList<InventoryMovementDto>>> GetRecent(CancellationToken cancellationToken)
        => Ok(await inventoryService.GetRecentAsync(ScopedSupplierId, cancellationToken));

    [HttpPost("movements")]
    public async Task<ActionResult<InventoryMovementDto>> Register([FromBody] ManualInventoryMovementRequest request, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await inventoryService.RegisterAsync(request, User.GetEmail(), ScopedSupplierId, cancellationToken));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("movements/{id}/reverse")]
    public async Task<ActionResult<InventoryMovementDto>> Reverse(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await inventoryService.ReverseAsync(id, User.GetEmail(), ScopedSupplierId, cancellationToken));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}
