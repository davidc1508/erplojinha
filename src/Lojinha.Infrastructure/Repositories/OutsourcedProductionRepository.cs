using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Repositories;

public sealed class OutsourcedProductionRepository(AppDbContext dbContext)
    : Repository<OutsourcedProduction>(dbContext), IOutsourcedProductionRepository
{
    public Task<List<OutsourcedProduction>> GetAllDetailedAsync(CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Category)
            .Include(x => x.ProducerSupplier)
            .Include(x => x.OwnerSupplier)
            .Include(x => x.PrinterProfile)
            .Include(x => x.DefaultMarketplaceFee)
            .Include(x => x.Recipe)
            .Include(x => x.Filaments)
                .ThenInclude(x => x.FilamentProfile)
            .Include(x => x.ConvertedProduct)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

    public Task<OutsourcedProduction?> GetDetailedByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => DbSet
            .Include(x => x.Category)
            .Include(x => x.ProducerSupplier)
            .Include(x => x.OwnerSupplier)
            .Include(x => x.PrinterProfile)
            .Include(x => x.DefaultMarketplaceFee)
            .Include(x => x.Recipe)
            .Include(x => x.Filaments)
                .ThenInclude(x => x.FilamentProfile)
            .Include(x => x.ConvertedProduct)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
}
