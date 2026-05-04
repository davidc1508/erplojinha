using System.Text.Json;
using Lojinha.Api.Application.Abstractions;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.Fairs;
using Lojinha.Api.Contracts.Sales;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;
using Lojinha.Api.Services;

namespace Lojinha.Api.Application.Features.Fairs;

internal static class FairFinanceCategories
{
    public const string StoreFairRegistrationCategory = "Inscricao de feira";
    public const string SupplierFairPayableCategory = "Contas a pagar de feiras";
}

public sealed record CreateFairCommand(FairRequest Request, string Actor) : ICommand<FairDto>;

public sealed class CreateFairCommandHandler(
    IAppCacheInvalidationService cacheInvalidationService,
    IFairRepository fairRepository,
    IRepository<Supplier> supplierRepository,
    IRepository<FairSupplier> fairSupplierRepository,
    IRepository<FinancialEntry> financeRepository,
    IRepository<AuditLog> auditRepository) : ICommandHandler<CreateFairCommand, FairDto>
{
    public async Task<FairDto> HandleAsync(CreateFairCommand command, CancellationToken cancellationToken = default)
    {
        var fair = new Fair();
        fair.UpdateDetails(
            command.Request.Name,
            command.Request.EventDateUtc,
            command.Request.EndDateUtc,
            command.Request.Location,
            command.Request.RegistrationFee,
            command.Request.RegistrationFeeSplitCount,
            command.Request.Notes ?? string.Empty);
        await fairRepository.AddAsync(fair, cancellationToken);
        await FairSupplierSync.SyncAsync(fair, command.Request.SupplierIds, supplierRepository, fairSupplierRepository, cancellationToken);

        var supplierIds = command.Request.SupplierIds?
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList() ?? [];
        var supplierCount = supplierIds.Count;
        var validInstallments = command.Request.RegistrationInstallments
            .Select((installment, index) => new { installment, index })
            .Where(item => item.installment.Amount > 0)
            .ToList();

        for (var index = 0; index < validInstallments.Count; index++)
        {
            var installment = validInstallments[index].installment;
            var dueDateUtc = NormalizeUtcDate(installment.DueDateUtc);
            var installmentAmount = decimal.Round(installment.Amount, 2, MidpointRounding.AwayFromZero);
            var supplierInstallmentPool = decimal.Round(installmentAmount / 2m, 2, MidpointRounding.AwayFromZero);

            await financeRepository.AddAsync(new FinancialEntry
            {
                Type = FinancialEntryType.Expense,
                Classification = FinancialClassification.Fixed,
                Category = FairFinanceCategories.StoreFairRegistrationCategory,
                Description = $"{fair.Name} - parcela {index + 1}/{validInstallments.Count}",
                Amount = installmentAmount,
                OccurredOnUtc = dueDateUtc,
                ReferenceId = fair.Id
            }, cancellationToken);

            if (supplierCount == 0)
            {
                continue;
            }

            var roundedShares = new decimal[supplierCount];
            var baseShare = decimal.Round(supplierInstallmentPool / supplierCount, 2, MidpointRounding.AwayFromZero);
            for (var supplierIndex = 0; supplierIndex < supplierCount; supplierIndex++)
            {
                roundedShares[supplierIndex] = baseShare;
            }

            var roundedTotal = roundedShares.Sum();
            var difference = decimal.Round(supplierInstallmentPool - roundedTotal, 2, MidpointRounding.AwayFromZero);
            if (difference != 0m)
            {
                roundedShares[^1] = decimal.Round(roundedShares[^1] + difference, 2, MidpointRounding.AwayFromZero);
            }

            for (var supplierIndex = 0; supplierIndex < supplierCount; supplierIndex++)
            {
                await financeRepository.AddAsync(new FinancialEntry
                {
                    Type = FinancialEntryType.Expense,
                    Classification = FinancialClassification.Fixed,
                    Category = FairFinanceCategories.SupplierFairPayableCategory,
                    Description = $"{fair.Name} - parcela {index + 1}/{validInstallments.Count}",
                    Amount = roundedShares[supplierIndex],
                    OccurredOnUtc = dueDateUtc,
                    ReferenceId = fair.Id,
                    SupplierId = supplierIds[supplierIndex]
                }, cancellationToken);
            }
        }

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Fair),
            EntityId = fair.Id.ToString(),
            Action = AuditAction.Created,
            ChangedBy = command.Actor,
            PayloadJson = JsonSerializer.Serialize(new { fair.Name, fair.EventDateUtc, fair.EndDateUtc, fair.Location, fair.RegistrationFee, fair.RegistrationFeeSplitCount, fair.Status })
        }, cancellationToken);
        await fairRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(fair.Id, command.Request.SupplierIds, cancellationToken);
        var createdFair = await fairRepository.GetDetailedByIdAsync(fair.Id, cancellationToken) ?? fair;
        return createdFair.ToDto();
    }

    private static DateTime NormalizeUtcDate(DateTime value)
        => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}

