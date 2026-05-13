using Lojinha.Api.Contracts.Dashboard;
using Lojinha.Api.Contracts.Fairs;
using Lojinha.Api.Contracts.Sales;
using Lojinha.Api.Domain.Services;
using Lojinha.Api.Entities;

namespace Lojinha.Api.Application.Features.Fairs;

internal static class FairMappings
{
    private static decimal GetEffectiveStoreRegistrationFee(Fair fair)
        => fair.Status == FairStatus.Cancelled ? 0m : fair.StoreRegistrationFee;

    private static decimal CalculateStoreGrossRevenue(IEnumerable<SaleItem> items)
        => items.Sum(item => item.SupplierId.HasValue
            ? (item.LojinhaGainAmount > 0m ? item.TotalPrice : 0m)
            : item.TotalPrice);

    private static IEnumerable<SaleItem> GetSupplierItems(IEnumerable<SaleItem> items, Guid supplierId)
        => items.Where(item => item.SupplierId == supplierId);

    private static decimal CalculateSupplierGrossRevenue(IEnumerable<SaleItem> items, Guid supplierId)
        => GetSupplierItems(items, supplierId).Sum(item => item.TotalPrice);

    private static decimal CalculateSupplierNetRevenue(IEnumerable<SaleItem> items, Guid supplierId)
        => GetSupplierItems(items, supplierId).Sum(item => item.TotalPrice - (item.CostPrice * item.Quantity) - item.LojinhaGainAmount);

    private static decimal CalculateSupplierFeeShare(Fair fair, Guid supplierId)
        => fair.Status != FairStatus.Cancelled
            && fair.Suppliers.Any(link => link.SupplierId == supplierId)
            && fair.Suppliers.Count > 0
            ? decimal.Round((fair.RegistrationFee / 2m) / fair.Suppliers.Count, 2, MidpointRounding.AwayFromZero)
            : 0m;

    public static FairDto ToDto(this Fair fair, Guid? supplierId = null)
    {
        if (supplierId.HasValue)
        {
            var supplierGrossRevenue = fair.Sales.Sum(sale => CalculateSupplierGrossRevenue(sale.Items, supplierId.Value));
            var supplierResult = fair.Sales.Sum(sale => CalculateSupplierNetRevenue(sale.Items, supplierId.Value)) - CalculateSupplierFeeShare(fair, supplierId.Value);
            var supplierPiggyBankAmount = SalesReportCalculator.CalculatePiggyBankAmount(supplierResult);
            var fairSuppliers = fair.Suppliers
                .OrderBy(link => link.Supplier!.Name)
                .Select(link => new FairSupplierDto(link.SupplierId, link.Supplier?.Name ?? string.Empty))
                .ToList();

            return new FairDto(
                fair.Id,
                fair.Name,
                fair.EventDateUtc,
                fair.EndDateUtc,
                fair.Location,
                fair.RegistrationFee,
                fair.RegistrationFeeSplitCount,
                fairSuppliers,
                fair.StoreRegistrationFee,
                fair.Notes,
                fair.Status,
                fair.FinalizedAtUtc,
                fair.Sales.Count(sale => sale.Items.Any(item => item.SupplierId == supplierId.Value)),
                supplierGrossRevenue,
                supplierResult,
                supplierPiggyBankAmount);
        }

        var grossRevenue = fair.Sales.Sum(sale => CalculateStoreGrossRevenue(sale.Items));
        var effectiveStoreRegistrationFee = GetEffectiveStoreRegistrationFee(fair);
        var netRevenue = fair.Sales.Sum(sale => sale.ProfitAmount) - effectiveStoreRegistrationFee;
        var piggyBankAmount = SalesReportCalculator.CalculatePiggyBankAmount(netRevenue);
        var suppliers = fair.Suppliers
            .OrderBy(link => link.Supplier!.Name)
            .Select(link => new FairSupplierDto(link.SupplierId, link.Supplier?.Name ?? string.Empty))
            .ToList();

        return new FairDto(
            fair.Id,
            fair.Name,
            fair.EventDateUtc,
            fair.EndDateUtc,
            fair.Location,
            fair.RegistrationFee,
            fair.RegistrationFeeSplitCount,
            suppliers,
            effectiveStoreRegistrationFee,
            fair.Notes,
            fair.Status,
            fair.FinalizedAtUtc,
            fair.Sales.Count,
            grossRevenue,
            netRevenue,
            piggyBankAmount);
    }

