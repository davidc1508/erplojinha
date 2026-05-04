using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Repositories;

public sealed class ProductRepository(AppDbContext dbContext) : Repository<Product>(dbContext), IProductRepository
{
    public Task<List<Product>> GetAllDetailedAsync(CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Category)
            .Include(x => x.Supplier)
            .Include(x => x.PrinterProfile)
                .Include(x => x.Filaments)
                    .ThenInclude(x => x.FilamentProfile)
            .Include(x => x.DefaultMarketplaceFee)
            .Include(x => x.SaleItems)
            .Include(x => x.Recipe)
                .ThenInclude(x => x!.Items)
                .ThenInclude(x => x.Supply)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task<Product?> GetDetailedByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Category)
            .Include(x => x.Supplier)
            .Include(x => x.PrinterProfile)
                .Include(x => x.Filaments)
                    .ThenInclude(x => x.FilamentProfile)
            .Include(x => x.DefaultMarketplaceFee)
            .Include(x => x.SaleItems)
            .Include(x => x.Recipe)
                .ThenInclude(x => x!.Items)
                .ThenInclude(x => x.Supply)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Product?> GetBySkuAsync(string sku, CancellationToken cancellationToken = default)
        => DbSet.FirstOrDefaultAsync(x => x.Sku == sku, cancellationToken);
}