public sealed record UpdateFairCommand(Guid FairId, FairRequest Request, string Actor) : ICommand<FairDto?>;

public sealed class UpdateFairCommandHandler(
    IAppCacheInvalidationService cacheInvalidationService,
    IFairRepository fairRepository,
    IRepository<Supplier> supplierRepository,
    IRepository<FairSupplier> fairSupplierRepository,
    IRepository<AuditLog> auditRepository) : ICommandHandler<UpdateFairCommand, FairDto?>
{
    public async Task<FairDto?> HandleAsync(UpdateFairCommand command, CancellationToken cancellationToken = default)
    {
        var fair = await fairRepository.GetByIdAsync(command.FairId, cancellationToken);
        if (fair is null)
        {
            return null;
        }

        fair.UpdateDetails(
            command.Request.Name,
            command.Request.EventDateUtc,
            command.Request.EndDateUtc,
            command.Request.Location,
            command.Request.RegistrationFee,
            command.Request.RegistrationFeeSplitCount,
            command.Request.Notes ?? string.Empty);
        await FairSupplierSync.SyncAsync(fair, command.Request.SupplierIds, supplierRepository, fairSupplierRepository, cancellationToken);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Fair),
            EntityId = fair.Id.ToString(),
            Action = AuditAction.Updated,
            ChangedBy = command.Actor,
            PayloadJson = JsonSerializer.Serialize(new { fair.Name, fair.EventDateUtc, fair.EndDateUtc, fair.Location, fair.RegistrationFee, fair.RegistrationFeeSplitCount, fair.Status })
        }, cancellationToken);
        await fairRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(fair.Id, command.Request.SupplierIds, cancellationToken);
        var updatedFair = await fairRepository.GetDetailedByIdAsync(fair.Id, cancellationToken) ?? fair;
        return updatedFair.ToDto();
    }

}

internal static class FairSupplierSync
{
    public static async Task SyncAsync(
        Fair fair,
        IReadOnlyList<Guid>? supplierIds,
        IRepository<Supplier> supplierRepository,
        IRepository<FairSupplier> fairSupplierRepository,
        CancellationToken cancellationToken)
    {
        var distinctSupplierIds = supplierIds?
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList() ?? [];

        var suppliers = distinctSupplierIds.Count == 0
            ? []
            : supplierRepository.Query()
                .Where(supplier => distinctSupplierIds.Contains(supplier.Id))
                .ToList();

        if (suppliers.Count != distinctSupplierIds.Count)
        {
            throw new InvalidOperationException("Um ou mais fornecedores informados nao foram encontrados.");
        }

        var currentLinks = fairSupplierRepository.Query()
            .Where(link => link.FairId == fair.Id)
            .ToList();

        foreach (var link in currentLinks.Where(link => !distinctSupplierIds.Contains(link.SupplierId)))
        {
            fairSupplierRepository.Remove(link);
        }

        var existingSupplierIds = currentLinks
            .Where(link => distinctSupplierIds.Contains(link.SupplierId))
            .Select(link => link.SupplierId)
            .ToHashSet();

        foreach (var supplier in suppliers.OrderBy(supplier => supplier.Name))
        {
            if (existingSupplierIds.Contains(supplier.Id))
            {
                continue;
            }

            await fairSupplierRepository.AddAsync(new FairSupplier
            {
                FairId = fair.Id,
                SupplierId = supplier.Id,
                Supplier = supplier
            }, cancellationToken);
        }

        fair.RegistrationFeeSplitCount = Math.Max(1, distinctSupplierIds.Count + 1);
    }
}

