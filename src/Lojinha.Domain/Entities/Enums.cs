namespace Lojinha.Api.Entities;

public enum UserRole
{
    Admin = 1,
    Supplier = 2,
    Reseller = 3
}

public enum InventoryItemType
{
    Product = 1,
    Supply = 2
}

public enum InventoryMovementType
{
    Entry = 1,
    Exit = 2,
    Sale = 3,
    Adjustment = 4
}

public enum PaymentMethod
{
    Pix = 1,
    CreditCard = 2,
    DebitCard = 3,
    Cash = 4,
    Transfer = 5
}

public enum FinancialEntryType
{
    Income = 1,
    Expense = 2
}

public enum FinancialClassification
{
    Fixed = 1,
    Variable = 2
}

public enum SaleStatus
{
    Completed = 1,
    Cancelled = 2
}

public enum ProductLifecycleStatus
{
    Disponivel = 1,
    EmProducao = 2,
    Orcamento = 3
}

public enum ProductType
{
    Impressao3D = 1,
    Brinco = 2,
    Botton = 3
}

public enum FairStatus
{
    Awaiting = 1,
    Open = 2,
    Finalized = 3,
    Cancelled = 4
}

public enum AuditAction
{
    Created = 1,
    Updated = 2,
    Deleted = 3,
    StockChanged = 4,
    PriceChanged = 5,
    Sold = 6,
    LoggedIn = 7,
    Finalized = 8,
    Reopened = 9,
    Cancelled = 10
}

public enum OperationalItemPriority
{
    Low = 1,
    Medium = 2,
    High = 3,
    Urgent = 4
}

public enum RestockTaskStatus
{
    Open = 1,
    InProgress = 2,
    Completed = 3,
    Cancelled = 4
}

public enum ProjectStatus
{
    Planejado = 1,
    EmAndamento = 2,
    Concluido = 3,
    Cancelado = 4
}

public enum ProjectStepStatus
{
    Pendente = 1,
    EmAndamento = 2,
    Concluida = 3,
    Cancelada = 4
}

public enum ProjectStepAttemptStatus
{
    EmAndamento = 1,
    Concluida = 2,
    Falhada = 3
}

public enum OutsourcedProductionStatus
{
    Pendente = 1,
    ConvertidoEmProduto = 2,
    Cancelado = 3
}
public enum PaintingPriceRounding
{
    None = 1,
    NearestInteger = 2,
    EndsWith90 = 3,
    EndsWith99 = 4,
    MultipleOf5 = 5,
    MultipleOf10 = 6
}

public enum PaintingPreparationChargeType
{
    FixedAmount = 1,
    Hourly = 2,
    Percentage = 3,
    Manual = 4
}

public enum PaintingAddOnChargeType
{
    FixedAmount = 1,
    Percentage = 2,
    AdditionalHours = 3,
    Manual = 4
}

public enum PaintingMaterialCategory
{
    Tinta = 1,
    Primer = 2,
    Verniz = 3,
    Thinner = 4,
    Limpeza = 5,
    Massa = 6,
    FitaMascaramento = 7,
    Pincel = 8,
    Aerografo = 9,
    Consumivel = 10,
    Outros = 11
}
