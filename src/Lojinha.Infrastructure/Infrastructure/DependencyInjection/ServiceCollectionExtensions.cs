using Lojinha.Api.Caching;
using Lojinha.Api.Repositories;
using Lojinha.Api.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Lojinha.Api.Infrastructure.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructureLayer(this IServiceCollection services)
    {
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IFairRepository, FairRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IProductRecipeRepository, ProductRecipeRepository>();
        services.AddScoped<ISaleRepository, SaleRepository>();
        services.AddScoped<IInventoryRepository, InventoryRepository>();
        services.AddScoped<IDatabaseInitializer, DatabaseInitializer>();
        services.AddSingleton<IAppCache, DistributedAppCache>();
        services.AddSingleton<IAppCacheInvalidationService, AppCacheInvalidationService>();

        return services;
    }
}