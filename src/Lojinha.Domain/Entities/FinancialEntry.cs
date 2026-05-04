namespace Lojinha.Api.Entities;

public sealed class FinancialEntry : AuditableEntity
{
    public FinancialEntryType Type { get; set; }
    public FinancialClassification Classification { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime OccurredOnUtc { get; set; } = DateTime.UtcNow;
    public Guid? ReferenceId { get; set; }
    public Guid? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
}