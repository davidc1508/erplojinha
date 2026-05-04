using Lojinha.Api.Contracts.Finance;
using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Dashboard;

public sealed record TopProductDto(string ProductName, decimal QuantitySold, decimal Revenue);

public sealed record TopProfitProductDto(string ProductName, decimal Profit);

public sealed record PeriodSalesMetricDto(string Label, int Days, decimal ItemsSold, decimal GrossRevenue, decimal NetRevenue, decimal PiggyBankAmount);

public sealed record FairIndicatorDto(string FairName, DateTime EventDateUtc, FairStatus Status, decimal GrossRevenue, decimal NetRevenue, decimal RegistrationFee, decimal PiggyBankAmount);

public sealed record DashboardSummaryDto(
    decimal MonthlyRevenue,
    decimal RealizedProfit,
    decimal TotalExpenses,
    decimal MonthlyPiggyBankAmount,
    decimal AverageTicket,
    int TotalSalesCount,
    int OpenFairsCount,
    IReadOnlyList<TopProductDto> TopProducts,
    IReadOnlyList<TopProfitProductDto> TopProfitProducts,
    IReadOnlyList<FairIndicatorDto> RecentFairs,
    IReadOnlyList<PeriodSalesMetricDto> PeriodMetrics,
    IReadOnlyList<MonthlySeriesPointDto> RevenueSeries,
    IReadOnlyList<CategoryBreakdownDto> RevenueByPayment);