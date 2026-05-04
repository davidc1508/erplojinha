using Lojinha.Api.Entities;

namespace Lojinha.Api.Repositories;

public interface IFairRepository : IRepository<Fair>
{
    Task<List<Fair>> GetAllDetailedAsync(CancellationToken cancellationToken = default);
    Task<Fair?> GetDetailedByIdAsync(Guid id, CancellationToken cancellationToken = default);
}