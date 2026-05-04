using Lojinha.Api.Contracts.Catalog;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class CategoriesController(IProductCategoryService categoryService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductCategoryDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await categoryService.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductCategoryDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var category = await categoryService.GetByIdAsync(id, cancellationToken);
        return category is null ? NotFound() : Ok(category);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductCategoryDto>> Create([FromBody] ProductCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await categoryService.CreateAsync(request, User.GetEmail(), cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = category.Id }, category);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductCategoryDto>> Update(Guid id, [FromBody] ProductCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await categoryService.UpdateAsync(id, request, User.GetEmail(), cancellationToken);
        return category is null ? NotFound() : Ok(category);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await categoryService.DeleteAsync(id, User.GetEmail(), cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }
}