using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Repositories;

public sealed class SaleRepository(AppDbContext dbContext) : Repository<Sale>(dbContext), ISaleRepository
{
    public Task<List<Sale>> GetAllDetailedAsync(CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Fair)
            .ThenInclude(x => x!.Suppliers)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.CommissionSellerSupplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.Product)
                    .ThenInclude(x => x!.Supplier)
            .OrderByDescending(x => x.SoldAtUtc)
            .ToListAsync(cancellationToken);

    public Task<Sale?> GetDetailedByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Fair)
            .ThenInclude(x => x!.Suppliers)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.CommissionSellerSupplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.Product)
                    .ThenInclude(x => x!.Supplier)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<List<Sale>> GetRecentAsync(CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Fair)
            .ThenInclude(x => x!.Suppliers)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.CommissionSellerSupplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.Product)
                    .ThenInclude(x => x!.Supplier)
            .OrderByDescending(x => x.SoldAtUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

    public Task<List<Sale>> GetByFairIdAsync(Guid fairId, CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Fair)
            .ThenInclude(x => x!.Suppliers)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.Supplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.CommissionSellerSupplier)
            .Include(x => x.Items)
                .ThenInclude(x => x.Product)
                    .ThenInclude(x => x!.Supplier)
            .Where(x => x.FairId == fairId)
            .OrderBy(x => x.SoldAtUtc)
            .ToListAsync(cancellationToken);
}