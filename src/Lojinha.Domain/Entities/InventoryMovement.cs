namespace Lojinha.Api.Entities;

public sealed class InventoryMovement : AuditableEntity
{
    public InventoryItemType ItemType { get; set; }
    public Guid ItemId { get; set; }
    public InventoryMovementType Type { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string Notes { get; set; } = string.Empty;
    public Guid? ReferenceId { get; set; }
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
}