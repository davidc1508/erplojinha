namespace Lojinha.Api.Entities;

public sealed class PrinterProfile : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public decimal ReturnMonths { get; set; }
    public decimal MachineCost { get; set; }
    public decimal WorkHoursPerDay { get; set; }
    public decimal WorkingDaysPerMonth { get; set; }
    public decimal PowerKw { get; set; }
    public string UsageLevel { get; set; } = string.Empty;
    public decimal FailureRate { get; set; }
    public ICollection<Product> Products { get; set; } = new List<Product>();
}