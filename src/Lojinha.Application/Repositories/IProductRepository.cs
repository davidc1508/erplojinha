using Lojinha.Api.Entities;

namespace Lojinha.Api.Repositories;

public interface IProductRepository : IRepository<Product>
{
    Task<List<Product>> GetAllDetailedAsync(CancellationToken cancellationToken = default);
    Task<Product?> GetDetailedByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Product?> GetBySkuAsync(string sku, CancellationToken cancellationToken = default);
}