using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Repositories;

public sealed class ProductRecipeRepository(AppDbContext dbContext) : Repository<ProductRecipe>(dbContext), IProductRecipeRepository
{
    public Task<ProductRecipe?> GetByProductIdAsync(Guid productId, CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Items)
                .ThenInclude(x => x.Supply)
            .FirstOrDefaultAsync(x => x.ProductId == productId, cancellationToken);
}