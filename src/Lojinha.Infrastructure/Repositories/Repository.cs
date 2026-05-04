using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Repositories;

public class Repository<T>(AppDbContext dbContext) : IRepository<T> where T : BaseEntity
{
    protected readonly AppDbContext DbContext = dbContext;
    protected readonly DbSet<T> DbSet = dbContext.Set<T>();

    public IQueryable<T> Query() => DbSet.AsQueryable();

    public Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => DbSet.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task AddAsync(T entity, CancellationToken cancellationToken = default)
        => DbSet.AddAsync(entity, cancellationToken).AsTask();

    public void Update(T entity) => DbSet.Update(entity);

    public void Remove(T entity) => DbSet.Remove(entity);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => DbContext.SaveChangesAsync(cancellationToken);
}