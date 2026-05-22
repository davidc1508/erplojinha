using Lojinha.Api.Contracts.Dashboard;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.Finance;
using Lojinha.Api.Domain.Services;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IDashboardService
{
    Task<DashboardSummaryDto> GetSummaryAsync(Guid? supplierId = null, string? resellerActor = null, CancellationToken cancellationToken = default);
}

public sealed class DashboardService(
    IAppCache cache,
    IFairRepository fairRepository,
    ISaleRepository saleRepository,
    IRepository<FinancialEntry> financeRepository,
    IRepository<AuditLog> auditRepository) : IDashboardService
{
    private const string SupplierFairPayableCategory = "Contas a pagar de feiras";
    private const string SupplierFairLegacyPendingCategory = "Pendencia de pagamento em feiras";

    private static bool IsResellerSettlementItem(SaleItem item)
        => !item.IsCommissionedSale && item.CommissionAmount > 0m;

    private static IEnumerable<SaleItem> GetStoreItems(IEnumerable<SaleItem> items)
        => items.Where(item => !item.SupplierId.HasValue);

    private static IEnumerable<SaleItem> GetSupplierItems(IEnumerable<SaleItem> items, Guid supplierId)
        => items.Where(item => item.SupplierId == supplierId);

    private static decimal CalculateStoreGrossRevenue(IEnumerable<SaleItem> items)
        => GetStoreItems(items).Sum(item => IsResellerSettlementItem(item) ? item.CommissionAmount : item.TotalPrice);

    private static decimal CalculateStoreProfit(IEnumerable<SaleItem> items)
        => GetStoreItems(items).Sum(item => IsResellerSettlementItem(item)
            ? item.CommissionAmount - (item.CostPrice * item.Quantity)
            : item.LojinhaGainAmount);

    private static decimal CalculateSupplierGrossRevenue(IEnumerable<SaleItem> items, Guid supplierId)
        => GetSupplierItems(items, supplierId).Sum(item => IsResellerSettlementItem(item) ? item.CommissionAmount : item.TotalPrice);

    private static decimal CalculateSupplierProfit(IEnumerable<SaleItem> items, Guid supplierId)
        => GetSupplierItems(items, supplierId).Sum(item => IsResellerSettlementItem(item)
            ? item.CommissionAmount - (item.CostPrice * item.Quantity)
            : item.TotalPrice - (item.CostPrice * item.Quantity) - item.LojinhaGainAmount);

    private static decimal CalculateResellerProfit(IEnumerable<SaleItem> items)
        => items.Sum(item => IsResellerSettlementItem(item)
            ? item.TotalPrice - item.CommissionAmount
            : item.TotalPrice - (item.CostPrice * item.Quantity));

    private static decimal CalculateSupplierFeeShare(Fair fair, Guid supplierId)
        => fair.Suppliers.Any(link => link.SupplierId == supplierId) && fair.RegistrationFeeSplitCount > 0
            ? decimal.Round(fair.RegistrationFee / fair.RegistrationFeeSplitCount, 2, MidpointRounding.AwayFromZero)
            : 0m;

    public async Task<DashboardSummaryDto> GetSummaryAsync(Guid? supplierId = null, string? resellerActor = null, CancellationToken cancellationToken = default)
        => await cache.GetOrCreateAsync(
            AppCacheKeys.Dashboard(supplierId) + $":reseller:{(string.IsNullOrWhiteSpace(resellerActor) ? "store" : resellerActor.ToLowerInvariant())}",
            async token => supplierId.HasValue
                ? await GetSupplierSummaryAsync(supplierId.Value, token)
                : !string.IsNullOrWhiteSpace(resellerActor)
                    ? await GetResellerSummaryAsync(resellerActor, token)
                    : await GetStoreSummaryAsync(token),
            AppCacheDurations.Dashboard,
            cancellationToken);

    private async Task<DashboardSummaryDto> GetResellerSummaryAsync(string resellerActor, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var sales = await saleRepository.GetAllDetailedAsync(cancellationToken);
        var authoredSaleIds = GetAuthoredSaleIds(resellerActor, sales.Select(sale => sale.Id));
        var resellerSales = sales
            .Where(sale => authoredSaleIds.Contains(sale.Id))
            .ToList();

        var monthExpenses = resellerSales
            .Where(sale => sale.SoldAtUtc.Year == now.Year && sale.SoldAtUtc.Month == now.Month)
            .Sum(sale => sale.Items.Sum(CalculateResellerCost));

        var topProducts = resellerSales
            .SelectMany(sale => sale.Items)
            .GroupBy(item => item.Product?.Name ?? string.Empty)
            .Select(group => new TopProductDto(group.Key, group.Sum(item => item.Quantity), group.Sum(item => item.TotalPrice)))
            .OrderByDescending(item => item.QuantitySold)
            .Take(5)
            .ToList();

        var topProfitProducts = resellerSales
            .SelectMany(sale => sale.Items)
            .GroupBy(item => item.Product?.Name ?? string.Empty)
            .Select(group => new TopProfitProductDto(group.Key, group.Sum(CalculateResellerProfit)))
            .OrderByDescending(item => item.Profit)
            .Take(5)
            .ToList();

        var periods = new[]
        {
            new { Label = "0-15 dias", StartDays = 0, EndDays = 15 },
            new { Label = "16-30 dias", StartDays = 15, EndDays = 30 },
            new { Label = "31-60 dias", StartDays = 30, EndDays = 60 },
            new { Label = "61-90 dias", StartDays = 60, EndDays = 90 }
        };

        var periodMetrics = periods.Select(period =>
        {
            var windowStart = now.AddDays(-period.EndDays);
            var windowEnd = period.StartDays == 0 ? now : now.AddDays(-period.StartDays);
            var filteredSales = resellerSales
                .Where(sale => sale.SoldAtUtc >= windowStart && sale.SoldAtUtc < windowEnd)
                .ToList();
            var filteredItems = filteredSales.SelectMany(sale => sale.Items).ToList();
            var netRevenue = filteredSales.Sum(sale => CalculateResellerProfit(sale.Items));

            return new PeriodSalesMetricDto(
                period.Label,
                period.EndDays,
                filteredItems.Sum(item => item.Quantity),
                filteredItems.Sum(item => item.TotalPrice),
                netRevenue,
                SalesReportCalculator.CalculatePiggyBankAmount(netRevenue));
        }).ToList();

        var monthRevenue = resellerSales
            .Where(sale => sale.SoldAtUtc.Year == now.Year && sale.SoldAtUtc.Month == now.Month)
            .Sum(sale => CalculateResellerProfit(sale.Items));

        var revenueSeries = Enumerable.Range(0, 6)
            .Select(offset => new DateTime(now.Year, now.Month, 1).AddMonths(-offset))
            .OrderBy(date => date)
            .Select(date => new MonthlySeriesPointDto(
                date.ToString("MMM/yy"),
                resellerSales
                    .Where(sale => sale.SoldAtUtc.Year == date.Year && sale.SoldAtUtc.Month == date.Month)
                    .Sum(sale => CalculateResellerProfit(sale.Items))))
            .ToList();

        var revenueByPayment = resellerSales
            .GroupBy(sale => sale.PaymentMethod.ToString())
            .Select(group => new CategoryBreakdownDto(
                group.Key,
                group.Sum(sale => CalculateResellerProfit(sale.Items))))
            .OrderByDescending(group => group.Amount)
            .ToList();

        var fairs = fairRepository.Query().OrderByDescending(x => x.EventDateUtc).ToList();
        var recentFairs = fairs
            .Where(fair => fair.Sales.Any(sale => authoredSaleIds.Contains(sale.Id)))
            .Take(3)
            .Select(fair =>
            {
                var fairSales = fair.Sales.Where(sale => authoredSaleIds.Contains(sale.Id)).ToList();
                var fairNetRevenue = fairSales.Sum(sale => CalculateResellerProfit(sale.Items));
                return new FairIndicatorDto(
                    fair.Name,
                    fair.EventDateUtc,
                    fair.Status,
                    fairSales.Sum(sale => sale.Items.Sum(item => item.TotalPrice)),
                    fairNetRevenue,
                    fair.RegistrationFee,
                    SalesReportCalculator.CalculatePiggyBankAmount(fairNetRevenue));
            })
            .ToList();

        var realizedProfit = resellerSales.Sum(sale => CalculateResellerProfit(sale.Items));
        var averageTicket = resellerSales.Count == 0
            ? 0m
            : resellerSales.Average(sale => sale.Items.Sum(item => item.TotalPrice));
        var monthlyNetRevenue = resellerSales
            .Where(sale => sale.SoldAtUtc.Year == now.Year && sale.SoldAtUtc.Month == now.Month)
            .Sum(sale => CalculateResellerProfit(sale.Items));

        return new DashboardSummaryDto(
            monthRevenue,
            realizedProfit,
            monthExpenses,
            SalesReportCalculator.CalculatePiggyBankAmount(monthlyNetRevenue),
            averageTicket,
            resellerSales.Count,
            fairs.Count(fair => fair.Status == FairStatus.Open && fair.Sales.Any(sale => authoredSaleIds.Contains(sale.Id))),
            topProducts,
            topProfitProducts,
            recentFairs,
            periodMetrics,
            revenueSeries,
            revenueByPayment);
    }

    private static decimal CalculateResellerCost(SaleItem item)
        => IsResellerSettlementItem(item)
            ? item.CommissionAmount
            : decimal.Round(item.CostPrice * item.Quantity, 2, MidpointRounding.AwayFromZero);

    private static decimal CalculateResellerProfit(SaleItem item)
        => IsResellerSettlementItem(item)
            ? decimal.Round(item.TotalPrice - item.CommissionAmount, 2, MidpointRounding.AwayFromZero)
            : decimal.Round(item.TotalPrice - (item.CostPrice * item.Quantity), 2, MidpointRounding.AwayFromZero);

    private HashSet<Guid> GetAuthoredSaleIds(string actor, IEnumerable<Guid> saleIds)
    {
        var ids = saleIds.Select(id => id.ToString()).ToHashSet();
        if (ids.Count == 0)
        {
            return [];
        }

        return auditRepository.Query()
            .Where(log => log.EntityName == nameof(Sale)
                && log.Action == AuditAction.Sold
                && log.ChangedBy == actor
                && ids.Contains(log.EntityId))
            .Select(log => Guid.Parse(log.EntityId))
            .ToHashSet();
    }

    private async Task<DashboardSummaryDto> GetStoreSummaryAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var monthExpenses = financeRepository.Query()
            .Where(entry => entry.SupplierId == null
                && entry.Type == FinancialEntryType.Expense
                && entry.OccurredOnUtc.Year == now.Year
                && entry.OccurredOnUtc.Month == now.Month)
            .Sum(entry => entry.Amount);
        var sales = await saleRepository.GetAllDetailedAsync(cancellationToken);
        var fairs = fairRepository.Query().OrderByDescending(x => x.EventDateUtc).ToList();
        var storeSales = sales.Where(sale => sale.Items.Any(item => !item.SupplierId.HasValue)).ToList();

        var topProducts = storeSales
            .SelectMany(sale => sale.Items)
            .Where(item => !item.SupplierId.HasValue)
            .GroupBy(item => item.Product?.Name ?? string.Empty)
            .Select(group => new TopProductDto(group.Key, group.Sum(item => item.Quantity), group.Sum(item => item.TotalPrice)))
            .OrderByDescending(item => item.QuantitySold)
            .Take(5)
            .ToList();

        var topProfitProducts = storeSales
            .SelectMany(sale => sale.Items)
            .Where(item => !item.SupplierId.HasValue)
            .GroupBy(item => item.Product?.Name ?? string.Empty)
            .Select(group => new TopProfitProductDto(
                group.Key,
                group.Sum(item => IsResellerSettlementItem(item)
                    ? item.CommissionAmount - (item.CostPrice * item.Quantity)
                    : item.LojinhaGainAmount)))
            .OrderByDescending(item => item.Profit)
            .Take(5)
            .ToList();

        var periods = new[]
        {
            new { Label = "0-15 dias", StartDays = 0, EndDays = 15 },
            new { Label = "16-30 dias", StartDays = 15, EndDays = 30 },
            new { Label = "31-60 dias", StartDays = 30, EndDays = 60 },
            new { Label = "61-90 dias", StartDays = 60, EndDays = 90 }
        };

        var periodMetrics = periods.Select(period =>
        {
            var windowStart = now.AddDays(-period.EndDays);
            var windowEnd = period.StartDays == 0 ? now : now.AddDays(-period.StartDays);
            var filteredSales = storeSales
                .Where(sale => sale.SoldAtUtc >= windowStart && sale.SoldAtUtc < windowEnd)
                .ToList();

            var netRevenue = filteredSales.Sum(sale => CalculateStoreProfit(sale.Items));
            return new PeriodSalesMetricDto(
                period.Label,
                period.EndDays,
                filteredSales.SelectMany(sale => sale.Items).Where(item => !item.SupplierId.HasValue).Sum(item => item.Quantity),
                filteredSales.Sum(sale => CalculateStoreGrossRevenue(sale.Items)),
                netRevenue,
                SalesReportCalculator.CalculatePiggyBankAmount(netRevenue));
        }).ToList();

        var monthRevenue = storeSales
            .Where(sale => sale.SoldAtUtc.Year == now.Year && sale.SoldAtUtc.Month == now.Month)
            .Sum(sale => CalculateStoreGrossRevenue(sale.Items));

        var revenueSeries = Enumerable.Range(0, 6)
            .Select(offset => new DateTime(now.Year, now.Month, 1).AddMonths(-offset))
            .OrderBy(date => date)
            .Select(date => new MonthlySeriesPointDto(
                date.ToString("MMM/yy"),
                storeSales
                    .Where(sale => sale.SoldAtUtc.Year == date.Year && sale.SoldAtUtc.Month == date.Month)
                    .Sum(sale => CalculateStoreGrossRevenue(sale.Items))))
            .ToList();

        var revenueByPayment = storeSales
            .GroupBy(sale => sale.PaymentMethod.ToString())
            .Select(group => new CategoryBreakdownDto(group.Key, group.Sum(sale => CalculateStoreGrossRevenue(sale.Items))))
            .OrderByDescending(group => group.Amount)
            .ToList();

        var recentFairs = fairs
            .Take(3)
            .Select(fair =>
            {
                var fairSales = storeSales.Where(sale => sale.FairId == fair.Id).ToList();
                var fairNetRevenue = fairSales.Sum(sale => CalculateStoreProfit(sale.Items)) - fair.StoreRegistrationFee;
                return new FairIndicatorDto(
                    fair.Name,
                    fair.EventDateUtc,
                    fair.Status,
                    fairSales.Sum(sale => CalculateStoreGrossRevenue(sale.Items)),
                    fairNetRevenue,
                    fair.RegistrationFee,
                    SalesReportCalculator.CalculatePiggyBankAmount(fairNetRevenue));
            })
            .ToList();

        var realizedProfit = storeSales.Sum(sale => CalculateStoreProfit(sale.Items));
        var averageTicket = storeSales.Count == 0 ? 0m : storeSales.Average(sale => CalculateStoreGrossRevenue(sale.Items));
        var monthlyNetRevenue = storeSales.Where(sale => sale.SoldAtUtc.Year == now.Year && sale.SoldAtUtc.Month == now.Month).Sum(sale => CalculateStoreProfit(sale.Items));

        return new DashboardSummaryDto(
            monthRevenue,
            realizedProfit,
            monthExpenses,
            SalesReportCalculator.CalculatePiggyBankAmount(monthlyNetRevenue),
            averageTicket,
            storeSales.Count,
            fairs.Count(fair => fair.Status == FairStatus.Open),
            topProducts,
            topProfitProducts,
            recentFairs,
            periodMetrics,
            revenueSeries,
            revenueByPayment);
    }

    private async Task<DashboardSummaryDto> GetSupplierSummaryAsync(Guid supplierId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var monthExpenses = financeRepository.Query()
            .Where(entry => entry.SupplierId == supplierId
                && entry.Type == FinancialEntryType.Expense
                && !string.Equals(entry.Category, SupplierFairPayableCategory)
                && !string.Equals(entry.Category, SupplierFairLegacyPendingCategory)
                && entry.OccurredOnUtc.Year == now.Year
                && entry.OccurredOnUtc.Month == now.Month)
            .Sum(entry => entry.Amount);
        var sales = await saleRepository.GetAllDetailedAsync(cancellationToken);
        var fairs = await fairRepository.GetAllDetailedAsync(cancellationToken);
        var supplierSales = sales.Where(sale => sale.Items.Any(item => item.SupplierId == supplierId)).ToList();

        var topProducts = supplierSales
            .SelectMany(sale => GetSupplierItems(sale.Items, supplierId))
            .GroupBy(item => item.Product?.Name ?? string.Empty)
            .Select(group => new TopProductDto(group.Key, group.Sum(item => item.Quantity), group.Sum(item => item.TotalPrice)))
            .OrderByDescending(item => item.QuantitySold)
            .Take(5)
            .ToList();

        var topProfitProducts = supplierSales
            .SelectMany(sale => GetSupplierItems(sale.Items, supplierId))
            .GroupBy(item => item.Product?.Name ?? string.Empty)
            .Select(group => new TopProfitProductDto(group.Key, group.Sum(item => IsResellerSettlementItem(item)
                ? item.CommissionAmount - (item.CostPrice * item.Quantity)
                : item.TotalPrice - (item.CostPrice * item.Quantity) - item.LojinhaGainAmount)))
            .OrderByDescending(item => item.Profit)
            .Take(5)
            .ToList();

        var periods = new[]
        {
            new { Label = "0-15 dias", StartDays = 0, EndDays = 15 },
            new { Label = "16-30 dias", StartDays = 15, EndDays = 30 },
            new { Label = "31-60 dias", StartDays = 30, EndDays = 60 },
            new { Label = "61-90 dias", StartDays = 60, EndDays = 90 }
        };

        var periodMetrics = periods.Select(period =>
        {
            var windowStart = now.AddDays(-period.EndDays);
            var windowEnd = period.StartDays == 0 ? now : now.AddDays(-period.StartDays);
            var filteredSales = supplierSales
                .Where(sale => sale.SoldAtUtc >= windowStart && sale.SoldAtUtc < windowEnd)
                .ToList();
            var filteredItems = filteredSales.SelectMany(sale => GetSupplierItems(sale.Items, supplierId)).ToList();
            var netRevenue = filteredSales.Sum(sale => CalculateSupplierProfit(sale.Items, supplierId));

            return new PeriodSalesMetricDto(
                period.Label,
                period.EndDays,
                filteredItems.Sum(item => item.Quantity),
                filteredItems.Sum(item => item.TotalPrice),
                netRevenue,
                SalesReportCalculator.CalculatePiggyBankAmount(netRevenue));
        }).ToList();

        var monthRevenue = supplierSales
            .Where(sale => sale.SoldAtUtc.Year == now.Year && sale.SoldAtUtc.Month == now.Month)
            .Sum(sale => CalculateSupplierProfit(sale.Items, supplierId));

        var revenueSeries = Enumerable.Range(0, 6)
            .Select(offset => new DateTime(now.Year, now.Month, 1).AddMonths(-offset))
            .OrderBy(date => date)
            .Select(date => new MonthlySeriesPointDto(
                date.ToString("MMM/yy"),
                supplierSales
                    .Where(sale => sale.SoldAtUtc.Year == date.Year && sale.SoldAtUtc.Month == date.Month)
                    .Sum(sale => CalculateSupplierProfit(sale.Items, supplierId))))
            .ToList();

        var revenueByPayment = supplierSales
            .GroupBy(sale => sale.PaymentMethod.ToString())
            .Select(group => new CategoryBreakdownDto(
                group.Key,
                group.Sum(sale => CalculateSupplierProfit(sale.Items, supplierId))))
            .OrderByDescending(group => group.Amount)
            .ToList();

        var recentFairs = fairs
            .Where(fair => fair.Sales.Any(sale => sale.Items.Any(item => item.SupplierId == supplierId)))
            .OrderByDescending(fair => fair.EventDateUtc)
            .Take(3)
            .Select(fair =>
            {
                var fairItems = fair.Sales.SelectMany(sale => GetSupplierItems(sale.Items, supplierId)).ToList();
                var fairNetRevenue = fair.Sales.Sum(sale => CalculateSupplierProfit(sale.Items, supplierId)) - CalculateSupplierFeeShare(fair, supplierId);
                return new FairIndicatorDto(
                    fair.Name,
                    fair.EventDateUtc,
                    fair.Status,
                    fairItems.Sum(item => item.TotalPrice),
                    fairNetRevenue,
                    fair.RegistrationFee,
                    SalesReportCalculator.CalculatePiggyBankAmount(fairNetRevenue));
            })
            .ToList();

        var realizedProfit = supplierSales
            .Sum(sale => CalculateSupplierProfit(sale.Items, supplierId));
        var averageTicket = supplierSales.Count == 0
            ? 0m
            : supplierSales.Average(sale => GetSupplierItems(sale.Items, supplierId).Sum(item => item.TotalPrice));
        var monthlyNetRevenue = supplierSales
            .Where(sale => sale.SoldAtUtc.Year == now.Year && sale.SoldAtUtc.Month == now.Month)
            .Sum(sale => CalculateSupplierProfit(sale.Items, supplierId));

        return new DashboardSummaryDto(
            monthRevenue,
            realizedProfit,
            monthExpenses,
            SalesReportCalculator.CalculatePiggyBankAmount(monthlyNetRevenue),
            averageTicket,
            supplierSales.Count,
            fairs.Count(fair => fair.Status == FairStatus.Open && fair.Suppliers.Any(link => link.SupplierId == supplierId)),
            topProducts,
            topProfitProducts,
            recentFairs,
            periodMetrics,
            revenueSeries,
            revenueByPayment);
    }
}