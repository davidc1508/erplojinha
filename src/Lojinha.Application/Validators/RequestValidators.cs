using FluentValidation;
using Lojinha.Api.Contracts.Catalog;
using Lojinha.Api.Contracts.Auth;
using Lojinha.Api.Contracts.CardFees;
using Lojinha.Api.Contracts.Finance;
using Lojinha.Api.Contracts.Fairs;
using Lojinha.Api.Contracts.Inventory;
using Lojinha.Api.Contracts.OperationalLists;
using Lojinha.Api.Contracts.PaintingPricing;
using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Contracts.Recipes;
using Lojinha.Api.Contracts.Sales;
using Lojinha.Api.Contracts.Suppliers;
using Lojinha.Api.Contracts.Users;
using Lojinha.Api.Entities;

namespace Lojinha.Api.Validators;

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6);
    }
}

public sealed class ImpersonateRequestValidator : AbstractValidator<ImpersonateRequest>
{
    public ImpersonateRequestValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
    }
}

public sealed class ProductRequestValidator : AbstractValidator<ProductRequest>
{
    public ProductRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Sku).MaximumLength(80);
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.CurrentStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ItemsPerPlate).GreaterThan(0);
        RuleFor(x => x.HeightCentimeters).GreaterThanOrEqualTo(0);
        RuleFor(x => x.TariffPerKwh).GreaterThanOrEqualTo(0);
        RuleFor(x => x.FinishingPercentage).InclusiveBetween(0, 1000);
        RuleFor(x => x.CommissionPercentage).InclusiveBetween(0, 99.99m);
        RuleFor(x => x.AdditionalCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.LaborCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DesiredMarkup).GreaterThanOrEqualTo(2);
        RuleFor(x => x)
            .Must(x => x.ProductType != ProductType.Impressao3D
                || !x.Filaments.Any(item => item.FilamentProfileId != Guid.Empty && item.WeightGrams > 0m)
                || x.PrinterProfileId.HasValue)
            .WithMessage("Selecione uma impressora quando houver filamentos para manter o calculo de custo consistente.");
        RuleFor(x => x.PingenteSupplyId)
            .NotNull()
            .When(x => x.ProductType == ProductType.Brinco)
            .WithMessage("Selecione o pingente utilizado no brinco.");
        RuleFor(x => x.PingenteCost)
            .GreaterThanOrEqualTo(0)
            .When(x => x.ProductType == ProductType.Brinco);
        RuleFor(x => x.BottonSizeId)
            .NotNull()
            .When(x => x.ProductType == ProductType.Botton)
            .WithMessage("Selecione o tamanho de botton utilizado.");
        RuleFor(x => x.BottonSizeQuantity)
            .GreaterThan(0)
            .When(x => x.ProductType == ProductType.Botton)
            .WithMessage("Informe a quantidade do tamanho de botton consumida por unidade.");
        RuleFor(x => x.Painting!)
            .SetValidator(new ProductPaintingRequestValidator())
            .When(x => x.Painting is not null);
    }
}

public sealed class UpsertRecipeRequestValidator : AbstractValidator<UpsertRecipeRequest>
{
    public UpsertRecipeRequestValidator()
    {
        RuleFor(x => x.LaborHours).GreaterThanOrEqualTo(0);
        RuleFor(x => x.LaborCostPerHour).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RetailMarkup).GreaterThan(0);
        RuleFor(x => x.ResellerMarkup).GreaterThanOrEqualTo(2);
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(x => x.SupplyId).NotEmpty();
            item.RuleFor(x => x.Quantity).GreaterThan(0);
        });
    }
}

public sealed class SupplierRequestValidator : AbstractValidator<SupplierRequest>
{
    public SupplierRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.ContactName).MaximumLength(150);
        RuleFor(x => x.PhoneNumber).MaximumLength(40);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class ManualInventoryMovementRequestValidator : AbstractValidator<ManualInventoryMovementRequest>
{
    public ManualInventoryMovementRequestValidator()
    {
        RuleFor(x => x.ItemId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.UnitCost).GreaterThanOrEqualTo(0);
    }
}

