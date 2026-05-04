namespace Lojinha.Api.Entities;

public sealed class OperationalRestockItem : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid? OwnerSupplierId { get; set; }
    public Supplier? OwnerSupplier { get; set; }
    public OperationalItemPriority Priority { get; set; } = OperationalItemPriority.Medium;
    public decimal TargetQuantity { get; set; }
    public RestockTaskStatus Status { get; set; } = RestockTaskStatus.Open;
    public string Notes { get; set; } = string.Empty;
    public DateTime? DueDateUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
}