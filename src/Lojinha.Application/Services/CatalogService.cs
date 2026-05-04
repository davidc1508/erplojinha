using System.Text.Json;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.Catalog;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IProductCategoryService
{
    Task<IReadOnlyList<ProductCategoryDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<ProductCategoryDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ProductCategoryDto> CreateAsync(ProductCategoryRequest request, string actor, CancellationToken cancellationToken = default);
    Task<ProductCategoryDto?> UpdateAsync(Guid id, ProductCategoryRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default);
}

public interface IPrinterProfileService
{
    Task<IReadOnlyList<PrinterProfileDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<PrinterProfileDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PrinterProfileDto> CreateAsync(PrinterProfileRequest request, string actor, CancellationToken cancellationToken = default);
    Task<PrinterProfileDto?> UpdateAsync(Guid id, PrinterProfileRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default);
}

public sealed class ProductCategoryService(
    IAppCache cache,
    IAppCacheInvalidationService cacheInvalidationService,
    IRepository<ProductCategory> categoryRepository,
    IRepository<Product> productRepository,
    IRepository<AuditLog> auditRepository) : IProductCategoryService
{
    public Task<IReadOnlyList<ProductCategoryDto>> GetAllAsync(CancellationToken cancellationToken = default)
        => cache.GetOrCreateAsync(
            AppCacheKeys.ProductCategories(),
            token => Task.FromResult<IReadOnlyList<ProductCategoryDto>>(categoryRepository.Query()
                .OrderBy(x => x.Name)
                .Select(Map)
                .ToList()),
            AppCacheDurations.Catalog,
            cancellationToken);

    public async Task<ProductCategoryDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var category = await categoryRepository.GetByIdAsync(id, cancellationToken);
        return category is null ? null : Map(category);
    }

    public async Task<ProductCategoryDto> CreateAsync(ProductCategoryRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var category = new ProductCategory
        {
            NumericIdentifier = GetNextNumericIdentifier(),
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            ColorHex = request.ColorHex.Trim()
        };

        await categoryRepository.AddAsync(category, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(nameof(ProductCategory), category.Id, AuditAction.Created, actor, category), cancellationToken);
        await categoryRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateCatalogAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(cancellationToken: cancellationToken);
        return Map(category);
    }

    public async Task<ProductCategoryDto?> UpdateAsync(Guid id, ProductCategoryRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var category = await categoryRepository.GetByIdAsync(id, cancellationToken);
        if (category is null)
        {
            return null;
        }

        category.Name = request.Name.Trim();
        category.Description = request.Description.Trim();
        category.ColorHex = request.ColorHex.Trim();

        categoryRepository.Update(category);
        await auditRepository.AddAsync(CreateAudit(nameof(ProductCategory), category.Id, AuditAction.Updated, actor, category), cancellationToken);
        await categoryRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateCatalogAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(cancellationToken: cancellationToken);
        return Map(category);
    }

    public async Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var category = await categoryRepository.GetByIdAsync(id, cancellationToken);
        if (category is null)
        {
            return false;
        }

        if (productRepository.Query().Any(product => product.CategoryId == id))
        {
            throw new InvalidOperationException("Nao e possivel excluir uma categoria vinculada a produtos.");
        }

        categoryRepository.Remove(category);
        await auditRepository.AddAsync(CreateAudit(nameof(ProductCategory), category.Id, AuditAction.Deleted, actor, category), cancellationToken);
        await categoryRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateCatalogAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(cancellationToken: cancellationToken);
        return true;
    }

    private int GetNextNumericIdentifier()
        => (categoryRepository.Query().Select(x => (int?)x.NumericIdentifier).Max() ?? 0) + 1;

    private static ProductCategoryDto Map(ProductCategory category)
        => new(category.Id, category.NumericIdentifier, category.Name, category.Description, category.ColorHex);

    private static AuditLog CreateAudit(string entityName, Guid entityId, AuditAction action, string actor, object payload)
        => new()
        {
            EntityName = entityName,
            EntityId = entityId.ToString(),
            Action = action,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(payload)
        };
}

