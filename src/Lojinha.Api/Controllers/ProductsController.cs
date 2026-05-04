using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Entities;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class ProductsController(IProductService productService) : ControllerBase
{
    private Guid? ScopedSupplierId => User.IsInRole(UserRole.Supplier.ToString()) ? User.GetSupplierId() : null;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> GetAll([FromQuery] bool includeAllForSupplier = false, CancellationToken cancellationToken = default)
        => Ok(await productService.GetAllAsync(ScopedSupplierId, includeAllForSupplier, cancellationToken));

    [HttpGet("metadata")]
    public async Task<ActionResult<ProductMetadataDto>> GetMetadata(CancellationToken cancellationToken)
        => Ok(await productService.GetMetadataAsync(ScopedSupplierId, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var product = await productService.GetByIdAsync(id, ScopedSupplierId, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet("{id:guid}/pricing")]
    public async Task<ActionResult<PriceSuggestionDto>> GetPricing(Guid id, CancellationToken cancellationToken)
    {
        var pricing = await productService.GetPriceSuggestionAsync(id, ScopedSupplierId, cancellationToken);
        return pricing is null ? NotFound() : Ok(pricing);
    }

    [HttpGet("{id:guid}/price-history")]
    public async Task<ActionResult<IReadOnlyList<ProductPriceHistoryEntryDto>>> GetPriceHistory(Guid id, CancellationToken cancellationToken)
        => Ok(await productService.GetPriceHistoryAsync(id, ScopedSupplierId, cancellationToken));

    [HttpPost("pricing-preview")]
    public async Task<ActionResult<PriceSuggestionDto>> PreviewPricing([FromBody] ProductRequest request, CancellationToken cancellationToken)
        => Ok(await productService.PreviewPriceSuggestionAsync(request, ScopedSupplierId, cancellationToken));

    [Authorize(Roles = "Admin")]
    [HttpPost("recalculate-suggested-prices")]
    public async Task<ActionResult<object>> RecalculateSuggestedPrices(CancellationToken cancellationToken)
    {
        var updatedCount = await productService.RecalculateSuggestedPricesAsync(cancellationToken);
        return Ok(new { updatedCount });
    }

    [HttpPost]
    public async Task<ActionResult<ProductDto>> Create([FromBody] ProductRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var product = await productService.CreateAsync(request, User.GetEmail(), ScopedSupplierId, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProductDto>> Update(Guid id, [FromBody] ProductRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var product = await productService.UpdateAsync(id, request, User.GetEmail(), ScopedSupplierId, cancellationToken);
            return product is null ? NotFound() : Ok(product);
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await productService.DeleteAsync(id, User.GetEmail(), ScopedSupplierId, cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }
}