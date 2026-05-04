namespace Lojinha.Api.Entities;

public sealed class ProjectStepFilament : BaseEntity
{
    public Guid StepId { get; set; }
    public ProjectStep? Step { get; set; }
    public Guid FilamentProfileId { get; set; }
    public FilamentProfile? FilamentProfile { get; set; }
    public decimal WeightGrams { get; set; }
}
