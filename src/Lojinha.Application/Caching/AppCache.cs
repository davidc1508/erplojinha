namespace Lojinha.Api.Caching;

public interface IAppCache
{
    Task<T> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T>> factory, TimeSpan ttl, CancellationToken cancellationToken = default);
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
    Task RemoveManyAsync(IEnumerable<string> keys, CancellationToken cancellationToken = default);
}

public interface IAppCacheInvalidationService
{
    Task InvalidateDashboardAsync(IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default);
    Task InvalidateProductReadModelsAsync(IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default);
    Task InvalidateCatalogAsync(CancellationToken cancellationToken = default);
    Task InvalidateMetadataAsync(IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default);
    Task InvalidateFairReadModelsAsync(Guid? fairId = null, IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default);
}

public static class AppCacheKeys
{
    public static string Dashboard(Guid? supplierId = null)
        => supplierId.HasValue ? $"dashboard:supplier:{supplierId.Value:N}" : "dashboard:store";

    public static string Products(Guid? supplierId = null, bool includeAllForSupplier = false)
        => !supplierId.HasValue || includeAllForSupplier ? "products:all" : $"products:supplier:{supplierId.Value:N}";

    public static string ProductMetadata(Guid? supplierId = null)
        => "products:metadata:all";

    public static string ProductCategories()
        => "catalog:categories";

    public static string PrinterProfiles()
        => "catalog:printers";

    public static string Fairs(Guid? supplierId = null)
        => supplierId.HasValue ? $"fairs:supplier:{supplierId.Value:N}" : "fairs:all";

    public static string Fair(Guid fairId)
        => $"fairs:{fairId:N}";

    public static string FairReport(Guid fairId)
        => $"fairs:{fairId:N}:report";
}

public static class AppCacheDurations
{
    public static readonly TimeSpan Dashboard = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan ProductList = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan ProductMetadata = TimeSpan.FromDays(7);
    public static readonly TimeSpan Catalog = TimeSpan.FromDays(7);
    public static readonly TimeSpan Fairs = TimeSpan.FromMinutes(10);
}