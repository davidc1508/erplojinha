using System.Text.Json;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.Finance;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IFinanceService
{
    Task<IReadOnlyList<FinancialEntryDto>> GetEntriesAsync(Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default);
    Task<FinancialEntryDto> CreateAsync(CreateFinancialEntryRequest request, string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default);
    Task<FinanceReportDto> GetReportAsync(int year, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default);
}

public sealed class FinanceService(
    IAppCacheInvalidationService cacheInvalidationService,
    IRepository<FinancialEntry> financeRepository,
    ISaleRepository saleRepository,
    IRepository<Supplier> supplierRepository,
    IFairRepository fairRepository,
    IRepository<AuditLog> auditRepository) : IFinanceService
{
    private const string SupplierFairPayableCategory = "Contas a pagar de feiras";
    private const string SupplierFairPaymentCategory = "Pagamento de cota de feira";
    private const string SupplierFairLegacyPendingCategory = "Pendencia de pagamento em feiras";

    public async Task<IReadOnlyList<FinancialEntryDto>> GetEntriesAsync(Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(scopedResellerActor))
        {
            return (await BuildResellerEntriesAsync(scopedResellerActor, cancellationToken))
                .OrderByDescending(entry => entry.OccurredOnUtc)
                .ToList();
        }

        if (!scopedSupplierId.HasValue)
        {
            return financeRepository.Query()
                .OrderByDescending(x => x.OccurredOnUtc)
                .Select(Map)
                .ToList();
        }

        return (await BuildSupplierEntriesAsync(scopedSupplierId.Value, cancellationToken))
            .OrderByDescending(entry => entry.OccurredOnUtc)
            .ToList();
    }

    public async Task<FinancialEntryDto> CreateAsync(CreateFinancialEntryRequest request, string actor, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default)
    {
        var supplierId = !string.IsNullOrWhiteSpace(scopedResellerActor)
            ? null
            : scopedSupplierId ?? request.SupplierId;
        var normalizedCategory = request.Category.Trim();
        var isSupplierFairPayment = supplierId.HasValue
            && request.Type == FinancialEntryType.Expense
            && IsSupplierFairPaymentCategory(normalizedCategory);

        if (isSupplierFairPayment)
        {
            normalizedCategory = SupplierFairPaymentCategory;

            if (!request.ReferenceId.HasValue)
            {
                throw new InvalidOperationException("Selecione a feira para registrar o pagamento da cota.");
            }

            var fair = await fairRepository.GetByIdAsync(request.ReferenceId.Value, cancellationToken)
                ?? throw new InvalidOperationException("Feira informada para pagamento não foi encontrada.");

            if (!fairRepository.Query()
                .Any(item => item.Id == fair.Id && item.Suppliers.Any(link => link.SupplierId == supplierId)))
            {
                throw new InvalidOperationException("Fornecedor não está vinculado à feira selecionada.");
            }
        }

        string? supplierName = null;
        if (supplierId.HasValue)
        {
            var supplier = await supplierRepository.GetByIdAsync(supplierId.Value, cancellationToken)
                ?? throw new InvalidOperationException("Fornecedor do lançamento não encontrado.");
            supplierName = supplier.Name;
        }

        var entry = new FinancialEntry
        {
            Type = request.Type,
            Classification = request.Classification,
            Category = normalizedCategory,
            Description = request.Description.Trim(),
            Amount = request.Amount,
            OccurredOnUtc = request.OccurredOnUtc ?? DateTime.UtcNow,
            SupplierId = supplierId,
            ReferenceId = request.ReferenceId
        };

        await financeRepository.AddAsync(entry, cancellationToken);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(FinancialEntry),
            EntityId = entry.Id.ToString(),
            Action = AuditAction.Created,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { entry.Type, entry.Category, entry.Amount })
        }, cancellationToken);

        await financeRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateDashboardAsync(
            supplierId.HasValue ? [supplierId.Value] : null,
            !string.IsNullOrWhiteSpace(scopedResellerActor) ? [scopedResellerActor] : null,
            cancellationToken);
        return Map(entry, supplierName);
    }

    public async Task<FinanceReportDto> GetReportAsync(int year, Guid? scopedSupplierId = null, string? scopedResellerActor = null, CancellationToken cancellationToken = default)
    {
        var entries = !string.IsNullOrWhiteSpace(scopedResellerActor)
            ? (await BuildResellerEntriesAsync(scopedResellerActor, cancellationToken)).Where(entry => entry.OccurredOnUtc.Year == year).ToList()
            : scopedSupplierId.HasValue
                ? (await BuildSupplierEntriesAsync(scopedSupplierId.Value, cancellationToken)).Where(entry => entry.OccurredOnUtc.Year == year).ToList()
                : financeRepository.Query()
                    .Where(entry => entry.SupplierId == null && entry.OccurredOnUtc.Year == year)
                    .Select(Map)
                    .ToList();
        var reportEntries = scopedSupplierId.HasValue && string.IsNullOrWhiteSpace(scopedResellerActor)
            ? entries.Where(ShouldIncludeInSupplierReport).ToList()
            : entries;

        var revenue = reportEntries.Where(entry => entry.Type == FinancialEntryType.Income).Sum(entry => entry.Amount);
        var expenses = reportEntries.Where(entry => entry.Type == FinancialEntryType.Expense).Sum(entry => entry.Amount);

        var series = Enumerable.Range(1, 12)
            .Select(month => new MonthlySeriesPointDto(
                new DateTime(year, month, 1).ToString("MMM"),
                reportEntries.Where(entry => entry.Type == FinancialEntryType.Income && entry.OccurredOnUtc.Month == month).Sum(entry => entry.Amount)
                - reportEntries.Where(entry => entry.Type == FinancialEntryType.Expense && entry.OccurredOnUtc.Month == month).Sum(entry => entry.Amount)))
            .ToList();

        var categories = reportEntries
            .GroupBy(entry => entry.Category)
            .Select(group => new CategoryBreakdownDto(group.Key, group.Sum(entry => entry.Amount * (entry.Type == FinancialEntryType.Income ? 1 : -1))))
            .OrderByDescending(item => Math.Abs(item.Amount))
            .ToList();

        return new FinanceReportDto(revenue, expenses, revenue - expenses, series, categories);
    }

    private async Task<IReadOnlyList<FinancialEntryDto>> BuildSupplierEntriesAsync(Guid supplierId, CancellationToken cancellationToken)
    {
        var sales = await saleRepository.GetAllDetailedAsync(cancellationToken);
        var entries = financeRepository.Query()
            .Where(entry => entry.SupplierId == supplierId)
            .Select(Map)
            .ToList();

        foreach (var sale in sales)
        {
            var supplierItems = sale.Items.Where(item => item.SupplierId == supplierId).ToList();
            if (supplierItems.Count == 0)
            {
                continue;
            }

            var grossAmount = supplierItems.Sum(item => item.TotalPrice);
            var commissionAmount = supplierItems.Sum(item => item.LojinhaGainAmount);
            var productionCostAmount = supplierItems.Sum(item => item.CostPrice * item.Quantity);
            var category = sale.FairId.HasValue ? "Venda em feira" : "Venda";
            var description = sale.FairId.HasValue
                ? $"Venda na feira {sale.Fair?.Name ?? sale.Id.ToString()}"
                : $"Venda {sale.Id}";

            entries.Add(new FinancialEntryDto(
                sale.Id,
                FinancialEntryType.Income,
                FinancialClassification.Variable,
                category,
                description,
                grossAmount,
                sale.SoldAtUtc,
                supplierId,
                sale.Items.FirstOrDefault(item => item.SupplierId == supplierId)?.Supplier?.Name,
                sale.Id));

            if (productionCostAmount > 0m)
            {
                entries.Add(new FinancialEntryDto(
                    Guid.NewGuid(),
                    FinancialEntryType.Expense,
                    FinancialClassification.Variable,
                    "Custo das pecas vendidas",
                    $"Custos dos produtos em {description.ToLowerInvariant()}",
                    productionCostAmount,
                    sale.SoldAtUtc,
                    supplierId,
                    sale.Items.FirstOrDefault(item => item.SupplierId == supplierId)?.Supplier?.Name,
                    sale.Id));
            }

            if (commissionAmount > 0m)
            {
                entries.Add(new FinancialEntryDto(
                    Guid.NewGuid(),
                    FinancialEntryType.Expense,
                    FinancialClassification.Variable,
                    "Comissao da lojinha",
                    $"Percentual retido sobre {description.ToLowerInvariant()}",
                    commissionAmount,
                    sale.SoldAtUtc,
                    supplierId,
                    sale.Items.FirstOrDefault(item => item.SupplierId == supplierId)?.Supplier?.Name,
                    sale.Id));
            }
        }

        return entries;
    }

    private async Task<IReadOnlyList<FinancialEntryDto>> BuildResellerEntriesAsync(string actor, CancellationToken cancellationToken)
    {
        var authoredFinanceEntryIds = auditRepository.Query()
            .Where(log => log.EntityName == nameof(FinancialEntry)
                && log.Action == AuditAction.Created
                && log.ChangedBy == actor)
            .Select(log => Guid.Parse(log.EntityId))
            .ToHashSet();

        var entries = financeRepository.Query()
            .Where(entry => authoredFinanceEntryIds.Contains(entry.Id))
            .Select(Map)
            .ToList();

        var sales = await saleRepository.GetAllDetailedAsync(cancellationToken);
        var authoredSaleIds = auditRepository.Query()
            .Where(log => log.EntityName == nameof(Sale)
                && log.Action == AuditAction.Sold
                && log.ChangedBy == actor)
            .Select(log => Guid.Parse(log.EntityId))
            .ToHashSet();

        foreach (var sale in sales.Where(sale => authoredSaleIds.Contains(sale.Id)))
        {
            var grossAmount = sale.Items.Sum(item => item.TotalPrice);
            var productionCostAmount = sale.Items.Sum(item => item.CostPrice * item.Quantity);
            var category = sale.FairId.HasValue ? "Venda em feira" : "Venda";
            var description = sale.FairId.HasValue
                ? $"Venda na feira {sale.Fair?.Name ?? sale.Id.ToString()}"
                : $"Venda {sale.Id}";

            entries.Add(new FinancialEntryDto(
                sale.Id,
                FinancialEntryType.Income,
                FinancialClassification.Variable,
                category,
                description,
                grossAmount,
                sale.SoldAtUtc,
                null,
                null,
                sale.Id));

            if (productionCostAmount > 0m)
            {
                entries.Add(new FinancialEntryDto(
                    Guid.NewGuid(),
                    FinancialEntryType.Expense,
                    FinancialClassification.Variable,
                    "Custo das pecas vendidas",
                    $"Custos dos produtos em {description.ToLowerInvariant()}",
                    productionCostAmount,
                    sale.SoldAtUtc,
                    null,
                    null,
                    sale.Id));
            }

        }

        return entries;
    }

    private static FinancialEntryDto Map(FinancialEntry entry)
        => Map(entry, entry.Supplier?.Name);

    private static FinancialEntryDto Map(FinancialEntry entry, string? supplierName)
        => new(entry.Id, entry.Type, entry.Classification, entry.Category, entry.Description, entry.Amount, entry.OccurredOnUtc, entry.SupplierId, supplierName, entry.ReferenceId);

    private static bool IsSupplierFairPaymentCategory(string category)
        => string.Equals(category, SupplierFairPaymentCategory, StringComparison.OrdinalIgnoreCase)
            || string.Equals(category, SupplierFairLegacyPendingCategory, StringComparison.OrdinalIgnoreCase);

    private static bool ShouldIncludeInSupplierReport(FinancialEntryDto entry)
        => !string.Equals(entry.Category, SupplierFairPayableCategory, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(entry.Category, SupplierFairLegacyPendingCategory, StringComparison.OrdinalIgnoreCase);
}