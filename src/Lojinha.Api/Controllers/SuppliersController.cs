using Lojinha.Api.Contracts.Suppliers;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/[controller]")]
public sealed class SuppliersController(ISupplierService supplierService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await supplierService.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SupplierDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await supplierService.GetByIdAsync(id, cancellationToken);
        return supplier is null ? NotFound() : Ok(supplier);
    }

    [HttpPost]
    public async Task<ActionResult<SupplierDto>> Create([FromBody] SupplierRequest request, CancellationToken cancellationToken)
    {
        var supplier = await supplierService.CreateAsync(request, User.GetEmail(), cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, supplier);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SupplierDto>> Update(Guid id, [FromBody] SupplierRequest request, CancellationToken cancellationToken)
    {
        var supplier = await supplierService.UpdateAsync(id, request, User.GetEmail(), cancellationToken);
        return supplier is null ? NotFound() : Ok(supplier);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await supplierService.DeleteAsync(id, User.GetEmail(), cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }
}