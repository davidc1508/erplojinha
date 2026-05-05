using System.Text.Json;
using Lojinha.Api.Contracts.OperationalLists;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IOperationalListService
{
    Task<IReadOnlyList<RestockItemDto>> GetRestockItemsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<RestockItemDto> CreateRestockItemAsync(RestockItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<RestockItemDto?> UpdateRestockItemAsync(Guid id, RestockItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<bool> DeleteRestockItemAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TodoItemDto>> GetTodoItemsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<TodoItemDto> CreateTodoItemAsync(TodoItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<TodoItemDto?> UpdateTodoItemAsync(Guid id, TodoItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<bool> DeleteTodoItemAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
}

public sealed class OperationalListService(
    IRepository<OperationalRestockItem> restockRepository,
    IRepository<OperationalTodoItem> todoRepository,
    IRepository<Product> productRepository,
    IRepository<AuditLog> auditRepository) : IOperationalListService
{
    public Task<IReadOnlyList<RestockItemDto>> GetRestockItemsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var rows = ApplyScope(restockRepository.Query(), scopedSupplierId)
            .OrderByDescending(item => item.Priority)
            .ThenBy(item => item.Status)
            .ThenByDescending(item => item.CreatedAtUtc)
            .ToList();

        var productMap = productRepository.Query()
            .Where(product => rows.Select(item => item.ProductId).Contains(product.Id))
            .Select(product => new { product.Id, product.Name, Category = product.Category != null ? product.Category.Name : string.Empty })
            .ToDictionary(product => product.Id, product => (product.Name, product.Category));

        return Task.FromResult<IReadOnlyList<RestockItemDto>>(rows.Select(item => Map(item, productMap)).ToList());
    }

    public async Task<RestockItemDto> CreateRestockItemAsync(RestockItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        ValidateTargetQuantity(request.TargetQuantity);

        var product = await productRepository.GetByIdAsync(request.ProductId, cancellationToken)
            ?? throw new InvalidOperationException("Produto nao encontrado.");

        if (scopedSupplierId.HasValue && product.SupplierId != scopedSupplierId)
        {
            throw new InvalidOperationException("Produto nao pertence ao seu perfil.");
        }

        var entity = new OperationalRestockItem
        {
            ProductId = request.ProductId,
            OwnerSupplierId = scopedSupplierId,
            TargetQuantity = request.TargetQuantity,
            Priority = request.Priority,
            Status = request.Status,
            Notes = request.Notes?.Trim() ?? string.Empty,
            DueDateUtc = request.DueDateUtc,
            CompletedAtUtc = request.Status == RestockTaskStatus.Completed ? DateTime.UtcNow : null
        };

        await restockRepository.AddAsync(entity, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(nameof(OperationalRestockItem), entity.Id, AuditAction.Created, actor, entity), cancellationToken);
        await restockRepository.SaveChangesAsync(cancellationToken);

        var categoryName = productRepository.Query()
            .Where(value => value.Id == product.Id)
            .Select(value => value.Category != null ? value.Category.Name : string.Empty)
            .FirstOrDefault() ?? string.Empty;

        return new RestockItemDto(
            entity.Id,
            product.Id,
            product.Name,
            categoryName,
            entity.OwnerSupplierId,
            entity.TargetQuantity,
            entity.Priority,
            entity.Status,
            entity.Notes,
            entity.DueDateUtc,
            entity.CompletedAtUtc,
            entity.CreatedAtUtc,
            entity.UpdatedAtUtc);
    }

    public async Task<RestockItemDto?> UpdateRestockItemAsync(Guid id, RestockItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        ValidateTargetQuantity(request.TargetQuantity);

        var entity = ApplyScope(restockRepository.Query(), scopedSupplierId)
            .FirstOrDefault(item => item.Id == id);

        if (entity is null)
        {
            return null;
        }

        var product = await productRepository.GetByIdAsync(request.ProductId, cancellationToken)
            ?? throw new InvalidOperationException("Produto nao encontrado.");

        if (scopedSupplierId.HasValue && product.SupplierId != scopedSupplierId)
        {
            throw new InvalidOperationException("Produto nao pertence ao seu perfil.");
        }

        entity.ProductId = request.ProductId;
        entity.TargetQuantity = request.TargetQuantity;
        entity.Priority = request.Priority;
        entity.Status = request.Status;
        entity.Notes = request.Notes?.Trim() ?? string.Empty;
        entity.DueDateUtc = request.DueDateUtc;
        entity.CompletedAtUtc = request.Status == RestockTaskStatus.Completed ? entity.CompletedAtUtc ?? DateTime.UtcNow : null;

        restockRepository.Update(entity);
        await auditRepository.AddAsync(CreateAudit(nameof(OperationalRestockItem), entity.Id, AuditAction.Updated, actor, entity), cancellationToken);
        await restockRepository.SaveChangesAsync(cancellationToken);

        var categoryName = productRepository.Query()
            .Where(value => value.Id == product.Id)
            .Select(value => value.Category != null ? value.Category.Name : string.Empty)
            .FirstOrDefault() ?? string.Empty;

        return new RestockItemDto(
            entity.Id,
            product.Id,
            product.Name,
            categoryName,
            entity.OwnerSupplierId,
            entity.TargetQuantity,
            entity.Priority,
            entity.Status,
            entity.Notes,
            entity.DueDateUtc,
            entity.CompletedAtUtc,
            entity.CreatedAtUtc,
            entity.UpdatedAtUtc);
    }

    public async Task<bool> DeleteRestockItemAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var entity = ApplyScope(restockRepository.Query(), scopedSupplierId)
            .FirstOrDefault(item => item.Id == id);

        if (entity is null)
        {
            return false;
        }

        restockRepository.Remove(entity);
        await auditRepository.AddAsync(CreateAudit(nameof(OperationalRestockItem), entity.Id, AuditAction.Deleted, actor, entity), cancellationToken);
        await restockRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public Task<IReadOnlyList<TodoItemDto>> GetTodoItemsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var rows = ApplyScope(todoRepository.Query(), scopedSupplierId)
            .OrderByDescending(item => item.Priority)
            .ThenByDescending(item => item.CreatedAtUtc)
            .ToList();

        return Task.FromResult<IReadOnlyList<TodoItemDto>>(rows.Select(Map).ToList());
    }

    public async Task<TodoItemDto> CreateTodoItemAsync(TodoItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var entity = new OperationalTodoItem
        {
            Name = request.Name.Trim(),
            OwnerSupplierId = scopedSupplierId,
            Priority = request.Priority,
            Source = request.Source?.Trim() ?? string.Empty
        };

        await todoRepository.AddAsync(entity, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(nameof(OperationalTodoItem), entity.Id, AuditAction.Created, actor, entity), cancellationToken);
        await todoRepository.SaveChangesAsync(cancellationToken);
        return Map(entity);
    }

    public async Task<TodoItemDto?> UpdateTodoItemAsync(Guid id, TodoItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var entity = ApplyScope(todoRepository.Query(), scopedSupplierId)
            .FirstOrDefault(item => item.Id == id);

        if (entity is null)
        {
            return null;
        }

        entity.Name = request.Name.Trim();
        entity.Priority = request.Priority;
        entity.Source = request.Source?.Trim() ?? string.Empty;

        todoRepository.Update(entity);
        await auditRepository.AddAsync(CreateAudit(nameof(OperationalTodoItem), entity.Id, AuditAction.Updated, actor, entity), cancellationToken);
        await todoRepository.SaveChangesAsync(cancellationToken);
        return Map(entity);
    }

    public async Task<bool> DeleteTodoItemAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var entity = ApplyScope(todoRepository.Query(), scopedSupplierId)
            .FirstOrDefault(item => item.Id == id);

        if (entity is null)
        {
            return false;
        }

        todoRepository.Remove(entity);
        await auditRepository.AddAsync(CreateAudit(nameof(OperationalTodoItem), entity.Id, AuditAction.Deleted, actor, entity), cancellationToken);
        await todoRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static IQueryable<OperationalRestockItem> ApplyScope(IQueryable<OperationalRestockItem> query, Guid? scopedSupplierId)
        => scopedSupplierId.HasValue ? query.Where(item => item.OwnerSupplierId == scopedSupplierId) : query.Where(item => item.OwnerSupplierId == null);

    private static IQueryable<OperationalTodoItem> ApplyScope(IQueryable<OperationalTodoItem> query, Guid? scopedSupplierId)
        => scopedSupplierId.HasValue ? query.Where(item => item.OwnerSupplierId == scopedSupplierId) : query.Where(item => item.OwnerSupplierId == null);

    private static void ValidateTargetQuantity(decimal value)
    {
        if (value <= 0)
        {
            throw new InvalidOperationException("Quantidade alvo deve ser maior que zero.");
        }
    }

    private static RestockItemDto Map(OperationalRestockItem item, IDictionary<Guid, (string Name, string Category)> productMap)
    {
        var hasProduct = productMap.TryGetValue(item.ProductId, out var product);
        return new RestockItemDto(
            item.Id,
            item.ProductId,
            hasProduct ? product.Name : string.Empty,
            hasProduct ? product.Category : string.Empty,
            item.OwnerSupplierId,
            item.TargetQuantity,
            item.Priority,
            item.Status,
            item.Notes,
            item.DueDateUtc,
            item.CompletedAtUtc,
            item.CreatedAtUtc,
            item.UpdatedAtUtc);
    }

    private static TodoItemDto Map(OperationalTodoItem item)
        => new(
            item.Id,
            item.Name,
            item.OwnerSupplierId,
            item.Priority,
            item.Source,
            item.CreatedAtUtc,
            item.UpdatedAtUtc);

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