public sealed class CreateSaleRequestValidator : AbstractValidator<CreateSaleRequest>
{
    public CreateSaleRequestValidator()
    {
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(x => x.ProductId).NotEmpty();
            item.RuleFor(x => x.Quantity).GreaterThan(0);
            item.RuleFor(x => x.LojinhaGainPercentage).InclusiveBetween(0, 100).When(x => x.LojinhaGainPercentage.HasValue);
            item.RuleFor(x => x.CommissionAmount).GreaterThanOrEqualTo(0).When(x => x.CommissionAmount.HasValue);
            item.RuleFor(x => x.CommissionSellerSupplierId)
                .NotEmpty()
                .When(x => x.IsCommissionedSale)
                .WithMessage("Selecione o fornecedor vendedor para vendas comissionadas.");
        });
    }
}

public sealed class CreateFinancialEntryRequestValidator : AbstractValidator<CreateFinancialEntryRequest>
{
    public CreateFinancialEntryRequestValidator()
    {
        RuleFor(x => x.Category).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(250);
        RuleFor(x => x.Amount).GreaterThan(0);
    }
}

public sealed class RestockItemRequestValidator : AbstractValidator<RestockItemRequest>
{
    public RestockItemRequestValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.TargetQuantity).GreaterThan(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class TodoItemRequestValidator : AbstractValidator<TodoItemRequest>
{
    public TodoItemRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Source).MaximumLength(500);
    }
}

public sealed class FairRequestValidator : AbstractValidator<FairRequest>
{
    public FairRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Location).NotEmpty().MaximumLength(180);
        RuleFor(x => x.EndDateUtc)
            .GreaterThanOrEqualTo(x => x.EventDateUtc)
            .WithMessage("A data final da feira nao pode ser anterior a data inicial.");
        RuleFor(x => x.RegistrationFee).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RegistrationFeeSplitCount).GreaterThan(0);
        RuleFor(x => x.StoreFeePercentage).InclusiveBetween(0, 100);
        RuleFor(x => x.RegistrationPaymentStartDateUtc).NotEmpty();
        RuleFor(x => x.RegistrationInstallments).NotEmpty();
        RuleForEach(x => x.RegistrationInstallments).ChildRules(item =>
        {
            item.RuleFor(x => x.DueDateUtc).NotEmpty();
            item.RuleFor(x => x.Amount).GreaterThanOrEqualTo(0);
        });
        RuleFor(x => x)
            .Must(x => decimal.Round(x.RegistrationInstallments.Sum(item => item.Amount), 2, MidpointRounding.AwayFromZero)
                == decimal.Round(x.RegistrationFee, 2, MidpointRounding.AwayFromZero))
            .WithMessage("A soma das parcelas de inscricao deve ser igual ao valor total da inscricao.");
        RuleForEach(x => x.SupplierIds).NotEmpty().When(x => x.SupplierIds is not null);
    }
}

public sealed class FairExpenseRequestValidator : AbstractValidator<FairExpenseRequest>
{
    private static readonly string[] AllowedKinds = ["Alimentacao", "Combustivel", "Hospedagem", "Transporte", "Outros"];

    public FairExpenseRequestValidator()
    {
        RuleFor(x => x.Description).NotEmpty().MaximumLength(250);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Kind)
            .Must(kind => string.IsNullOrWhiteSpace(kind) || AllowedKinds.Contains(kind, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Tipo de despesa invalido.");
    }
}

public sealed class ProductCategoryRequestValidator : AbstractValidator<ProductCategoryRequest>
{
    public ProductCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(250);
        RuleFor(x => x.ColorHex).NotEmpty().MaximumLength(20);
    }
}

public sealed class PrinterProfileRequestValidator : AbstractValidator<PrinterProfileRequest>
{
    public PrinterProfileRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Brand).NotEmpty().MaximumLength(120);
        RuleFor(x => x.ReturnMonths).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MachineCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.WorkHoursPerDay).GreaterThanOrEqualTo(0);
        RuleFor(x => x.WorkingDaysPerMonth).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PowerKw).GreaterThanOrEqualTo(0);
        RuleFor(x => x.FailureRate).GreaterThanOrEqualTo(0);
        RuleFor(x => x.UsageLevel).NotEmpty().MaximumLength(50);
    }
}

