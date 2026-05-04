using System.Text.Json;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.Suppliers;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface ISupplierService
{
    Task<IReadOnlyList<SupplierDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<SupplierDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<SupplierDto> CreateAsync(SupplierRequest request, string actor, CancellationToken cancellationToken = default);
    Task<SupplierDto?> UpdateAsync(Guid id, SupplierRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default);
}

public sealed class SupplierService(
    IAppCacheInvalidationService cacheInvalidationService,
    IRepository<Supplier> supplierRepository,
    IRepository<Product> productRepository,
    IRepository<AuditLog> auditRepository) : ISupplierService
{
    public Task<IReadOnlyList<SupplierDto>> GetAllAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<SupplierDto>>(supplierRepository.Query()
            .OrderBy(x => x.Name)
            .Select(Map)
            .ToList());

    public async Task<SupplierDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var supplier = await supplierRepository.GetByIdAsync(id, cancellationToken);
        return supplier is null ? null : Map(supplier);
    }

    public async Task<SupplierDto> CreateAsync(SupplierRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var supplier = new Supplier();
        Apply(supplier, request);

        await supplierRepository.AddAsync(supplier, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(supplier.Id, AuditAction.Created, actor, supplier), cancellationToken);
        await supplierRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        return Map(supplier);
    }

    public async Task<SupplierDto?> UpdateAsync(Guid id, SupplierRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var supplier = await supplierRepository.GetByIdAsync(id, cancellationToken);
        if (supplier is null)
        {
            return null;
        }

        Apply(supplier, request);
        supplierRepository.Update(supplier);
        await auditRepository.AddAsync(CreateAudit(supplier.Id, AuditAction.Updated, actor, supplier), cancellationToken);
        await supplierRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync([supplier.Id], cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync([supplier.Id], cancellationToken);
        return Map(supplier);
    }

    public async Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var supplier = await supplierRepository.GetByIdAsync(id, cancellationToken);
        if (supplier is null)
        {
            return false;
        }

        if (productRepository.Query().Any(product => product.SupplierId == id))
        {
            throw new InvalidOperationException("Nao e possivel excluir um fornecedor vinculado a produtos.");
        }

        supplierRepository.Remove(supplier);
        await auditRepository.AddAsync(CreateAudit(supplier.Id, AuditAction.Deleted, actor, supplier), cancellationToken);
        await supplierRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        return true;
    }

    private static void Apply(Supplier supplier, SupplierRequest request)
    {
        supplier.Name = request.Name.Trim();
        supplier.ContactName = request.ContactName?.Trim() ?? string.Empty;
        supplier.PhoneNumber = request.PhoneNumber?.Trim() ?? string.Empty;
        supplier.Notes = request.Notes?.Trim() ?? string.Empty;
    }

    private static SupplierDto Map(Supplier supplier)
        => new(supplier.Id, supplier.Name, supplier.ContactName, supplier.PhoneNumber, supplier.Notes);

    private static AuditLog CreateAudit(Guid supplierId, AuditAction action, string actor, object payload)
        => new()
        {
            EntityName = nameof(Supplier),
            EntityId = supplierId.ToString(),
            Action = action,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(payload)
        };
}