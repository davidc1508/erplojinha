using Lojinha.Api.Contracts.OperationalLists;
using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;
using Lojinha.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Tests.Services;

public sealed class OperationalListServiceTests
{
    [Fact]
    public async Task CreateRestockItemAsync_ShouldIncrementExistingActiveItem()
    {
        await using var dbContext = CreateDbContext();
        var category = new ProductCategory { Name = "Cat", Description = "Desc" };
        var product = new Product
        {
            Name = "Produto",
            Sku = "PROD-RESTOCK-001",
            Category = category,
            CostPrice = 10m,
            SalePrice = 20m,
            SuggestedPrice = 20m,
            CurrentStock = 0m,
            MinimumStock = 1m
        };

        dbContext.Categories.Add(category);
        dbContext.Products.Add(product);
        dbContext.OperationalRestockItems.Add(new OperationalRestockItem
        {
            ProductId = product.Id,
            OwnerSupplierId = null,
            TargetQuantity = 2m,
            Status = RestockTaskStatus.Open,
            Priority = OperationalItemPriority.Medium,
            Notes = "Manual"
        });
        await dbContext.SaveChangesAsync();

        var service = new OperationalListService(
            new Repository<OperationalRestockItem>(dbContext),
            new Repository<OperationalTodoItem>(dbContext),
            new Repository<Product>(dbContext),
            new Repository<AuditLog>(dbContext));

        var created = await service.CreateRestockItemAsync(new RestockItemRequest(product.Id, 1m, "Venda X"), "teste", null);

        var restockRows = dbContext.OperationalRestockItems.ToList();

        Assert.Single(restockRows);
        Assert.Equal(3m, restockRows[0].TargetQuantity);
        Assert.Equal(3m, created.TargetQuantity);
    }

    [Fact]
    public async Task DecreaseRestockTargetAsync_ShouldReduceOnlyRequestedQuantity()
    {
        await using var dbContext = CreateDbContext();
        var category = new ProductCategory { Name = "Cat 2", Description = "Desc" };
        var product = new Product
        {
            Name = "Produto 2",
            Sku = "PROD-RESTOCK-002",
            Category = category,
            CostPrice = 10m,
            SalePrice = 20m,
            SuggestedPrice = 20m,
            CurrentStock = 0m,
            MinimumStock = 1m
        };

        dbContext.Categories.Add(category);
        dbContext.Products.Add(product);
        dbContext.OperationalRestockItems.Add(new OperationalRestockItem
        {
            ProductId = product.Id,
            OwnerSupplierId = null,
            TargetQuantity = 2m,
            Status = RestockTaskStatus.Open,
            Priority = OperationalItemPriority.Medium,
            Notes = "Manual"
        });
        await dbContext.SaveChangesAsync();

        var service = new OperationalListService(
            new Repository<OperationalRestockItem>(dbContext),
            new Repository<OperationalTodoItem>(dbContext),
            new Repository<Product>(dbContext),
            new Repository<AuditLog>(dbContext));

        var affected = await service.DecreaseRestockTargetAsync(product.Id, 1m, null, "teste");

        var restockRow = await dbContext.OperationalRestockItems.SingleAsync();
        Assert.Equal(1, affected);
        Assert.Equal(1m, restockRow.TargetQuantity);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }
}
