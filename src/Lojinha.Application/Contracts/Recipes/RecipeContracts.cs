namespace Lojinha.Api.Contracts.Recipes;

public sealed record RecipeItemRequest(Guid SupplyId, decimal Quantity);

public sealed record RecipeItemDto(Guid SupplyId, string SupplyName, decimal Quantity, string Unit, decimal CostPerUnit);

public sealed record RecipeDto(
    Guid ProductId,
    decimal LaborHours,
    decimal LaborCostPerHour,
    decimal AdditionalCosts,
    decimal WholesaleMarkup,
    decimal RetailMarkup,
    decimal ResellerMarkup,
    decimal TotalCost,
    IReadOnlyList<RecipeItemDto> Items);

public sealed record UpsertRecipeRequest(
    decimal LaborHours,
    decimal LaborCostPerHour,
    decimal AdditionalCosts,
    decimal WholesaleMarkup,
    decimal RetailMarkup,
    decimal ResellerMarkup,
    IReadOnlyList<RecipeItemRequest> Items);