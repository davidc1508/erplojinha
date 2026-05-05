using Lojinha.Api.Application.Abstractions;
using Lojinha.Api.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Lojinha.Api.Application.DependencyInjection;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationLayer(this IServiceCollection services)
    {
        services.Scan(scan => scan
            .FromAssemblyOf<ApplicationAssemblyMarker>()
            .AddClasses(classes => classes.AssignableTo(typeof(ICommandHandler<,>)))
                .AsImplementedInterfaces()
                .WithScopedLifetime()
            .AddClasses(classes => classes.AssignableTo(typeof(IQueryHandler<,>)))
                .AsImplementedInterfaces()
                .WithScopedLifetime());

        services.AddScoped<IPricingService, PricingService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ISupplyService, SupplyService>();
        services.AddScoped<IRecipeService, RecipeService>();
        services.AddScoped<IInventoryService, InventoryService>();
        services.AddScoped<ISalesService, SalesService>();
        services.AddScoped<ICardFeeSettingsService, CardFeeSettingsService>();
        services.AddScoped<IFinanceService, FinanceService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IProductCategoryService, ProductCategoryService>();
        services.AddScoped<IPrinterProfileService, PrinterProfileService>();
        services.AddScoped<ISupplierService, SupplierService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IOperationalListService, OperationalListService>();
        services.AddScoped<IProjectService, ProjectService>();
        services.AddScoped<IPersonalizedService, PersonalizedService>();

        return services;
    }
}