public sealed record FinalizeFairCommand(Guid FairId, string Actor) : ICommand<FairDto?>;

public sealed record ReopenFairCommand(Guid FairId, string Actor) : ICommand<FairDto?>;

public sealed record CancelFairCommand(Guid FairId, string Actor) : ICommand<FairDto?>;

public sealed class FinalizeFairCommandHandler(
    IAppCacheInvalidationService cacheInvalidationService,
    IFairRepository fairRepository,
    IRepository<AuditLog> auditRepository) : ICommandHandler<FinalizeFairCommand, FairDto?>
{
    public async Task<FairDto?> HandleAsync(FinalizeFairCommand command, CancellationToken cancellationToken = default)
    {
        var fair = await fairRepository.GetDetailedByIdAsync(command.FairId, cancellationToken);
        if (fair is null)
        {
            return null;
        }

        fair.FinalizeFair();
        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Fair),
            EntityId = fair.Id.ToString(),
            Action = AuditAction.Finalized,
            ChangedBy = command.Actor,
            PayloadJson = JsonSerializer.Serialize(new { fair.Name, fair.Status, fair.FinalizedAtUtc })
        }, cancellationToken);
        await fairRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(fair.Id, fair.Suppliers.Select(link => link.SupplierId), cancellationToken);
        return fair.ToDto();
    }
}

public sealed class ReopenFairCommandHandler(
    IAppCacheInvalidationService cacheInvalidationService,
    IFairRepository fairRepository,
    IRepository<AuditLog> auditRepository) : ICommandHandler<ReopenFairCommand, FairDto?>
{
    public async Task<FairDto?> HandleAsync(ReopenFairCommand command, CancellationToken cancellationToken = default)
    {
        var fair = await fairRepository.GetDetailedByIdAsync(command.FairId, cancellationToken);
        if (fair is null)
        {
            return null;
        }

        fair.ReopenFair();
        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Fair),
            EntityId = fair.Id.ToString(),
            Action = AuditAction.Reopened,
            ChangedBy = command.Actor,
            PayloadJson = JsonSerializer.Serialize(new { fair.Name, fair.Status, fair.FinalizedAtUtc })
        }, cancellationToken);
        await fairRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(fair.Id, fair.Suppliers.Select(link => link.SupplierId), cancellationToken);
        return fair.ToDto();
    }
}

public sealed class CancelFairCommandHandler(
    IAppCacheInvalidationService cacheInvalidationService,
    IFairRepository fairRepository,
    IRepository<FinancialEntry> financeRepository,
    IRepository<AuditLog> auditRepository) : ICommandHandler<CancelFairCommand, FairDto?>
{
    public async Task<FairDto?> HandleAsync(CancelFairCommand command, CancellationToken cancellationToken = default)
    {
        var fair = await fairRepository.GetDetailedByIdAsync(command.FairId, cancellationToken);
        if (fair is null)
        {
            return null;
        }

        var relatedFairExpenses = financeRepository.Query()
            .Where(entry => entry.ReferenceId == fair.Id
                && entry.Type == FinancialEntryType.Expense
                && (entry.Category == FairFinanceCategories.StoreFairRegistrationCategory
                    || entry.Category == FairFinanceCategories.SupplierFairPayableCategory))
            .ToList();

        foreach (var expense in relatedFairExpenses)
        {
            financeRepository.Remove(expense);
        }

        fair.CancelFair();
        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Fair),
            EntityId = fair.Id.ToString(),
            Action = AuditAction.Cancelled,
            ChangedBy = command.Actor,
            PayloadJson = JsonSerializer.Serialize(new { fair.Name, fair.Status, CancelledExpenseEntries = relatedFairExpenses.Count })
        }, cancellationToken);
        await fairRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(fair.Id, fair.Suppliers.Select(link => link.SupplierId), cancellationToken);
        return fair.ToDto();
    }
}

