using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Inventory;

public sealed record ManualInventoryMovementRequest(
    InventoryItemType ItemType,
    Guid ItemId,
    InventoryMovementType Type,
    decimal Quantity,
    decimal UnitCost,
    string? Notes);

public sealed record InventoryMovementDto(
    Guid Id,
    InventoryItemType ItemType,
    Guid ItemId,
    Guid? SupplierId,
    string ItemName,
    InventoryMovementType Type,
    decimal Quantity,
    decimal UnitCost,
    string Notes,
    DateTime OccurredAtUtc);