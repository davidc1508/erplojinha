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

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}