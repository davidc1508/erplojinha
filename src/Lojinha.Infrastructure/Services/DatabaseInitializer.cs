using System.Text.RegularExpressions;
using Lojinha.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Services;

public interface IDatabaseInitializer
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
}

public sealed class DatabaseInitializer(
    Data.AppDbContext dbContext) : IDatabaseInitializer
{
    private static readonly Guid TargetSaleId = Guid.Parse("9b8e5dcf-1170-4752-af45-c8fbe7eb9230");
    private readonly PasswordHasher<User> _passwordHasher = new();

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await dbContext.Database.MigrateAsync(cancellationToken);

        var cardFeeSettings = await dbContext.CardFeeSettings.FirstOrDefaultAsync(cancellationToken);
        if (cardFeeSettings is null)
        {
            cardFeeSettings = CardFeeSettingsService.CreateDefaultSettings();
            dbContext.CardFeeSettings.Add(cardFeeSettings);
        }

        if (!await dbContext.Users.AnyAsync(cancellationToken))
        {
            var user = new User
            {
                Email = "admin@lojinha.local",
                FullName = "Administrador",
                Role = UserRole.Admin
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, "Admin@123");
            dbContext.Users.Add(user);
        }

        var salesToBackfill = await dbContext.Sales
            .Include(sale => sale.Items)
                .ThenInclude(item => item.Product)
            .Where(sale => sale.NetReceivedAmount == 0m && sale.TotalAmount > 0m)
            .ToListAsync(cancellationToken);

        foreach (var sale in salesToBackfill)
        {
            CardFeeSettingsService.RecalculateSaleAmounts(sale, cardFeeSettings);

            var financialEntries = await dbContext.FinancialEntries
                .Where(entry => entry.ReferenceId == sale.Id && entry.Type == FinancialEntryType.Income)
                .ToListAsync(cancellationToken);

            foreach (var entry in financialEntries)
            {
                entry.Amount = sale.NetReceivedAmount;
            }
        }

        await MoveLegacySaleTodosToRestockAsync(cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task MoveLegacySaleTodosToRestockAsync(CancellationToken cancellationToken)
    {
        var legacyTodoItems = await dbContext.OperationalTodoItems
            .Where(item => item.Source.Contains(TargetSaleId.ToString()))
            .ToListAsync(cancellationToken);

        if (legacyTodoItems.Count == 0)
        {
            return;
        }

        var saleIds = legacyTodoItems
            .Select(item => ExtractSaleId(item.Source))
            .Where(id => id.HasValue && id.Value == TargetSaleId)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        if (saleIds.Count == 0)
        {
            return;
        }

        var sales = await dbContext.Sales
            .Include(sale => sale.Items)
            .Where(sale => saleIds.Contains(sale.Id))
            .ToListAsync(cancellationToken);

        var salesById = sales.ToDictionary(sale => sale.Id);
        var restockKeys = await dbContext.OperationalRestockItems
            .Select(item => new { item.ProductId, item.OwnerSupplierId, item.Notes })
            .ToListAsync(cancellationToken);

        var existingRestockKeys = restockKeys
            .Select(item => (item.ProductId, item.OwnerSupplierId, item.Notes))
            .ToHashSet();

        foreach (var legacyTodo in legacyTodoItems)
        {
            var saleId = ExtractSaleId(legacyTodo.Source);
            if (!saleId.HasValue || !salesById.TryGetValue(saleId.Value, out var sale))
            {
                continue;
            }

            var saleGroups = sale.Items
                .GroupBy(item => new { item.ProductId, item.SupplierId })
                .Select(group => new
                {
                    group.Key.ProductId,
                    group.Key.SupplierId,
                    Quantity = group.Sum(item => item.Quantity)
                });

            foreach (var group in saleGroups)
            {
                var restockKey = (group.ProductId, legacyTodo.OwnerSupplierId, legacyTodo.Source);
                if (existingRestockKeys.Contains(restockKey))
                {
                    continue;
                }

                dbContext.OperationalRestockItems.Add(new OperationalRestockItem
                {
                    ProductId = group.ProductId,
                    OwnerSupplierId = legacyTodo.OwnerSupplierId,
                    TargetQuantity = decimal.Round(group.Quantity, 2),
                    Priority = OperationalItemPriority.Medium,
                    Status = RestockTaskStatus.Open,
                    Notes = legacyTodo.Source,
                    DueDateUtc = null,
                    CompletedAtUtc = null,
                    CreatedAtUtc = legacyTodo.CreatedAtUtc,
                    UpdatedAtUtc = legacyTodo.UpdatedAtUtc
                });

                existingRestockKeys.Add(restockKey);
            }

            dbContext.OperationalTodoItems.Remove(legacyTodo);
        }
    }

    private static Guid? ExtractSaleId(string source)
    {
        var match = Regex.Match(source, @"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})");
        return match.Success && Guid.TryParse(match.Groups[1].Value, out var saleId) ? saleId : null;
    }
}