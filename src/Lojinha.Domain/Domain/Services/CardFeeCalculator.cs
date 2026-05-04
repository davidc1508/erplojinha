using Lojinha.Api.Entities;

namespace Lojinha.Api.Domain.Services;

public static class CardFeeCalculator
{
    public static decimal CalculateFee(decimal totalAmount, PaymentMethod paymentMethod, CardFeeSettings? settings)
    {
        if (totalAmount <= 0m || settings is null || !UsesCardFee(paymentMethod))
        {
            return 0m;
        }

        var cardPercentage = paymentMethod switch
        {
            PaymentMethod.CreditCard => settings.CreditCardPercentage,
            PaymentMethod.DebitCard => settings.DebitCardPercentage,
            _ => 0m
        };

        var totalPercentage = Math.Max(0m, cardPercentage + settings.AdditionalPercentage) / 100m;
        var feeAmount = (totalAmount * totalPercentage) + Math.Max(0m, settings.AdditionalFixedAmount);
        return decimal.Round(Math.Min(totalAmount, feeAmount), 2, MidpointRounding.AwayFromZero);
    }

    public static decimal AllocateFee(decimal itemTotalPrice, decimal saleTotalAmount, decimal totalFeeAmount, decimal alreadyAllocatedFee, bool isLastItem)
    {
        if (totalFeeAmount <= 0m || saleTotalAmount <= 0m || itemTotalPrice <= 0m)
        {
            return 0m;
        }

        if (isLastItem)
        {
            return decimal.Round(Math.Max(0m, totalFeeAmount - alreadyAllocatedFee), 2, MidpointRounding.AwayFromZero);
        }

        return decimal.Round(totalFeeAmount * (itemTotalPrice / saleTotalAmount), 2, MidpointRounding.AwayFromZero);
    }

    public static bool UsesCardFee(PaymentMethod paymentMethod)
        => paymentMethod is PaymentMethod.CreditCard or PaymentMethod.DebitCard;
}