public sealed class PrinterProfileService(
    IAppCache cache,
    IAppCacheInvalidationService cacheInvalidationService,
    IRepository<PrinterProfile> printerRepository,
    IRepository<Product> productRepository,
    IRepository<AuditLog> auditRepository) : IPrinterProfileService
{
    public Task<IReadOnlyList<PrinterProfileDto>> GetAllAsync(CancellationToken cancellationToken = default)
        => cache.GetOrCreateAsync(
            AppCacheKeys.PrinterProfiles(),
            token => Task.FromResult<IReadOnlyList<PrinterProfileDto>>(printerRepository.Query()
                .OrderBy(x => x.Name)
                .Select(Map)
                .ToList()),
            AppCacheDurations.Catalog,
            cancellationToken);

    public async Task<PrinterProfileDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var printer = await printerRepository.GetByIdAsync(id, cancellationToken);
        return printer is null ? null : Map(printer);
    }

    public async Task<PrinterProfileDto> CreateAsync(PrinterProfileRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var printer = new PrinterProfile();
        Apply(printer, request);

        await printerRepository.AddAsync(printer, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(nameof(PrinterProfile), printer.Id, AuditAction.Created, actor, printer), cancellationToken);
        await printerRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateCatalogAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(cancellationToken: cancellationToken);
        return Map(printer);
    }

    public async Task<PrinterProfileDto?> UpdateAsync(Guid id, PrinterProfileRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var printer = await printerRepository.GetByIdAsync(id, cancellationToken);
        if (printer is null)
        {
            return null;
        }

        Apply(printer, request);
        printerRepository.Update(printer);
        await auditRepository.AddAsync(CreateAudit(nameof(PrinterProfile), printer.Id, AuditAction.Updated, actor, printer), cancellationToken);
        await printerRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateCatalogAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(cancellationToken: cancellationToken);
        return Map(printer);
    }

    public async Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var printer = await printerRepository.GetByIdAsync(id, cancellationToken);
        if (printer is null)
        {
            return false;
        }

        if (productRepository.Query().Any(product => product.PrinterProfileId == id))
        {
            throw new InvalidOperationException("Nao e possivel excluir uma impressora vinculada a produtos.");
        }

        printerRepository.Remove(printer);
        await auditRepository.AddAsync(CreateAudit(nameof(PrinterProfile), printer.Id, AuditAction.Deleted, actor, printer), cancellationToken);
        await printerRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateCatalogAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(cancellationToken: cancellationToken);
        return true;
    }

    private static void Apply(PrinterProfile printer, PrinterProfileRequest request)
    {
        printer.Name = request.Name.Trim();
        printer.Brand = request.Brand.Trim();
        printer.ReturnMonths = request.ReturnMonths;
        printer.MachineCost = request.MachineCost;
        printer.WorkHoursPerDay = request.WorkHoursPerDay;
        printer.WorkingDaysPerMonth = request.WorkingDaysPerMonth;
        printer.PowerKw = request.PowerKw;
        printer.UsageLevel = request.UsageLevel.Trim();
        printer.FailureRate = request.FailureRate;
    }

    private static PrinterProfileDto Map(PrinterProfile printer)
        => new(
            printer.Id,
            printer.Name,
            printer.Brand,
            printer.ReturnMonths,
            printer.MachineCost,
            printer.WorkHoursPerDay,
            printer.WorkingDaysPerMonth,
            printer.PowerKw,
            printer.UsageLevel,
            printer.FailureRate);

    private static AuditLog CreateAudit(string entityName, Guid entityId, AuditAction action, string actor, object payload)
        => new()
        {
            EntityName = entityName,
            EntityId = entityId.ToString(),
            Action = action,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(payload)
        };
}