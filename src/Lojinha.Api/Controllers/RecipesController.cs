using Lojinha.Api.Contracts.Recipes;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/products/{productId:guid}/recipe")]
public sealed class RecipesController(IRecipeService recipeService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<RecipeDto>> Get(Guid productId, CancellationToken cancellationToken)
    {
        var recipe = await recipeService.GetByProductIdAsync(productId, cancellationToken);
        return recipe is null ? NotFound() : Ok(recipe);
    }

    [HttpPut]
    public async Task<ActionResult<RecipeDto>> Upsert(Guid productId, [FromBody] UpsertRecipeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var recipe = await recipeService.UpsertAsync(productId, request, User.GetEmail(), cancellationToken);
            return recipe is null ? NotFound() : Ok(recipe);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}