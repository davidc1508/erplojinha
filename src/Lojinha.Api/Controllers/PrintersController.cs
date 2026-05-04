using Lojinha.Api.Contracts.Catalog;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class PrintersController(IPrinterProfileService printerService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PrinterProfileDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await printerService.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PrinterProfileDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var printer = await printerService.GetByIdAsync(id, cancellationToken);
        return printer is null ? NotFound() : Ok(printer);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PrinterProfileDto>> Create([FromBody] PrinterProfileRequest request, CancellationToken cancellationToken)
    {
        var printer = await printerService.CreateAsync(request, User.GetEmail(), cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = printer.Id }, printer);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PrinterProfileDto>> Update(Guid id, [FromBody] PrinterProfileRequest request, CancellationToken cancellationToken)
    {
        var printer = await printerService.UpdateAsync(id, request, User.GetEmail(), cancellationToken);
        return printer is null ? NotFound() : Ok(printer);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await printerService.DeleteAsync(id, User.GetEmail(), cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }
}