public sealed class BottonSizeRequestValidator : AbstractValidator<BottonSizeRequest>
{
    public BottonSizeRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.CostPerUnit).GreaterThanOrEqualTo(0);
        RuleFor(x => x.StockQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MinimumStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6);
        RuleFor(x => x.Role).IsInEnum();
        RuleFor(x => x.SupplierId)
            .NotEmpty()
            .When(x => x.Role == UserRole.Supplier)
            .WithMessage("Selecione um fornecedor para o usuario com perfil de fornecedor.");
    }
}

public sealed class UpdateUserRequestValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Password).MinimumLength(6).When(x => !string.IsNullOrWhiteSpace(x.Password));
        RuleFor(x => x.Role).IsInEnum();
        RuleFor(x => x.SupplierId)
            .NotEmpty()
            .When(x => x.Role == UserRole.Supplier)
            .WithMessage("Selecione um fornecedor para o usuario com perfil de fornecedor.");
    }
}

public sealed class UpdateCardFeeSettingsRequestValidator : AbstractValidator<UpdateCardFeeSettingsRequest>
{
    public UpdateCardFeeSettingsRequestValidator()
    {
        RuleFor(x => x.CreditCardPercentage).InclusiveBetween(0, 100);
        RuleFor(x => x.DebitCardPercentage).InclusiveBetween(0, 100);
        RuleFor(x => x.AdditionalPercentage).InclusiveBetween(0, 100);
        RuleFor(x => x.AdditionalFixedAmount).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdatePaintingSettingsRequestValidator : AbstractValidator<UpdatePaintingSettingsRequest>
{
    public UpdatePaintingSettingsRequestValidator()
    {
        RuleFor(x => x.DefaultHourlyRate).GreaterThanOrEqualTo(0).WithMessage("O valor-hora padrão não pode ser negativo.");
        RuleFor(x => x.DefaultMaterialsPercentage).GreaterThanOrEqualTo(0).WithMessage("O percentual de materiais não pode ser negativo.");
        RuleFor(x => x.MinimumMaterialsAmount).GreaterThanOrEqualTo(0).WithMessage("O valor mínimo de materiais não pode ser negativo.");
        RuleFor(x => x.MinimumPaintingPrice).GreaterThanOrEqualTo(0).WithMessage("O valor mínimo de pintura não pode ser negativo.");
        RuleFor(x => x.DefaultMarginPercentage).GreaterThanOrEqualTo(0).WithMessage("A margem adicional não pode ser negativa.");
        RuleFor(x => x.Rounding).IsInEnum();
    }
}

public sealed class PaintingLevelRequestValidator : AbstractValidator<PaintingLevelRequest>
{
    public PaintingLevelRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Informe o nome do nível.").MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.HourlyRate).GreaterThanOrEqualTo(0).When(x => x.HourlyRate.HasValue).WithMessage("O valor-hora não pode ser negativo.");
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).WithMessage("A ordem não pode ser negativa.");
    }
}

public sealed class PaintingComplexityRequestValidator : AbstractValidator<PaintingComplexityRequest>
{
    public PaintingComplexityRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Informe o nome da complexidade.").MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.Multiplier).GreaterThan(0).WithMessage("O multiplicador deve ser maior que zero.");
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).WithMessage("A ordem não pode ser negativa.");
    }
}

public sealed class PaintingSizeRangeRequestValidator : AbstractValidator<PaintingSizeRangeRequest>
{
    public PaintingSizeRangeRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Informe o nome da faixa.").MaximumLength(120);
        RuleFor(x => x.MinHeightCm).GreaterThanOrEqualTo(0).WithMessage("A altura mínima não pode ser negativa.");
        RuleFor(x => x.MaxHeightCm)
            .GreaterThan(x => x.MinHeightCm)
            .When(x => x.MaxHeightCm.HasValue)
            .WithMessage("A altura mínima não pode superar a altura máxima.");
        RuleFor(x => x.Order).GreaterThanOrEqualTo(0).WithMessage("A ordem não pode ser negativa.");
        RuleForEach(x => x.Hours).ChildRules(hours =>
        {
            hours.RuleFor(item => item.LevelId).NotEmpty();
            hours.RuleFor(item => item.Hours).GreaterThanOrEqualTo(0).WithMessage("A quantidade de horas não pode ser negativa.");
        });
    }
}

