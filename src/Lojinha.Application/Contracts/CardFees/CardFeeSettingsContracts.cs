namespace Lojinha.Api.Contracts.CardFees;

public sealed record UpdateCardFeeSettingsRequest(
    decimal CreditCardPercentage,
    decimal DebitCardPercentage,
    decimal AdditionalPercentage,
    decimal AdditionalFixedAmount);

public sealed record CardFeeSettingsDto(
    decimal CreditCardPercentage,
    decimal DebitCardPercentage,
    decimal AdditionalPercentage,
    decimal AdditionalFixedAmount,
    decimal CreditCardEffectivePercentage,
    decimal DebitCardEffectivePercentage);

public sealed record CardFeeReprocessResultDto(int UpdatedSalesCount);
