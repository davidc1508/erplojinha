using System.Text.Json;
using Lojinha.Api.Contracts.Recipes;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IRecipeService
{
    Task<RecipeDto?> GetByProductIdAsync(Guid productId, CancellationToken cancellationToken = default);
    Task<RecipeDto?> UpsertAsync(Guid productId, UpsertRecipeRequest request, string actor, CancellationToken cancellationToken = default);
}

public sealed class RecipeService(
    IProductRepository productRepository,
    IProductRecipeRepository recipeRepository,
    IRepository<Supply> supplyRepository,
    IRepository<AuditLog> auditRepository,
    IPricingService pricingService) : IRecipeService
{
    public async Task<RecipeDto?> GetByProductIdAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var recipe = await recipeRepository.GetByProductIdAsync(productId, cancellationToken);
        return recipe is null ? null : Map(recipe);
    }

    public async Task<RecipeDto?> UpsertAsync(Guid productId, UpsertRecipeRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetDetailedByIdAsync(productId, cancellationToken);
        if (product is null)
        {
            return null;
        }

        var recipe = product.Recipe ?? new ProductRecipe { ProductId = productId };
        recipe.LaborHours = request.LaborHours;
        recipe.LaborCostPerHour = request.LaborCostPerHour;
        recipe.AdditionalCosts = request.AdditionalCosts;
        recipe.WholesaleMarkup = request.WholesaleMarkup;
        recipe.RetailMarkup = request.RetailMarkup;
        recipe.ResellerMarkup = request.ResellerMarkup;
        recipe.Items.Clear();

        foreach (var item in request.Items)
        {
            var supply = await supplyRepository.GetByIdAsync(item.SupplyId, cancellationToken)
                ?? throw new InvalidOperationException("Insumo não encontrado.");

            recipe.Items.Add(new ProductRecipeItem
            {
                SupplyId = supply.Id,
                Supply = supply,
                Quantity = item.Quantity
            });
        }

        var pricing = pricingService.Calculate(
            product,
            recipe,
            product.PrinterProfile,
            product.Filaments
                .Where(f => f.FilamentProfile is not null)
                .Select(f => (f.FilamentProfile!, f.WeightGrams))
                .ToList(),
            product.DefaultMarketplaceFee);
        recipe.TotalCost = pricing.CompositionCost;
        product.CostPrice = pricing.TotalCost;
        product.SuggestedPrice = pricing.SuggestedPrice;
        product.SalePrice = pricing.SuggestedPrice;
        product.ProfitMargin = product.SalePrice <= 0m ? 0m : decimal.Round((product.SalePrice - product.CostPrice) / product.SalePrice, 4);

        if (recipe.Id == Guid.Empty)
        {
            await recipeRepository.AddAsync(recipe, cancellationToken);
        }
        else
        {
            recipeRepository.Update(recipe);
        }

        productRepository.Update(product);
        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(ProductRecipe),
            EntityId = productId.ToString(),
            Action = AuditAction.Updated,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { recipe.LaborHours, recipe.LaborCostPerHour, request.Items.Count })
        }, cancellationToken);

        await recipeRepository.SaveChangesAsync(cancellationToken);
        return Map(recipe);
    }

    private static RecipeDto Map(ProductRecipe recipe)
        => new(
            recipe.ProductId,
            recipe.LaborHours,
            recipe.LaborCostPerHour,
            recipe.AdditionalCosts,
            recipe.WholesaleMarkup,
            recipe.RetailMarkup,
            recipe.ResellerMarkup,
            recipe.TotalCost,
            recipe.Items.Select(item => new RecipeItemDto(
                item.SupplyId,
                item.Supply?.Name ?? string.Empty,
                item.Quantity,
                item.Supply?.Unit ?? string.Empty,
                item.Supply?.CostPerUnit ?? 0m)).ToList());
}