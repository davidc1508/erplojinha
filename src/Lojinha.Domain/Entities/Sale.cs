namespace Lojinha.Api.Entities;

public sealed class Sale : AuditableEntity
{
    public DateTime SoldAtUtc { get; set; } = DateTime.UtcNow;
    public PaymentMethod PaymentMethod { get; set; }
    public Guid? FairId { get; set; }
    public Fair? Fair { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal FeeAmount { get; set; }
    public decimal NetReceivedAmount { get; set; }
    public decimal CostAmount { get; set; }
    public decimal ProfitAmount { get; set; }
    public SaleStatus Status { get; set; } = SaleStatus.Completed;
    public string Notes { get; set; } = string.Empty;
    public ICollection<SaleItem> Items { get; set; } = new List<SaleItem>();
}