public sealed class PaintingPreparationServiceRequestValidator : AbstractValidator<PaintingPreparationServiceRequest>
{
    public PaintingPreparationServiceRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Informe o nome do serviço.").MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.ChargeType).IsInEnum();
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0).WithMessage("O valor não pode ser negativo.");
        RuleFor(x => x.EstimatedHours).GreaterThanOrEqualTo(0).WithMessage("A quantidade de horas não pode ser negativa.");
    }
}

public sealed class PaintingMaterialRequestValidator : AbstractValidator<PaintingMaterialRequest>
{
    public PaintingMaterialRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Informe o nome do material.").MaximumLength(120);
        RuleFor(x => x.Category).IsInEnum();
        RuleFor(x => x.Unit).MaximumLength(30);
        RuleFor(x => x.UnitCost).GreaterThanOrEqualTo(0).WithMessage("O valor unitário não pode ser negativo.");
        RuleFor(x => x.DefaultQuantity).GreaterThanOrEqualTo(0).WithMessage("A quantidade padrão não pode ser negativa.");
    }
}

public sealed class PaintingAddOnRequestValidator : AbstractValidator<PaintingAddOnRequest>
{
    public PaintingAddOnRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Informe o nome do adicional.").MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.ChargeType).IsInEnum();
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0).WithMessage("O valor não pode ser negativo.");
        RuleFor(x => x.Percentage).GreaterThanOrEqualTo(0).WithMessage("O percentual não pode ser negativo.");
        RuleFor(x => x.AdditionalHours).GreaterThanOrEqualTo(0).WithMessage("A quantidade de horas não pode ser negativa.");
    }
}

public sealed class ProductPaintingRequestValidator : AbstractValidator<ProductPaintingRequest>
{
    public ProductPaintingRequestValidator()
    {
        RuleFor(x => x.HeightCm).GreaterThanOrEqualTo(0).WithMessage("A altura da pintura não pode ser negativa.");
        RuleFor(x => x.CharacterCount).GreaterThanOrEqualTo(1).WithMessage("Informe ao menos 1 personagem ou elemento principal.");
        RuleFor(x => x.Mode).IsInEnum();
        RuleFor(x => x.Execution).IsInEnum();
        RuleFor(x => x.Application).IsInEnum();
        RuleFor(x => x.BaseMode).IsInEnum();
        RuleFor(x => x.HoursOverride).GreaterThanOrEqualTo(0).When(x => x.HoursOverride.HasValue).WithMessage("A quantidade de horas não pode ser negativa.");
        RuleFor(x => x.HourlyRateOverride).GreaterThanOrEqualTo(0).When(x => x.HourlyRateOverride.HasValue).WithMessage("O valor-hora não pode ser negativo.");
        RuleFor(x => x.MaterialsAmountOverride).GreaterThanOrEqualTo(0).When(x => x.MaterialsAmountOverride.HasValue).WithMessage("O valor de materiais não pode ser negativo.");
        RuleFor(x => x.PreparationAmountOverride).GreaterThanOrEqualTo(0).When(x => x.PreparationAmountOverride.HasValue).WithMessage("O valor de preparação não pode ser negativo.");
        RuleFor(x => x.AddOnsAmountOverride).GreaterThanOrEqualTo(0).When(x => x.AddOnsAmountOverride.HasValue).WithMessage("O valor de adicionais não pode ser negativo.");
        RuleFor(x => x.MarginPercentageOverride).GreaterThanOrEqualTo(0).When(x => x.MarginPercentageOverride.HasValue).WithMessage("A margem não pode ser negativa.");
        RuleFor(x => x.FinalPriceOverride).GreaterThanOrEqualTo(0).When(x => x.FinalPriceOverride.HasValue).WithMessage("O preço da pintura não pode ser negativo.");
        RuleFor(x => x.ExtraPreparationAmount).GreaterThanOrEqualTo(0).WithMessage("A preparação adicional não pode ser negativa.");
        RuleFor(x => x.FreeAddOnQuantity).GreaterThanOrEqualTo(0).WithMessage("A quantidade do adicional livre não pode ser negativa.");
        RuleFor(x => x.FreeAddOnUnitAmount).GreaterThanOrEqualTo(0).WithMessage("O valor do adicional livre não pode ser negativo.");
        RuleFor(x => x.BaseHours).GreaterThanOrEqualTo(0).WithMessage("As horas da base não podem ser negativas.");
        RuleFor(x => x.BaseManualAmount).GreaterThanOrEqualTo(0).WithMessage("O valor da base não pode ser negativo.");
        RuleFor(x => x.OutsourcedChargedAmount).GreaterThanOrEqualTo(0).WithMessage("O custo cobrado não pode ser negativo.");
        RuleFor(x => x.OutsourcedFreightAmount).GreaterThanOrEqualTo(0).WithMessage("O frete não pode ser negativo.");
        RuleFor(x => x.OutsourcedOtherCosts).GreaterThanOrEqualTo(0).WithMessage("Outros custos não podem ser negativos.");
        RuleFor(x => x.OutsourcedIncorporatedPrice).GreaterThanOrEqualTo(0).When(x => x.OutsourcedIncorporatedPrice.HasValue).WithMessage("O preço incorporado não pode ser negativo.");
        RuleFor(x => x.ManualCost).GreaterThanOrEqualTo(0).WithMessage("O custo da pintura não pode ser negativo.");
        RuleFor(x => x.ManualPrice).GreaterThanOrEqualTo(0).WithMessage("O preço da pintura não pode ser negativo.");
        RuleFor(x => x.ManualIncorporatedAmount).GreaterThanOrEqualTo(0).WithMessage("O valor incorporado não pode ser negativo.");
        RuleFor(x => x.Notes).MaximumLength(2000);
        RuleFor(x => x.ColorReferences).MaximumLength(2000);
    }
}

