using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Sales;

public sealed record SaleItemRequest(
    Guid ProductId,
    Guid? SupplierId,
    decimal Quantity,
    decimal? UnitPrice,
    decimal? LojinhaGainPercentage,
    bool IsCommissionedSale = false,
    Guid? CommissionSellerSupplierId = null,
    decimal? CommissionAmount = null);

public sealed record CreateSaleRequest(PaymentMethod PaymentMethod, DateTime? SoldAtUtc, string? Notes, IReadOnlyList<SaleItemRequest> Items, bool CreateTodoForProducedItems = false);

public sealed record SaleLineDto(
    Guid ProductId,
    string ProductName,
    decimal Quantity,
    decimal UnitPrice,
    decimal CostPrice,
    decimal TotalPrice,
    Guid? SupplierId,
    string? SupplierName,
    decimal LojinhaGainPercentage,
    decimal LojinhaGainAmount,
    bool IsCommissionedSale,
    Guid? CommissionSellerSupplierId,
    string? CommissionSellerSupplierName,
    decimal CommissionAmount);

public sealed record SaleDto(
    Guid Id,
    DateTime SoldAtUtc,
    PaymentMethod PaymentMethod,
    string? FairName,
    decimal TotalAmount,
    decimal FeeAmount,
    decimal NetReceivedAmount,
    decimal CostAmount,
    decimal ProfitAmount,
    SaleStatus Status,
    string Notes,
    IReadOnlyList<SaleLineDto> Items,
    bool CanDelete);