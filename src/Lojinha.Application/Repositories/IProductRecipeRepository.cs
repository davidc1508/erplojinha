using Lojinha.Api.Entities;

namespace Lojinha.Api.Repositories;

public interface IProductRecipeRepository : IRepository<ProductRecipe>
{
    Task<ProductRecipe?> GetByProductIdAsync(Guid productId, CancellationToken cancellationToken = default);
}