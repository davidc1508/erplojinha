using Lojinha.Api.Entities;

namespace Lojinha.Api.Repositories;

public interface IOutsourcedProductionRepository : IRepository<OutsourcedProduction>
{
    Task<List<OutsourcedProduction>> GetAllDetailedAsync(CancellationToken cancellationToken = default);
    Task<OutsourcedProduction?> GetDetailedByIdAsync(Guid id, CancellationToken cancellationToken = default);
}
