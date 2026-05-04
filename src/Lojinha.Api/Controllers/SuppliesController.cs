using Lojinha.Api.Entities;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class SuppliesController(ISupplyService supplyService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Supply>>> GetAll(CancellationToken cancellationToken)
        => Ok(await supplyService.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Supply>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var supply = await supplyService.GetByIdAsync(id, cancellationToken);
        return supply is null ? NotFound() : Ok(supply);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Supply>> Create([FromBody] Supply request, CancellationToken cancellationToken)
    {
        var supply = await supplyService.CreateAsync(request, User.GetEmail(), cancellationToken);
        return Ok(supply);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Supply>> Update(Guid id, [FromBody] Supply request, CancellationToken cancellationToken)
    {
        var supply = await supplyService.UpdateAsync(id, request, User.GetEmail(), cancellationToken);
        return supply is null ? NotFound() : Ok(supply);
    }
}