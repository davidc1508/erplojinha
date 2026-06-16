using Lojinha.Api.Contracts.OutsourcedProduction;
using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/outsourced-productions")]
public sealed class OutsourcedProductionController(IOutsourcedProductionService service) : ControllerBase
{
    private string Actor => User.GetEmail();

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OutsourcedProductionDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await service.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OutsourcedProductionDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await service.GetByIdAsync(id, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<OutsourcedProductionDto>> Create([FromBody] OutsourcedProductionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.CreateAsync(request, Actor, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OutsourcedProductionDto>> Update(Guid id, [FromBody] OutsourcedProductionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.UpdateAsync(id, request, Actor, cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await service.DeleteAsync(id, Actor, cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/convert-to-product")]
    public async Task<ActionResult<ProductDto>> ConvertToProduct(Guid id, [FromBody] ConvertToProductRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.ConvertToProductAsync(id, request, Actor, cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("pricing-preview")]
    public async Task<ActionResult<PriceSuggestionDto>> PreviewPricing([FromBody] OutsourcedProductionRequest request, CancellationToken cancellationToken)
        => Ok(await service.PreviewPricingAsync(request, cancellationToken));
}
