namespace Lojinha.Api.Entities;

public sealed class OperationalTodoItem : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public Guid? OwnerSupplierId { get; set; }
    public Supplier? OwnerSupplier { get; set; }
    public OperationalItemPriority Priority { get; set; } = OperationalItemPriority.Medium;
    public string Source { get; set; } = string.Empty;
    public TodoTaskStatus Status { get; set; } = TodoTaskStatus.Backlog;
    public DateTime? CompletedAtUtc { get; set; }
}