public sealed record RegisterFairSaleCommand(Guid FairId, CreateSaleRequest Request, string Actor) : ICommand<SaleDto>;

public sealed class RegisterFairSaleCommandHandler(ISalesService salesService) : ICommandHandler<RegisterFairSaleCommand, SaleDto>
{
    public Task<SaleDto> HandleAsync(RegisterFairSaleCommand command, CancellationToken cancellationToken = default)
    => salesService.CreateAsync(command.Request, command.Actor, null, command.FairId, cancellationToken);
}

public sealed record DeleteFairCommand(Guid FairId, string Actor) : ICommand<bool>;

public sealed class DeleteFairCommandHandler(
    IAppCacheInvalidationService cacheInvalidationService,
    IFairRepository fairRepository,
    ISalesService salesService,
    IRepository<AuditLog> auditRepository) : ICommandHandler<DeleteFairCommand, bool>
{
    public async Task<bool> HandleAsync(DeleteFairCommand command, CancellationToken cancellationToken = default)
    {
        var fair = await fairRepository.GetDetailedByIdAsync(command.FairId, cancellationToken);
        if (fair is null)
        {
            return false;
        }

        var saleIds = fair.Sales.Select(sale => sale.Id).ToList();
        var supplierIds = fair.Suppliers.Select(link => link.SupplierId).ToList();
        foreach (var saleId in saleIds)
        {
            await salesService.DeleteAsync(saleId, command.Actor, null, cancellationToken);
        }

                await cacheInvalidationService.InvalidateFairReadModelsAsync(command.FairId, supplierIds, cancellationToken);
        var fairAuditLogs = auditRepository.Query()
            .Where(log => log.EntityName == nameof(Fair) && log.EntityId == command.FairId.ToString())
            .ToList();

        var currentFair = await fairRepository.GetByIdAsync(command.FairId, cancellationToken);
        if (currentFair is null)
        {
            return false;
        }

        foreach (var fairAuditLog in fairAuditLogs)
        {
            auditRepository.Remove(fairAuditLog);
        }

        fairRepository.Remove(currentFair);
        await fairRepository.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed record StartFairCommand(Guid FairId, string Actor) : ICommand<FairDto?>;

public sealed class StartFairCommandHandler(
    IAppCacheInvalidationService cacheInvalidationService,
    IFairRepository fairRepository,
    IRepository<AuditLog> auditRepository) : ICommandHandler<StartFairCommand, FairDto?>
{
    public async Task<FairDto?> HandleAsync(StartFairCommand command, CancellationToken cancellationToken = default)
    {
        var fair = await fairRepository.GetDetailedByIdAsync(command.FairId, cancellationToken);
        if (fair is null)
        {
            return null;
        }

        fair.StartFair();
        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Fair),
            EntityId = fair.Id.ToString(),
            Action = AuditAction.Updated,
            ChangedBy = command.Actor,
            PayloadJson = JsonSerializer.Serialize(new { fair.Name, fair.Status })
        }, cancellationToken);
        await fairRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateFairReadModelsAsync(fair.Id, fair.Suppliers.Select(link => link.SupplierId), cancellationToken);
        return fair.ToDto();
    }
}