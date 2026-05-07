namespace Lojinha.Api.Entities;

public enum UserRole
{
    Admin = 1,
    Supplier = 2
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