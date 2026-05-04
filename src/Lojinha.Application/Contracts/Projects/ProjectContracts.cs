using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Projects;

public sealed record ProjectStepFilamentRequest(Guid FilamentProfileId, decimal WeightGrams);

public sealed record ProjectStepFilamentDto(Guid FilamentProfileId, string FilamentName, decimal WeightGrams);

public sealed record ProjectRequest(
    string Name,
    string? Description,
    Guid? ProductId,
    ProjectStatus Status);

public sealed record ProjectStepRequest(
    string Name,
    int Order,
    decimal TimeEstimatedMinutes,
    string? PrinterPlanned,
     IReadOnlyList<ProjectStepFilamentRequest> Filaments);

public sealed record ProjectStepAttemptRequest(
    string PrinterUsed,
     IReadOnlyList<ProjectStepFilamentRequest> Filaments);

public sealed record ProjectStepAttemptCompleteRequest(
     decimal TimeRealMinutes);

public sealed record ProjectStepAttemptFailRequest(
    decimal TimeLostMinutes,
    decimal WeightLostGrams,
    string? FailureReason);

public sealed record ProjectStepDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    int Order,
    decimal TimeEstimatedMinutes,
    decimal WeightEstimatedGrams,
    string? PrinterPlanned,
     IReadOnlyList<ProjectStepFilamentDto> Filaments,
    ProjectStepStatus Status,
    IReadOnlyList<ProjectStepAttemptDto> Attempts,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record ProjectStepAttemptDto(
    Guid Id,
    Guid StepId,
    Guid ProjectId,
    int AttemptNumber,
    string PrinterUsed,
     IReadOnlyList<ProjectStepFilamentDto> Filaments,
    decimal TimeRealMinutes,
    decimal WeightRealGrams,
    ProjectStepAttemptStatus Status,
    decimal TimeLostMinutes,
    decimal WeightLostGrams,
    string? FailureReason,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record ProjectDto(
    Guid Id,
    string Name,
    string Description,
    ProjectStatus Status,
    Guid? OwnerSupplierId,
    Guid? ProductId,
    DateTime? StartedAtUtc,
    DateTime? ConcludedAtUtc,
    decimal TimeEstimatedMinutes,
    decimal WeightEstimatedGrams,
    decimal TimeCompletedMinutes,
    decimal WeightCompletedGrams,
    decimal TimeLostToFailuresMinutes,
    decimal WeightLostToFailuresGrams,
    decimal ProgressPercentage,
    IReadOnlyList<ProjectStepDto> Steps,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);
