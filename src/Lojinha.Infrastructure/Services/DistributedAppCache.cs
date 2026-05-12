using System.Text.Json;
using Lojinha.Api.Caching;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Lojinha.Api.Services;

public sealed class DistributedAppCache(
    IDistributedCache distributedCache,
    ILogger<DistributedAppCache> logger) : IAppCache
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public async Task<T> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T>> factory, TimeSpan ttl, CancellationToken cancellationToken = default)
    {
        try
        {
            var cachedPayload = await distributedCache.GetStringAsync(key, cancellationToken);
            if (!string.IsNullOrWhiteSpace(cachedPayload))
            {
                var cachedValue = JsonSerializer.Deserialize<T>(cachedPayload, SerializerOptions);
                if (cachedValue is not null)
                {
                    return cachedValue;
                }
            }
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Falha ao recuperar a chave de cache {CacheKey}.", key);
        }

        var value = await factory(cancellationToken);

        try
        {
            var payload = JsonSerializer.Serialize(value, SerializerOptions);
            await distributedCache.SetStringAsync(
                key,
                payload,
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = ttl
                },
                cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Falha ao armazenar a chave de cache {CacheKey}.", key);
        }

        return value;
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            await distributedCache.RemoveAsync(key, cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Falha ao remover a chave de cache {CacheKey}.", key);
        }
    }

    public async Task RemoveManyAsync(IEnumerable<string> keys, CancellationToken cancellationToken = default)
    {
        foreach (var key in keys.Where(static key => !string.IsNullOrWhiteSpace(key)).Distinct(StringComparer.Ordinal))
        {
            await RemoveAsync(key, cancellationToken);
        }
    }
}

public sealed class AppCacheInvalidationService(IAppCache cache) : IAppCacheInvalidationService
{
    public Task InvalidateDashboardAsync(IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default)
        => cache.RemoveManyAsync(BuildDashboardKeys(supplierIds), cancellationToken);

    public Task InvalidateProductReadModelsAsync(IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default)
        => cache.RemoveManyAsync(BuildProductReadModelKeys(supplierIds), cancellationToken);

    public Task InvalidateCatalogAsync(CancellationToken cancellationToken = default)
        => cache.RemoveManyAsync([
            AppCacheKeys.ProductCategories(),
            AppCacheKeys.PrinterProfiles(),
            AppCacheKeys.ProductMetadata()
        ], cancellationToken);

    public Task InvalidateMetadataAsync(IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default)
        => cache.RemoveManyAsync(BuildMetadataKeys(supplierIds), cancellationToken);

    public Task InvalidateFairReadModelsAsync(Guid? fairId = null, IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default)
        => cache.RemoveManyAsync(BuildFairKeys(fairId, supplierIds), cancellationToken);

    private static IEnumerable<string> BuildDashboardKeys(IEnumerable<Guid>? supplierIds)
    {
        yield return AppCacheKeys.Dashboard();

        foreach (var supplierId in supplierIds?.Distinct() ?? [])
        {
            yield return AppCacheKeys.Dashboard(supplierId);
        }
    }

    private static IEnumerable<string> BuildMetadataKeys(IEnumerable<Guid>? supplierIds)
    {
        yield return AppCacheKeys.ProductMetadata();

        foreach (var supplierId in supplierIds?.Distinct() ?? [])
        {
            yield return AppCacheKeys.ProductMetadata(supplierId);
        }
    }

    private static IEnumerable<string> BuildProductReadModelKeys(IEnumerable<Guid>? supplierIds)
    {
        foreach (var key in ExpandProductListKeys(AppCacheKeys.Products()))
        {
            yield return key;
        }

        foreach (var metadataKey in BuildMetadataKeys(supplierIds))
        {
            yield return metadataKey;
        }

        foreach (var dashboardKey in BuildDashboardKeys(supplierIds))
        {
            yield return dashboardKey;
        }

        foreach (var supplierId in supplierIds?.Distinct() ?? [])
        {
            foreach (var key in ExpandProductListKeys(AppCacheKeys.Products(supplierId)))
            {
                yield return key;
            }
        }
    }

    private static IEnumerable<string> ExpandProductListKeys(string baseKey)
    {
        // Product list cache keys are persisted with budget suffix in ProductService.
        // Invalidate all known variants to avoid stale results after create/update/delete.
        yield return baseKey;
        yield return $"{baseKey}:budget:all";
        yield return $"{baseKey}:budget:0";
        yield return $"{baseKey}:budget:1";
    }

    private static IEnumerable<string> BuildFairKeys(Guid? fairId, IEnumerable<Guid>? supplierIds)
    {
        yield return AppCacheKeys.Fairs();

        foreach (var supplierId in supplierIds?.Distinct() ?? [])
        {
            yield return AppCacheKeys.Fairs(supplierId);
        }

        if (fairId.HasValue)
        {
            yield return AppCacheKeys.Fair(fairId.Value);
            yield return AppCacheKeys.FairReport(fairId.Value);
        }

        foreach (var dashboardKey in BuildDashboardKeys(supplierIds))
        {
            yield return dashboardKey;
        }
    }
}