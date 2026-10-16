using Lojinha.Api.Entities;

namespace Lojinha.Api.Domain.Services;

public static class ComboCalculator
{
    public static decimal Cost(Product product)
        => product.ProductType == ProductType.Combo
            ? decimal.Round(product.ComboItems.Sum(item => item.Quantity * (item.Product?.CostPrice ?? 0m)), 2)
            : product.CostPrice;

    public static decimal CombinedPrice(Product product)
        => decimal.Round(product.ComboItems.Sum(item => item.Quantity * (item.Product?.SalePrice ?? 0m)), 2);

    public static decimal AvailableStock(Product product)
        => product.ProductType != ProductType.Combo ? product.CurrentStock
            : product.ComboItems.Count == 0 ? 0m
            : product.ComboItems.Min(item => item.Quantity > 0m
                ? decimal.Floor((item.Product?.CurrentStock ?? 0m) / item.Quantity) : 0m);
}