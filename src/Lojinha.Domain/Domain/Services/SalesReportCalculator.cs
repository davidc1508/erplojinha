namespace Lojinha.Api.Domain.Services;

public static class SalesReportCalculator
{
    public static decimal CalculatePiggyBankAmount(decimal netRevenue)
        => netRevenue <= 0m ? 0m : decimal.Round(netRevenue / 2m, 2, MidpointRounding.AwayFromZero);
}