using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.OperationalLists;
using Lojinha.Api.Data;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;
using Lojinha.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Tests.Services;

public sealed class SalesServiceTests
{
    [Fact]
    public async Task CreateAsync_ShouldAllowSale_WhenStockIsInsufficient()
    {
        await using var dbContext = CreateDbContext();
        var category = new ProductCategory { Name = "Teste", Description = "Teste" };
        var product = new Product
        {
            Name = "Produto sem estoque",
            Sku = "PROD-SEM-ESTOQUE",
            Category = category,
            CostPrice = 10m,
            SalePrice = 20m,
            SuggestedPrice = 18m,
            CurrentStock = 0m,
            MinimumStock = 1m
        };

        dbContext.Categories.Add(category);
        dbContext.Products.Add(product);
        await dbContext.SaveChangesAsync();

        var service = new SalesService(
            new NoOpCacheInvalidationService(),
            new ProductRepository(dbContext),
            new FairRepository(dbContext),
            new SaleRepository(dbContext),
            new InventoryRepository(dbContext),
            new Repository<Supplier>(dbContext),
            new Repository<CardFeeSettings>(dbContext),
            new Repository<FinancialEntry>(dbContext),
            new Repository<AuditLog>(dbContext),
            new NoOpOperationalListService());

        var sale = await service.CreateAsync(
            new Contracts.Sales.CreateSaleRequest(
                PaymentMethod.Pix,
                null,
                null,
                [new Contracts.Sales.SaleItemRequest(product.Id, null, 1m, null, null)]),
            "teste");

        var savedProduct = await dbContext.Products.SingleAsync();
        var savedMovement = await dbContext.InventoryMovements.SingleAsync();

        Assert.Equal(20m, sale.TotalAmount);
        Assert.Equal(0m, savedProduct.CurrentStock);
        Assert.Equal(InventoryItemType.Product, savedMovement.ItemType);
        Assert.Equal(InventoryMovementType.Sale, savedMovement.Type);
    }

    [Fact]
    public async Task DeleteAsync_ShouldRestoreProductStock_AndRemoveRelatedRecords()
    {
        await using var dbContext = CreateDbContext();
        var category = new ProductCategory { Name = "Categoria", Description = "Teste" };
        var product = new Product
        {
            Name = "Produto 1",
            Sku = "PROD-001",
            Category = category,
            CostPrice = 12m,
            SalePrice = 30m,
            SuggestedPrice = 30m,
            CurrentStock = 5m,
            MinimumStock = 1m
        };

        dbContext.Categories.Add(category);
        dbContext.Products.Add(product);
        await dbContext.SaveChangesAsync();

        var service = new SalesService(
            new NoOpCacheInvalidationService(),
            new ProductRepository(dbContext),
            new FairRepository(dbContext),
            new SaleRepository(dbContext),
            new InventoryRepository(dbContext),
            new Repository<Supplier>(dbContext),
            new Repository<CardFeeSettings>(dbContext),
            new Repository<FinancialEntry>(dbContext),
            new Repository<AuditLog>(dbContext),
            new NoOpOperationalListService());

        var sale = await service.CreateAsync(
            new Contracts.Sales.CreateSaleRequest(
                PaymentMethod.Pix,
                null,
                null,
                [new Contracts.Sales.SaleItemRequest(product.Id, null, 2m, null, null)]),
            "teste");

        var deleted = await service.DeleteAsync(sale.Id, "teste");

        var savedProduct = await dbContext.Products.SingleAsync();

        Assert.True(deleted);
        Assert.Equal(5m, savedProduct.CurrentStock);
        Assert.Empty(dbContext.Sales);
        Assert.Empty(dbContext.SaleItems);
        Assert.Empty(dbContext.InventoryMovements);
        Assert.Empty(dbContext.FinancialEntries);
        Assert.Empty(dbContext.AuditLogs);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private sealed class NoOpCacheInvalidationService : IAppCacheInvalidationService
    {
        public Task InvalidateDashboardAsync(IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task InvalidateProductReadModelsAsync(IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task InvalidateCatalogAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task InvalidateMetadataAsync(IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task InvalidateFairReadModelsAsync(Guid? fairId = null, IEnumerable<Guid>? supplierIds = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class NoOpOperationalListService : IOperationalListService
    {
        public Task<IReadOnlyList<RestockItemDto>> GetRestockItemsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<RestockItemDto>>([]);

        public Task<RestockItemDto> CreateRestockItemAsync(RestockItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<RestockItemDto?> UpdateRestockItemAsync(Guid id, RestockItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
            => Task.FromResult<RestockItemDto?>(null);

        public Task<bool> DeleteRestockItemAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<IReadOnlyList<TodoItemDto>> GetTodoItemsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<TodoItemDto>>([]);

        public Task<TodoItemDto> CreateTodoItemAsync(TodoItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
            => Task.FromResult(new TodoItemDto(Guid.NewGuid(), request.Name, scopedSupplierId, OperationalItemPriority.Medium, request.Source ?? string.Empty, DateTime.UtcNow, DateTime.UtcNow));

        public Task<TodoItemDto?> UpdateTodoItemAsync(Guid id, TodoItemRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
            => Task.FromResult<TodoItemDto?>(null);

        public Task<bool> DeleteTodoItemAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<int> ConsumeRestockTargetAsync(Guid productId, decimal quantityAdded, Guid? scopedSupplierId, string actor, CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }
}