    public static SaleDto ToSaleDto(this Sale sale)
        => new(
            sale.Id,
            sale.SoldAtUtc,
            sale.PaymentMethod,
            sale.Fair?.Name,
            sale.TotalAmount,
            sale.FeeAmount,
            sale.NetReceivedAmount,
            sale.CostAmount,
            sale.ProfitAmount,
            sale.Status,
            sale.Notes,
            sale.Items.Select(item => new SaleLineDto(
                item.Product?.Name ?? string.Empty,
                item.Quantity,
                item.UnitPrice,
                item.CostPrice,
                item.TotalPrice,
                item.SupplierId,
                item.Supplier?.Name ?? item.Product?.Supplier?.Name,
                item.LojinhaGainPercentage,
                item.LojinhaGainAmount,
                item.IsCommissionedSale,
                item.CommissionSellerSupplierId,
                item.CommissionSellerSupplier?.Name,
                item.CommissionAmount)).ToList(),
            false);

    public static FairReportDto ToReportDto(this Fair fair, IReadOnlyList<FairSupplierQuotaStatusDto>? supplierQuotaStatus = null)
    {
        var sales = fair.Sales.OrderByDescending(sale => sale.SoldAtUtc).ToList();
        var effectiveStoreRegistrationFee = GetEffectiveStoreRegistrationFee(fair);
        var grossRevenue = sales.Sum(sale => CalculateStoreGrossRevenue(sale.Items));
        var netRevenue = sales.Sum(sale => sale.ProfitAmount);
        var result = netRevenue - effectiveStoreRegistrationFee;
        var piggyBankAmount = SalesReportCalculator.CalculatePiggyBankAmount(result);
        var totalItems = sales.SelectMany(sale => sale.Items).Sum(item => item.Quantity);
        var suppliers = fair.Suppliers
            .OrderBy(link => link.Supplier!.Name)
            .Select(link => new FairSupplierDto(link.SupplierId, link.Supplier?.Name ?? string.Empty))
            .ToList();
        var topProducts = sales.SelectMany(sale => sale.Items)
            .GroupBy(item => item.Product?.Name ?? string.Empty)
            .Select(group => new TopProductDto(group.Key, group.Sum(item => item.Quantity), group.Sum(item => item.TotalPrice)))
            .OrderByDescending(item => item.QuantitySold)
            .Take(8)
            .ToList();
        var series = sales
            .GroupBy(sale => sale.SoldAtUtc.Date)
            .OrderBy(group => group.Key)
            .Select(group => new FairReportSeriesDto(
                group.Key.ToString("dd/MM"),
                group.Sum(sale => CalculateStoreGrossRevenue(sale.Items)),
                group.Sum(sale => sale.ProfitAmount),
                group.SelectMany(sale => sale.Items).Sum(item => item.Quantity)))
            .ToList();

        return new FairReportDto(
            fair.Id,
            fair.Name,
            fair.Status,
            fair.EventDateUtc,
            fair.EndDateUtc,
            fair.Location,
            fair.RegistrationFee,
            fair.RegistrationFeeSplitCount,
            suppliers,
            effectiveStoreRegistrationFee,
            grossRevenue,
            netRevenue,
            piggyBankAmount,
            result,
            totalItems,
            supplierQuotaStatus ?? [],
            topProducts,
            sales.Select(sale => sale.ToSaleDto()).ToList(),
            series);
    }
}