using Lojinha.Api.Application.DependencyInjection;
using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Contracts.Sales;
using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Lojinha.Api.Infrastructure.DependencyInjection;
using Lojinha.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lojinha.Api.Tests.Services;

public sealed class ComboServiceTests
{
    [Fact]
    public async Task CreateAndUpdate_ShouldCalculateCostAndDefaultPrice_AndAllowManualPrice()
    {
        await using var provider = CreateProvider();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var (first, second) = await SeedProducts(db);
        var service = scope.ServiceProvider.GetRequiredService<IProductService>();
        var request = Request(first, second);

        var combo = await service.CreateAsync(request, "teste");

        Assert.Equal(50m, combo.SalePrice);
        Assert.Equal(17m, combo.CostPrice);
        Assert.Equal(33m, combo.SalePrice - combo.CostPrice);
        Assert.Equal(5m, combo.CurrentStock);
        Assert.Equal(2, combo.ComboItems!.Count);
        Assert.Empty(db.InventoryMovements);
        Assert.Empty(db.FinancialEntries);

        var updated = await service.UpdateAsync(combo.Id, request with { SalePrice = 20m }, "teste");
        Assert.NotNull(updated);
        Assert.Equal(20m, updated.SalePrice);
        Assert.Equal(17m, updated.CostPrice);
        Assert.Equal(0.15m, updated.ProfitMargin);
        Assert.Equal(0m, (await db.Products.FindAsync(combo.Id))!.CurrentStock);
        Assert.Equal(10m, first.CurrentStock);
        Assert.Equal(12m, second.CurrentStock);
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteAsync(first.Id, "teste"));
        Assert.Equal("Não é possível excluir um produto utilizado em combos ou em vendas de combos.", error.Message);
    }

    [Theory]
    [InlineData("single")]
    [InlineData("duplicate")]
    [InlineData("zero")]
    [InlineData("fractional")]
    [InlineData("missing")]
    [InlineData("nested")]
    [InlineData("budget")]
    [InlineData("supplier")]
    public async Task Create_ShouldRejectInvalidComposition_WithoutWrites(string invalidCase)
    {
        await using var provider = CreateProvider();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var (first, second) = await SeedProducts(db);
        var request = Request(first, second);
        var items = request.ComboItems!.ToList();
        Guid? supplierId = null;
        switch (invalidCase)
        {
            case "single": items.RemoveAt(1); break;
            case "duplicate": items[1] = items[0]; break;
            case "zero": items[0] = items[0] with { Quantity = 0m }; break;
            case "fractional": items[0] = items[0] with { Quantity = 1.5m }; break;
            case "missing": items[0] = items[0] with { ProductId = Guid.NewGuid() }; break;
            case "nested": second.ProductType = ProductType.Combo; break;
            case "budget": second.LifecycleStatus = ProductLifecycleStatus.Orcamento; break;
            case "supplier": supplierId = Guid.NewGuid(); break;
        }
        await db.SaveChangesAsync();
        var service = scope.ServiceProvider.GetRequiredService<IProductService>();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(request with { ComboItems = items }, "teste", supplierId));

        Assert.Equal(2, await db.Products.CountAsync());
        Assert.Empty(db.ProductComboItems);
        Assert.Empty(db.AuditLogs);
        Assert.Empty(db.InventoryMovements);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task Sell_ShouldMoveAndRestockComponents_AndReverseOriginalComposition(bool inFair, bool restock)
    {
        await using var provider = CreateProvider();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var (first, second) = await SeedProducts(db);
        first.GenerateProductionExpenseOnStockEntry = true;
        var productService = scope.ServiceProvider.GetRequiredService<IProductService>();
        var combo = await productService.CreateAsync(Request(first, second) with { SalePrice = 45m }, "teste");
        var fair = new Fair { Name = "Feira de teste", EventDateUtc = DateTime.UtcNow, EndDateUtc = DateTime.UtcNow };
        if (inFair) { db.Fairs.Add(fair); await db.SaveChangesAsync(); }
        var salesService = scope.ServiceProvider.GetRequiredService<ISalesService>();

        var sale = await salesService.CreateAsync(new CreateSaleRequest(PaymentMethod.Pix, null, null,
            [new SaleItemRequest(combo.Id, null, 2m, null, null), new SaleItemRequest(first.Id, null, 1m, null, null)],
            CreateTodoForProducedItems: restock), "teste", fairId: inFair ? fair.Id : null);
        db.ChangeTracker.Clear();

        Assert.Equal(110m, sale.TotalAmount);
        Assert.Equal(40m, sale.CostAmount);
        Assert.Equal(2, sale.Items.Count);
        Assert.Equal(5m, (await db.Products.FindAsync(first.Id))!.CurrentStock);
        Assert.Equal(10m, (await db.Products.FindAsync(second.Id))!.CurrentStock);
        Assert.Equal(0m, (await db.Products.FindAsync(combo.Id))!.CurrentStock);
        Assert.Equal(2, await db.SaleItemComponents.CountAsync());
        Assert.Equal(5m, await db.InventoryMovements.Where(item => item.ItemId == first.Id).SumAsync(item => item.Quantity));
        Assert.Equal(2m, await db.InventoryMovements.Where(item => item.ItemId == second.Id).SumAsync(item => item.Quantity));
        Assert.DoesNotContain(db.InventoryMovements, item => item.ItemId == combo.Id);
        Assert.Equal(10m, await db.FinancialEntries.Where(entry => entry.Type == FinancialEntryType.Expense).SumAsync(entry => entry.Amount));
        if (restock)
        {
            Assert.Equal(2, await db.OperationalRestockItems.CountAsync());
            Assert.Equal(5m, (await db.OperationalRestockItems.SingleAsync(item => item.ProductId == first.Id)).TargetQuantity);
            Assert.Equal(2m, (await db.OperationalRestockItems.SingleAsync(item => item.ProductId == second.Id)).TargetQuantity);
        }
        else Assert.Empty(db.OperationalRestockItems);

        var replacement = new Product { Name = "Produto C", Sku = "C", NumericIdentifier = 4, CategoryId = first.CategoryId, CostPrice = 3m, SalePrice = 8m, CurrentStock = 7m };
        db.Products.Add(replacement);
        await db.SaveChangesAsync();
        var request = Request(first, second) with { ComboItems = [new(first.Id, 1m), new(replacement.Id, 3m)], SalePrice = 45m };
        var changed = await productService.UpdateAsync(combo.Id, request, "teste");
        Assert.Equal(15m, changed!.CostPrice);
        Assert.Equal(2, await db.ProductComboItems.CountAsync());
        Assert.DoesNotContain(db.ProductComboItems, item => item.ProductId == second.Id);
        db.ChangeTracker.Clear();
        Assert.True(await salesService.DeleteAsync(sale.Id, "teste"));
        db.ChangeTracker.Clear();

        Assert.Equal(10m, (await db.Products.FindAsync(first.Id))!.CurrentStock);
        Assert.Equal(12m, (await db.Products.FindAsync(second.Id))!.CurrentStock);
        Assert.Equal(7m, (await db.Products.FindAsync(replacement.Id))!.CurrentStock);
        Assert.Empty(db.Sales);
        Assert.Empty(db.SaleItemComponents);
        Assert.Empty(db.InventoryMovements);
        Assert.Empty(db.FinancialEntries);
        Assert.All(db.OperationalRestockItems, item => Assert.True(item.TargetQuantity == 0m || item.Status == RestockTaskStatus.Cancelled));
    }

    private static ServiceProvider CreateProvider()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDistributedMemoryCache();
        services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddApplicationLayer();
        services.AddInfrastructureLayer();
        return services.BuildServiceProvider();
    }

    private static async Task<(Product First, Product Second)> SeedProducts(AppDbContext db)
    {
        var category = new ProductCategory { Name = "Categoria", NumericIdentifier = 1 };
        var first = new Product { Name = "Produto A", Sku = "A", NumericIdentifier = 1, Category = category, SalePrice = 20m, CostPrice = 6m, CurrentStock = 10m };
        var second = new Product { Name = "Produto B", Sku = "B", NumericIdentifier = 2, Category = category, SalePrice = 10m, CostPrice = 5m, CurrentStock = 12m };
        db.Products.AddRange(first, second);
        await db.SaveChangesAsync();
        return (first, second);
    }

    private static ProductRequest Request(Product first, Product second)
        => new("Combo de teste", "COMBO", null, first.CategoryId, null, false, 0m, 1, 0m, 0m, 0m, 0m, 0m, 0m,
            null, [], null, 0m, 2m, null, null, ProductType: ProductType.Combo,
            ComboItems: [new(first.Id, 2m), new(second.Id, 1m)]);
}