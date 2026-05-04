namespace Lojinha.Api.Entities;

public sealed class CardFeeSettings : AuditableEntity
{
    public decimal CreditCardPercentage { get; set; }
    public decimal DebitCardPercentage { get; set; }
    public decimal AdditionalPercentage { get; set; }
    public decimal AdditionalFixedAmount { get; set; }
}
