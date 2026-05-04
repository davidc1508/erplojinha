using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Repositories;

public sealed class InventoryRepository(AppDbContext dbContext) : Repository<InventoryMovement>(dbContext), IInventoryRepository
{
    public Task<List<InventoryMovement>> GetRecentAsync(CancellationToken cancellationToken = default)
        => DbSet
            .OrderByDescending(x => x.OccurredAtUtc)
            .Take(200)
            .ToListAsync(cancellationToken);
}