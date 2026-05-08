namespace Lojinha.Api.Entities;

public sealed class ProductPrinterUsage : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid PrinterProfileId { get; set; }
    public PrinterProfile? PrinterProfile { get; set; }
    public decimal TimeRealMinutes { get; set; }
}
