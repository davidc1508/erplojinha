using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Domain.Services;
using Lojinha.Api.Entities;

namespace Lojinha.Api.Services;

public sealed partial class ProductService
{
    private async Task<ProductDto?> SaveComboAsync(Guid? id, ProductRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken)
    {
        var product = id.HasValue ? await productRepository.GetDetailedByIdAsync(id.Value, cancellationToken) : new Product { ProductType = ProductType.Combo };
        if (product is null || (id.HasValue && !IsProductVisible(product, scopedSupplierId))) return null;
        if (product.ProductType != ProductType.Combo)
            throw new InvalidOperationException("Cadastre um novo produto do tipo combo para agrupar os itens.");
        if (request.CurrentStock != 0m)
            throw new InvalidOperationException("O estoque do combo é calculado pelos produtos que o compõem.");

        var category = await categoryRepository.GetByIdAsync(request.CategoryId, cancellationToken)
            ?? throw new InvalidOperationException("Categoria não encontrada.");
        var previousSupplierId = product.SupplierId;
        await ApplyComboItemsAsync(product, request, scopedSupplierId, cancellationToken, id.HasValue);
        product.NumericIdentifier = id.HasValue ? product.NumericIdentifier : GetNextProductNumericIdentifier();
        product.Name = NormalizeProductName(request.Name);
        product.Sku = await ResolveSkuAsync(request.Sku, category.NumericIdentifier, product.NumericIdentifier, id, cancellationToken);
        product.Description = request.Description?.Trim() ?? string.Empty;
        product.CategoryId = category.Id;
        product.Category = category;
        product.SupplierId = scopedSupplierId ?? request.SupplierId;
        product.LifecycleStatus = request.IsBudget ? ProductLifecycleStatus.Orcamento : ProductLifecycleStatus.Disponivel;
        product.CostPrice = ComboCalculator.Cost(product);
        product.SuggestedPrice = ComboCalculator.CombinedPrice(product);
        product.SalePrice = request.SalePrice ?? product.SuggestedPrice;
        if (product.SalePrice < 0m) throw new InvalidOperationException("O preço do combo não pode ser negativo.");
        product.CommissionPercentage = NormalizeCommissionPercentage(request.CommissionPercentage);
        product.CommissionedSalePrice = CalculateCommissionedSalePrice(product.SalePrice, product.CommissionPercentage);
        product.ProfitMargin = ComboMargin(product);
        product.CurrentStock = 0m;
        product.GenerateProductionExpenseOnStockEntry = false;

        if (!id.HasValue) await productRepository.AddAsync(product, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(product, id.HasValue ? AuditAction.Updated : AuditAction.Created, actor), cancellationToken);
        await productRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateProductReadModelsAsync(
            new[] { previousSupplierId, product.SupplierId }.Where(value => value.HasValue).Select(value => value!.Value), cancellationToken);
        return Map(product);
    }

    private async Task ApplyComboItemsAsync(Product combo, ProductRequest request, Guid? scopedSupplierId, CancellationToken cancellationToken, bool persistChanges = false)
    {
        var items = request.ComboItems;
        if (items is not { Count: >= 2 } || items.Select(item => item.ProductId).Distinct().Count() != items.Count
            || items.Any(item => item.Quantity <= 0m || item.Quantity != decimal.Truncate(item.Quantity)))
            throw new InvalidOperationException("Selecione pelo menos dois produtos diferentes e informe quantidades inteiras maiores que zero.");

        var products = (await productRepository.GetAllDetailedAsync(cancellationToken)).ToDictionary(product => product.Id);
        foreach (var item in items)
        {
            if (!products.TryGetValue(item.ProductId, out var product) || !IsProductVisible(product, scopedSupplierId))
                throw new InvalidOperationException("Produto não encontrado ou indisponível para compor o combo.");
            if (product.Id == combo.Id || product.ProductType == ProductType.Combo || product.LifecycleStatus == ProductLifecycleStatus.Orcamento)
                throw new InvalidOperationException("Selecione produtos disponíveis que não sejam combos ou orçamentos.");
        }

        foreach (var removed in combo.ComboItems.Where(existing => items.All(item => item.ProductId != existing.ProductId)).ToList())
        {
            combo.ComboItems.Remove(removed);
            if (persistChanges) productComboItemRepository.Remove(removed);
        }
        foreach (var item in items)
        {
            var existing = combo.ComboItems.FirstOrDefault(existing => existing.ProductId == item.ProductId);
            if (existing is null)
            {
                var component = new ProductComboItem { Combo = combo, ProductId = item.ProductId, Product = products[item.ProductId], Quantity = item.Quantity };
                combo.ComboItems.Add(component);
                if (persistChanges) await productComboItemRepository.AddAsync(component, cancellationToken);
            }
            else existing.Quantity = item.Quantity;
        }
    }

    private static decimal ComboMargin(Product product)
        => product.SalePrice <= 0m ? 0m : decimal.Round((product.SalePrice - ComboCalculator.Cost(product)) / product.SalePrice, 4);

    private static PriceSuggestionDto ComboPricing(Product product)
    {
        var cost = ComboCalculator.Cost(product);
        var combinedPrice = ComboCalculator.CombinedPrice(product);
        var commissionedPrice = CalculateCommissionedSalePrice(product.SalePrice, product.CommissionPercentage);
        return new PriceSuggestionDto(cost, cost, cost, 0m, 0m, 0m, 0m, 0m, 0m, combinedPrice, combinedPrice,
            combinedPrice, 1m, combinedPrice, product.CommissionPercentage, commissionedPrice - product.SalePrice,
            commissionedPrice, product.SalePrice, commissionedPrice, product.SalePrice, ComboMargin(product));
    }
}