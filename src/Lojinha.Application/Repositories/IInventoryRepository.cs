using Lojinha.Api.Entities;

namespace Lojinha.Api.Repositories;

public interface IInventoryRepository : IRepository<InventoryMovement>
{
    Task<List<InventoryMovement>> GetRecentAsync(CancellationToken cancellationToken = default);
}