public sealed class PaintingPricingCalculationRequestValidator : AbstractValidator<PaintingPricingCalculationRequest>
{
    public PaintingPricingCalculationRequestValidator()
    {
        RuleFor(x => x.HeightCm).GreaterThan(0).WithMessage("Informe a altura da peça.");
        RuleFor(x => x.LevelId).NotEmpty().WithMessage("Selecione o nível de pintura.");
        RuleFor(x => x.ComplexityId).NotEmpty().WithMessage("Selecione a complexidade.");
        RuleFor(x => x.HoursOverride).GreaterThanOrEqualTo(0).When(x => x.HoursOverride.HasValue).WithMessage("A quantidade de horas não pode ser negativa.");
        RuleFor(x => x.HourlyRateOverride).GreaterThanOrEqualTo(0).When(x => x.HourlyRateOverride.HasValue).WithMessage("O valor-hora não pode ser negativo.");
        RuleFor(x => x.MaterialsPercentageOverride).GreaterThanOrEqualTo(0).When(x => x.MaterialsPercentageOverride.HasValue).WithMessage("O percentual de materiais não pode ser negativo.");
        RuleFor(x => x.MaterialsAmountOverride).GreaterThanOrEqualTo(0).When(x => x.MaterialsAmountOverride.HasValue).WithMessage("O valor de materiais não pode ser negativo.");
        RuleFor(x => x.PreparationAmountOverride).GreaterThanOrEqualTo(0).When(x => x.PreparationAmountOverride.HasValue).WithMessage("O valor de preparação não pode ser negativo.");
        RuleFor(x => x.AddOnsAmountOverride).GreaterThanOrEqualTo(0).When(x => x.AddOnsAmountOverride.HasValue).WithMessage("O valor de adicionais não pode ser negativo.");
        RuleFor(x => x.MarginPercentageOverride).GreaterThanOrEqualTo(0).When(x => x.MarginPercentageOverride.HasValue).WithMessage("A margem não pode ser negativa.");
        RuleFor(x => x.FinalPriceOverride).GreaterThanOrEqualTo(0).When(x => x.FinalPriceOverride.HasValue).WithMessage("O preço da pintura não pode ser negativo.");
        RuleForEach(x => x.Preparations).ChildRules(item =>
        {
            item.RuleFor(selection => selection.ManualAmount).GreaterThanOrEqualTo(0).When(selection => selection.ManualAmount.HasValue).WithMessage("O valor não pode ser negativo.");
            item.RuleFor(selection => selection.Hours).GreaterThanOrEqualTo(0).When(selection => selection.Hours.HasValue).WithMessage("A quantidade de horas não pode ser negativa.");
        });
        RuleForEach(x => x.AddOns).ChildRules(item =>
        {
            item.RuleFor(selection => selection.ManualAmount).GreaterThanOrEqualTo(0).When(selection => selection.ManualAmount.HasValue).WithMessage("O valor não pode ser negativo.");
        });
    }
}