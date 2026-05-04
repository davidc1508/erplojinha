namespace Lojinha.Api.Entities;

public sealed class Supplier : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<FairSupplier> FairLinks { get; set; } = new List<FairSupplier>();
    public ICollection<FinancialEntry> FinancialEntries { get; set; } = new List<FinancialEntry>();
    public ICollection<OperationalRestockItem> RestockItems { get; set; } = new List<OperationalRestockItem>();
    public ICollection<OperationalTodoItem> TodoItems { get; set; } = new List<OperationalTodoItem>();
}