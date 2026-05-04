namespace Lojinha.Api.Entities;

public sealed class Project : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public ProjectStatus Status { get; set; } = ProjectStatus.Planejado;
    public Guid? OwnerSupplierId { get; set; }
    public Supplier? OwnerSupplier { get; set; }
    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? ConcludedAtUtc { get; set; }
    
    // Sumários estimados
    public decimal TimeEstimatedMinutes { get; set; }
    public decimal WeightEstimatedGrams { get; set; }
    
    // Sumários realizados
    public decimal TimeCompletedMinutes { get; set; }
    public decimal WeightCompletedGrams { get; set; }
    
    // Perdas
    public decimal TimeLostToFailuresMinutes { get; set; }
    public decimal WeightLostToFailuresGrams { get; set; }
    
    // Percentual aproximado (calculado)
    public decimal ProgressPercentage { get; set; }
    
    // Relacionamentos
    public ICollection<ProjectStep> Steps { get; set; } = [];
}

public sealed class ProjectStep : BaseEntity
{
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public int Order { get; set; }
    
    // Planejado
    public decimal TimeEstimatedMinutes { get; set; }
    public decimal WeightEstimatedGrams { get; set; }
    public string? PrinterPlanned { get; set; }
    public ICollection<ProjectStepFilament> FilamentsPlanned { get; set; } = [];
    
    // Status atual da mesa
    public ProjectStepStatus Status { get; set; } = ProjectStepStatus.Pendente;
    
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    
    // Relacionamentos
    public ICollection<ProjectStepAttempt> Attempts { get; set; } = [];
}

public sealed class ProjectStepAttempt : BaseEntity
{
    public Guid StepId { get; set; }
    public ProjectStep? Step { get; set; }
    
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }
    
    public int AttemptNumber { get; set; }
    
    // Executado
    public string PrinterUsed { get; set; } = string.Empty;
    public ICollection<ProjectStepAttemptFilament> FilamentsUsed { get; set; } = [];
    public decimal TimeRealMinutes { get; set; }
    public decimal WeightRealGrams { get; set; }
    
    // Status
    public ProjectStepAttemptStatus Status { get; set; } = ProjectStepAttemptStatus.EmAndamento;
    
    // Em caso de falha
    public decimal TimeLostMinutes { get; set; }
    public decimal WeightLostGrams { get; set; }
    public string? FailureReason { get; set; }
    
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
