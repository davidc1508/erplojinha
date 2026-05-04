using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Repositories;

public sealed class FairRepository(AppDbContext dbContext) : Repository<Fair>(dbContext), IFairRepository
{
    public Task<List<Fair>> GetAllDetailedAsync(CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Suppliers)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Sales)
                .ThenInclude(x => x.Items)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Sales)
                .ThenInclude(x => x.Items)
                .ThenInclude(x => x.Product)
                    .ThenInclude(x => x!.Supplier)
            .OrderByDescending(x => x.EventDateUtc)
            .ToListAsync(cancellationToken);

    public Task<Fair?> GetDetailedByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Suppliers)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Sales)
                .ThenInclude(x => x.Items)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Sales)
                .ThenInclude(x => x.Items)
                .ThenInclude(x => x.Product)
                    .ThenInclude(x => x!.Supplier)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
}