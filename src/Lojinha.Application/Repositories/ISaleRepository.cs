using Lojinha.Api.Entities;

namespace Lojinha.Api.Repositories;

public interface ISaleRepository : IRepository<Sale>
{
    Task<List<Sale>> GetAllDetailedAsync(CancellationToken cancellationToken = default);
    Task<List<Sale>> GetRecentAsync(CancellationToken cancellationToken = default);
    Task<List<Sale>> GetByFairIdAsync(Guid fairId, CancellationToken cancellationToken = default);
    Task<Sale?> GetDetailedByIdAsync(Guid id, CancellationToken cancellationToken = default);
}