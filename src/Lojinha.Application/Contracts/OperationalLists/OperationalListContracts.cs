using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.OperationalLists;

public sealed record RestockItemRequest(
    Guid ProductId,
    decimal TargetQuantity,
    OperationalItemPriority Priority,
    RestockTaskStatus Status,
    string? Notes,
    DateTime? DueDateUtc);

public sealed record TodoItemRequest(
    string Name,
    OperationalItemPriority Priority,
    string? Source);

public sealed record RestockItemDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string ProductCategory,
    Guid? OwnerSupplierId,
    decimal TargetQuantity,
    OperationalItemPriority Priority,
    RestockTaskStatus Status,
    string Notes,
    DateTime? DueDateUtc,
    DateTime? CompletedAtUtc,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record TodoItemDto(
    Guid Id,
    string Name,
    Guid? OwnerSupplierId,
    OperationalItemPriority Priority,
    string Source,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);