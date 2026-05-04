namespace Lojinha.Api.Entities;

public sealed class ProjectStepAttemptFilament : BaseEntity
{
    public Guid AttemptId { get; set; }
    public ProjectStepAttempt? Attempt { get; set; }
    public Guid FilamentProfileId { get; set; }
    public FilamentProfile? FilamentProfile { get; set; }
    public decimal WeightGrams { get; set; }
}
