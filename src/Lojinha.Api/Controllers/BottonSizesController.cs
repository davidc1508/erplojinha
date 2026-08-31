using Lojinha.Api.Contracts.Catalog;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class BottonSizesController(IBottonSizeService bottonSizeService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BottonSizeDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await bottonSizeService.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BottonSizeDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var bottonSize = await bottonSizeService.GetByIdAsync(id, cancellationToken);
        return bottonSize is null ? NotFound() : Ok(bottonSize);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BottonSizeDto>> Create([FromBody] BottonSizeRequest request, CancellationToken cancellationToken)
    {
        var bottonSize = await bottonSizeService.CreateAsync(request, User.GetEmail(), cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = bottonSize.Id }, bottonSize);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BottonSizeDto>> Update(Guid id, [FromBody] BottonSizeRequest request, CancellationToken cancellationToken)
    {
        var bottonSize = await bottonSizeService.UpdateAsync(id, request, User.GetEmail(), cancellationToken);
        return bottonSize is null ? NotFound() : Ok(bottonSize);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await bottonSizeService.DeleteAsync(id, User.GetEmail(), cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }
}
