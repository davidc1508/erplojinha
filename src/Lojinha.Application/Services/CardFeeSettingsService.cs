using System.Text.Json;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.CardFees;
using Lojinha.Api.Domain.Services;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface ICardFeeSettingsService
{
    Task<CardFeeSettingsDto> GetAsync(CancellationToken cancellationToken = default);
    Task<CardFeeSettingsDto> UpdateAsync(UpdateCardFeeSettingsRequest request, string actor, CancellationToken cancellationToken = default);
    Task<CardFeeReprocessResultDto> ReprocessCardSalesAsync(string actor, CancellationToken cancellationToken = default);
}

public sealed class CardFeeSettingsService(
    IAppCacheInvalidationService cacheInvalidationService,
    IRepository<CardFeeSettings> settingsRepository,
    ISaleRepository saleRepository,
    IRepository<FinancialEntry> financeRepository,
    IRepository<AuditLog> auditRepository) : ICardFeeSettingsService
{
    public async Task<CardFeeSettingsDto> GetAsync(CancellationToken cancellationToken = default)
        => Map(await GetOrCreateSettingsAsync(cancellationToken));

    public async Task<CardFeeSettingsDto> UpdateAsync(UpdateCardFeeSettingsRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var settings = await GetOrCreateSettingsAsync(cancellationToken);
        settings.CreditCardPercentage = decimal.Round(request.CreditCardPercentage, 2, MidpointRounding.AwayFromZero);
        settings.DebitCardPercentage = decimal.Round(request.DebitCardPercentage, 2, MidpointRounding.AwayFromZero);
        settings.AdditionalPercentage = decimal.Round(request.AdditionalPercentage, 2, MidpointRounding.AwayFromZero);
        settings.AdditionalFixedAmount = decimal.Round(request.AdditionalFixedAmount, 2, MidpointRounding.AwayFromZero);

        settingsRepository.Update(settings);
        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(CardFeeSettings),
            EntityId = settings.Id.ToString(),
            Action = AuditAction.Updated,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(request)
        }, cancellationToken);

        await settingsRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateDashboardAsync(cancellationToken: cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(cancellationToken: cancellationToken);
        return Map(settings);
    }

    public async Task<CardFeeReprocessResultDto> ReprocessCardSalesAsync(string actor, CancellationToken cancellationToken = default)
    {
        var settings = await GetOrCreateSettingsAsync(cancellationToken);
        var sales = (await saleRepository.GetAllDetailedAsync(cancellationToken))
            .Where(sale => CardFeeCalculator.UsesCardFee(sale.PaymentMethod))
            .ToList();

        foreach (var sale in sales)
        {
            RecalculateSaleAmounts(sale, settings);
            saleRepository.Update(sale);

            foreach (var entry in financeRepository.Query().Where(entry => entry.ReferenceId == sale.Id && entry.Type == FinancialEntryType.Income))
            {
                entry.Amount = sale.NetReceivedAmount;
                financeRepository.Update(entry);
            }
        }

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Sale),
            EntityId = "bulk-reprocess-card-fees",
            Action = AuditAction.Updated,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { UpdatedSalesCount = sales.Count })
        }, cancellationToken);

        await saleRepository.SaveChangesAsync(cancellationToken);
        var supplierIds = sales.SelectMany(sale => sale.Items).Where(item => item.SupplierId.HasValue).Select(item => item.SupplierId!.Value).Distinct().ToList();
        await cacheInvalidationService.InvalidateDashboardAsync(supplierIds, cancellationToken: cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(supplierIds: supplierIds, cancellationToken: cancellationToken);
        return new CardFeeReprocessResultDto(sales.Count);
    }

    public static void RecalculateSaleAmounts(Sale sale, CardFeeSettings settings)
    {
        sale.TotalAmount = decimal.Round(sale.Items.Sum(item => item.TotalPrice), 2, MidpointRounding.AwayFromZero);
        sale.CostAmount = decimal.Round(sale.Items.Sum(item => item.CostPrice * item.Quantity), 2, MidpointRounding.AwayFromZero);
        sale.FeeAmount = CardFeeCalculator.CalculateFee(sale.TotalAmount, sale.PaymentMethod, settings);
        sale.NetReceivedAmount = decimal.Round(sale.TotalAmount - sale.FeeAmount, 2, MidpointRounding.AwayFromZero);

        decimal allocatedFee = 0m;
        var items = sale.Items.ToList();
        for (var index = 0; index < items.Count; index++)
        {
            var item = items[index];
            var itemFee = CardFeeCalculator.AllocateFee(item.TotalPrice, sale.TotalAmount, sale.FeeAmount, allocatedFee, index == items.Count - 1);
            allocatedFee += itemFee;

            var itemCost = item.CostPrice * item.Quantity;
            var marginAfterFees = item.TotalPrice - itemFee - itemCost;
            var gainFactor = item.SupplierId.HasValue
                ? item.LojinhaGainPercentage / 100m
                : 1m;

            var grossGain = marginAfterFees * gainFactor;
            var netGain = grossGain - (item.IsCommissionedSale ? item.CommissionAmount : 0m);
            item.LojinhaGainAmount = decimal.Round(netGain, 2, MidpointRounding.AwayFromZero);
        }

        sale.ProfitAmount = decimal.Round(sale.Items.Sum(item => item.LojinhaGainAmount), 2, MidpointRounding.AwayFromZero);
    }

    private async Task<CardFeeSettings> GetOrCreateSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = settingsRepository.Query().FirstOrDefault();
        if (settings is not null)
        {
            return settings;
        }

        settings = CreateDefaultSettings();
        await settingsRepository.AddAsync(settings, cancellationToken);
        await settingsRepository.SaveChangesAsync(cancellationToken);
        return settings;
    }

    public static CardFeeSettings CreateDefaultSettings()
        => new()
        {
            CreditCardPercentage = 2m,
            DebitCardPercentage = 2m,
            AdditionalPercentage = 0m,
            AdditionalFixedAmount = 0m
        };

    private static CardFeeSettingsDto Map(CardFeeSettings settings)
        => new(
            settings.CreditCardPercentage,
            settings.DebitCardPercentage,
            settings.AdditionalPercentage,
            settings.AdditionalFixedAmount,
            decimal.Round(settings.CreditCardPercentage + settings.AdditionalPercentage, 2, MidpointRounding.AwayFromZero),
            decimal.Round(settings.DebitCardPercentage + settings.AdditionalPercentage, 2, MidpointRounding.AwayFromZero));
}
