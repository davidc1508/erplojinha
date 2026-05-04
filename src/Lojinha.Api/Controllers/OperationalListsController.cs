using Lojinha.Api.Contracts.OperationalLists;
using Lojinha.Api.Entities;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class OperationalListsController(IOperationalListService operationalListService) : ControllerBase
{
    private Guid? ScopedSupplierId => User.IsInRole(UserRole.Supplier.ToString()) ? User.GetSupplierId() : null;

    [HttpGet("restock")]
    public async Task<ActionResult<IReadOnlyList<RestockItemDto>>> GetRestock(CancellationToken cancellationToken)
        => Ok(await operationalListService.GetRestockItemsAsync(ScopedSupplierId, cancellationToken));

    [HttpPost("restock")]
    public async Task<ActionResult<RestockItemDto>> CreateRestock([FromBody] RestockItemRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var created = await operationalListService.CreateRestockItemAsync(request, User.GetEmail(), ScopedSupplierId, cancellationToken);
            return Ok(created);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPut("restock/{id:guid}")]
    public async Task<ActionResult<RestockItemDto>> UpdateRestock(Guid id, [FromBody] RestockItemRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var updated = await operationalListService.UpdateRestockItemAsync(id, request, User.GetEmail(), ScopedSupplierId, cancellationToken);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpDelete("restock/{id:guid}")]
    public async Task<IActionResult> DeleteRestock(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await operationalListService.DeleteRestockItemAsync(id, User.GetEmail(), ScopedSupplierId, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("todo")]
    public async Task<ActionResult<IReadOnlyList<TodoItemDto>>> GetTodo(CancellationToken cancellationToken)
        => Ok(await operationalListService.GetTodoItemsAsync(ScopedSupplierId, cancellationToken));

    [HttpPost("todo")]
    public async Task<ActionResult<TodoItemDto>> CreateTodo([FromBody] TodoItemRequest request, CancellationToken cancellationToken)
    {
        var created = await operationalListService.CreateTodoItemAsync(request, User.GetEmail(), ScopedSupplierId, cancellationToken);
        return Ok(created);
    }

    [HttpPut("todo/{id:guid}")]
    public async Task<ActionResult<TodoItemDto>> UpdateTodo(Guid id, [FromBody] TodoItemRequest request, CancellationToken cancellationToken)
    {
        var updated = await operationalListService.UpdateTodoItemAsync(id, request, User.GetEmail(), ScopedSupplierId, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("todo/{id:guid}")]
    public async Task<IActionResult> DeleteTodo(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await operationalListService.DeleteTodoItemAsync(id, User.GetEmail(), ScopedSupplierId, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }
}
