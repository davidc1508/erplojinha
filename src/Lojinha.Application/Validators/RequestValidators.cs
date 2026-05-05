using FluentValidation;
using Lojinha.Api.Contracts.Catalog;
using Lojinha.Api.Contracts.Auth;
using Lojinha.Api.Contracts.CardFees;
using Lojinha.Api.Contracts.Finance;
using Lojinha.Api.Contracts.Fairs;
using Lojinha.Api.Contracts.Inventory;
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
        RuleFor(x => x.MinimumStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CurrentStock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ItemsPerPlate).GreaterThan(0);
        RuleFor(x => x.HeightCentimeters).GreaterThanOrEqualTo(0);
        RuleFor(x => x.TariffPerKwh).GreaterThanOrEqualTo(0);
        RuleFor(x => x.FinishingPercentage).InclusiveBetween(0, 1000);
        RuleFor(x => x.CommissionPercentage).InclusiveBetween(0, 1000);
        RuleFor(x => x.AdditionalCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DesiredMarkup).GreaterThanOrEqualTo(2);
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

public sealed class FairRequestValidator : AbstractValidator<FairRequest>
{
    public FairRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Location).NotEmpty().MaximumLength(180);
        RuleFor(x => x.RegistrationFee).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RegistrationFeeSplitCount).GreaterThan(0);
        RuleFor(x => x.RegistrationPaymentStartDateUtc).NotEmpty();
        RuleFor(x => x.RegistrationInstallments).NotEmpty();
        RuleForEach(x => x.RegistrationInstallments).ChildRules(item =>
        {
            item.RuleFor(x => x.DueDateUtc).NotEmpty();
            item.RuleFor(x => x.Amount).GreaterThan(0);
        });
        RuleFor(x => x)
            .Must(x => decimal.Round(x.RegistrationInstallments.Sum(item => item.Amount), 2, MidpointRounding.AwayFromZero)
                == decimal.Round(x.RegistrationFee, 2, MidpointRounding.AwayFromZero))
            .WithMessage("A soma das parcelas de inscricao deve ser igual ao valor total da inscricao.");
        RuleForEach(x => x.SupplierIds).NotEmpty().When(x => x.SupplierIds is not null);
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