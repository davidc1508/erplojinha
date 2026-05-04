using System.Text.Json;
using System.Text.Json.Serialization;
using Lojinha.Api.Contracts.Projects;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IProjectService
{
    Task<IReadOnlyList<ProjectDto>> GetProjectsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectDto> CreateProjectAsync(ProjectRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectDto?> GetProjectByIdAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectDto?> UpdateProjectAsync(Guid id, ProjectRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<bool> DeleteProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    
    Task<ProjectStepDto> AddStepAsync(Guid projectId, ProjectStepRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectStepDto?> UpdateStepAsync(Guid projectId, Guid stepId, ProjectStepRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<bool> DeleteStepAsync(Guid projectId, Guid stepId, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    
    Task<ProjectStepAttemptDto> AddAttemptAsync(Guid projectId, Guid stepId, ProjectStepAttemptRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectStepAttemptDto?> CompleteAttemptAsync(Guid projectId, Guid stepId, Guid attemptId, ProjectStepAttemptCompleteRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectStepAttemptDto?> FailAttemptAsync(Guid projectId, Guid stepId, Guid attemptId, ProjectStepAttemptFailRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    
    Task<ProjectDto?> ConcludeProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);

        Task<ProjectStepDto?> CompleteStepAsync(Guid projectId, Guid stepId, ProjectStepAttemptCompleteRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
        Task<ProjectStepDto?> FailStepAsync(Guid projectId, Guid stepId, ProjectStepAttemptFailRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    }

public sealed class ProjectService(
    IRepository<Project> projectRepository,
    IRepository<Product> productRepository,
    IRepository<ProjectStep> stepRepository,
    IRepository<ProjectStepAttempt> attemptRepository,
    IRepository<ProjectStepFilament> stepFilamentRepository,
    IRepository<ProjectStepAttemptFilament> attemptFilamentRepository,
    IRepository<FilamentProfile> filamentRepository,
    IRepository<AuditLog> auditRepository) : IProjectService
{
public async Task<IReadOnlyList<ProjectDto>> GetProjectsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var projects = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToList();

        await HydrateProjectsAsync(projects, cancellationToken);
        return projects.Select(Map).ToList();
    }

    public async Task<ProjectDto> CreateProjectAsync(ProjectRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        await ValidateProductScopeAsync(request.ProductId, scopedSupplierId, cancellationToken);

        var project = new Project
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            ProductId = request.ProductId,
            Status = request.Status,
            OwnerSupplierId = scopedSupplierId,
            TimeEstimatedMinutes = 0,
            WeightEstimatedGrams = 0,
            TimeCompletedMinutes = 0,
            WeightCompletedGrams = 0,
            TimeLostToFailuresMinutes = 0,
            WeightLostToFailuresGrams = 0,
            ProgressPercentage = 0
        };

        await projectRepository.AddAsync(project, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(project.Id, AuditAction.Created, actor, project), cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);
        return Map(project);
    }

    public async Task<ProjectDto?> GetProjectByIdAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (project is null)
            return null;

        await HydrateProjectsAsync([project], cancellationToken);
        return Map(project);
    }

    public async Task<ProjectDto?> UpdateProjectAsync(Guid id, ProjectRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (project is null)
            return null;

        await ValidateProductScopeAsync(request.ProductId, scopedSupplierId, cancellationToken);

        project.Name = request.Name.Trim();
        project.Description = request.Description?.Trim() ?? string.Empty;
        project.ProductId = request.ProductId;
        project.Status = request.Status;

        projectRepository.Update(project);
        await auditRepository.AddAsync(CreateAudit(project.Id, AuditAction.Updated, actor, project), cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);
        return Map(project);
    }

    public async Task<bool> DeleteProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (project is null)
            return false;

        projectRepository.Remove(project);
        await auditRepository.AddAsync(CreateAudit(project.Id, AuditAction.Deleted, actor, project), cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ProjectStepDto> AddStepAsync(Guid projectId, ProjectStepRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == projectId)
            ?? throw new InvalidOperationException("Projeto não encontrado.");

        var step = new ProjectStep
        {
            ProjectId = projectId,
            Name = request.Name.Trim(),
            Order = request.Order,
            TimeEstimatedMinutes = request.TimeEstimatedMinutes,
            PrinterPlanned = request.PrinterPlanned?.Trim(),
                WeightEstimatedGrams = request.Filaments.Sum(f => f.WeightGrams),
            Status = ProjectStepStatus.Pendente
        };

        await stepRepository.AddAsync(step, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(step.Id, AuditAction.Created, actor, step), cancellationToken);
        await stepRepository.SaveChangesAsync(cancellationToken);

            foreach (var item in request.Filaments)
            {
                await stepFilamentRepository.AddAsync(new ProjectStepFilament
                {
                    StepId = step.Id,
                    FilamentProfileId = item.FilamentProfileId,
                    WeightGrams = item.WeightGrams
                }, cancellationToken);
            }
            if (request.Filaments.Count > 0)
                await stepFilamentRepository.SaveChangesAsync(cancellationToken);

        // Atualizar totais do projeto
        await RecalculateProjectTotalsAsync(projectId, cancellationToken);

        return MapStep(step);
    }

    public async Task<ProjectStepDto?> UpdateStepAsync(Guid projectId, Guid stepId, ProjectStepRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var step = stepRepository.Query()
            .FirstOrDefault(s => s.Id == stepId && s.ProjectId == projectId);

        if (step is null)
            return null;

        // Verificar se projeto pertence ao scope
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == projectId);
        if (project is null)
            return null;

        step.Name = request.Name.Trim();
        step.Order = request.Order;
        step.TimeEstimatedMinutes = request.TimeEstimatedMinutes;
        step.PrinterPlanned = request.PrinterPlanned?.Trim();
            step.WeightEstimatedGrams = request.Filaments.Sum(f => f.WeightGrams);

        stepRepository.Update(step);
        await auditRepository.AddAsync(CreateAudit(step.Id, AuditAction.Updated, actor, step), cancellationToken);
        await stepRepository.SaveChangesAsync(cancellationToken);

            var existingFilaments = stepFilamentRepository.Query().Where(x => x.StepId == step.Id).ToList();
            foreach (var item in existingFilaments)
                stepFilamentRepository.Remove(item);
            if (existingFilaments.Count > 0)
                await stepFilamentRepository.SaveChangesAsync(cancellationToken);

            foreach (var item in request.Filaments)
            {
                await stepFilamentRepository.AddAsync(new ProjectStepFilament
                {
                    StepId = step.Id,
                    FilamentProfileId = item.FilamentProfileId,
                    WeightGrams = item.WeightGrams
                }, cancellationToken);
            }
            if (request.Filaments.Count > 0)
                await stepFilamentRepository.SaveChangesAsync(cancellationToken);

        // Atualizar totais do projeto
        await RecalculateProjectTotalsAsync(projectId, cancellationToken);

        return MapStep(step);
    }

    public async Task<bool> DeleteStepAsync(Guid projectId, Guid stepId, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var step = stepRepository.Query()
            .FirstOrDefault(s => s.Id == stepId && s.ProjectId == projectId);

        if (step is null)
            return false;

        // Verificar se projeto pertence ao scope
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == projectId);
        if (project is null)
            return false;

        stepRepository.Remove(step);
        await auditRepository.AddAsync(CreateAudit(step.Id, AuditAction.Deleted, actor, step), cancellationToken);
        await stepRepository.SaveChangesAsync(cancellationToken);

        // Atualizar totais do projeto
        await RecalculateProjectTotalsAsync(projectId, cancellationToken);

        return true;
    }

    public async Task<ProjectStepAttemptDto> AddAttemptAsync(Guid projectId, Guid stepId, ProjectStepAttemptRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var step = stepRepository.Query()
            .FirstOrDefault(s => s.Id == stepId && s.ProjectId == projectId)
            ?? throw new InvalidOperationException("Etapa não encontrada.");

        // Verificar scope
        _ = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == projectId)
            ?? throw new InvalidOperationException("Projeto não encontrado.");

        var attemptNumber = attemptRepository.Query()
            .Where(a => a.StepId == stepId)
            .Count() + 1;

        var attempt = new ProjectStepAttempt
        {
            StepId = stepId,
            ProjectId = projectId,
            AttemptNumber = attemptNumber,
            PrinterUsed = request.PrinterUsed.Trim(),
            TimeRealMinutes = 0,
            WeightRealGrams = 0,
            Status = ProjectStepAttemptStatus.EmAndamento
        };

        await attemptRepository.AddAsync(attempt, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(attempt.Id, AuditAction.Created, actor, attempt), cancellationToken);
        await attemptRepository.SaveChangesAsync(cancellationToken);

            foreach (var item in request.Filaments)
            {
                await attemptFilamentRepository.AddAsync(new ProjectStepAttemptFilament
                {
                    AttemptId = attempt.Id,
                    FilamentProfileId = item.FilamentProfileId,
                    WeightGrams = item.WeightGrams
                }, cancellationToken);
            }
            if (request.Filaments.Count > 0)
                await attemptFilamentRepository.SaveChangesAsync(cancellationToken);

        // Atualizar status da mesa para "Em andamento"
        if (step.Status == ProjectStepStatus.Pendente)
        {
            step.Status = ProjectStepStatus.EmAndamento;
            stepRepository.Update(step);
            await stepRepository.SaveChangesAsync(cancellationToken);
        }

        var project = projectRepository.Query().FirstOrDefault(p => p.Id == projectId);
        if (project is not null && project.Status == ProjectStatus.Planejado)
        {
            project.Status = ProjectStatus.EmAndamento;
            project.StartedAtUtc = project.StartedAtUtc ?? DateTime.UtcNow;
            projectRepository.Update(project);
            await projectRepository.SaveChangesAsync(cancellationToken);
        }

        return MapAttempt(attempt);
    }

    public async Task<ProjectStepAttemptDto?> CompleteAttemptAsync(Guid projectId, Guid stepId, Guid attemptId, ProjectStepAttemptCompleteRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var attempt = attemptRepository.Query()
            .FirstOrDefault(a => a.Id == attemptId && a.StepId == stepId && a.ProjectId == projectId);

        if (attempt is null)
            return null;

        // Verificar scope
        _ = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == projectId)
            ?? throw new InvalidOperationException("Projeto não encontrado.");

        attempt.TimeRealMinutes = request.TimeRealMinutes;
            attempt.WeightRealGrams = attemptFilamentRepository.Query()
                .Where(f => f.AttemptId == attempt.Id)
                .Sum(f => f.WeightGrams);
        attempt.Status = ProjectStepAttemptStatus.Concluida;

        attemptRepository.Update(attempt);
        await auditRepository.AddAsync(CreateAudit(attempt.Id, AuditAction.Updated, actor, attempt), cancellationToken);

        // Marcar mesa como concluída
        var step = stepRepository.Query()
            .FirstOrDefault(s => s.Id == stepId)
            ?? throw new InvalidOperationException("Etapa não encontrada.");

        step.Status = ProjectStepStatus.Concluida;
        stepRepository.Update(step);

        await stepRepository.SaveChangesAsync(cancellationToken);
        await attemptRepository.SaveChangesAsync(cancellationToken);

        // Recalcular totais do projeto
        await RecalculateProjectTotalsAsync(projectId, cancellationToken);

        return MapAttempt(attempt);
    }

    public async Task<ProjectStepAttemptDto?> FailAttemptAsync(Guid projectId, Guid stepId, Guid attemptId, ProjectStepAttemptFailRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var attempt = attemptRepository.Query()
            .FirstOrDefault(a => a.Id == attemptId && a.StepId == stepId && a.ProjectId == projectId);

        if (attempt is null)
            return null;

        // Verificar scope
        _ = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == projectId)
            ?? throw new InvalidOperationException("Projeto não encontrado.");

        attempt.Status = ProjectStepAttemptStatus.Falhada;
        attempt.TimeLostMinutes = request.TimeLostMinutes;
        attempt.WeightLostGrams = request.WeightLostGrams;
        attempt.FailureReason = request.FailureReason?.Trim();

        attemptRepository.Update(attempt);
        await auditRepository.AddAsync(CreateAudit(attempt.Id, AuditAction.Updated, actor, attempt), cancellationToken);
        await attemptRepository.SaveChangesAsync(cancellationToken);

        // Criar nova tentativa automaticamente
        var step = stepRepository.Query()
            .FirstOrDefault(s => s.Id == stepId)
            ?? throw new InvalidOperationException("Etapa não encontrada.");

        var newAttempt = new ProjectStepAttempt
        {
            StepId = stepId,
            ProjectId = projectId,
            AttemptNumber = attempt.AttemptNumber + 1,
            PrinterUsed = attempt.PrinterUsed,
            Status = ProjectStepAttemptStatus.EmAndamento
        };

        await attemptRepository.AddAsync(newAttempt, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(newAttempt.Id, AuditAction.Created, actor, newAttempt), cancellationToken);
        await attemptRepository.SaveChangesAsync(cancellationToken);

            var prevFilaments = attemptFilamentRepository.Query().Where(f => f.AttemptId == attemptId).ToList();
            foreach (var f in prevFilaments)
            {
                await attemptFilamentRepository.AddAsync(new ProjectStepAttemptFilament
                {
                    AttemptId = newAttempt.Id,
                    FilamentProfileId = f.FilamentProfileId,
                    WeightGrams = f.WeightGrams
                }, cancellationToken);
            }
            if (prevFilaments.Count > 0)
                await attemptFilamentRepository.SaveChangesAsync(cancellationToken);

        // Recalcular totais do projeto
        await RecalculateProjectTotalsAsync(projectId, cancellationToken);

        return MapAttempt(attempt);
    }

    public async Task<ProjectDto?> ConcludeProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (project is null)
            return null;

        // Verificar se todas as mesas estão concluídas
        var steps = stepRepository.Query()
            .Where(s => s.ProjectId == id)
            .ToList();

        var allCompleted = steps.All(s => s.Status == ProjectStepStatus.Concluida);
        if (!allCompleted)
            throw new InvalidOperationException("Todas as etapas precisam estar concluídas para finalizar o projeto.");

        project.Status = ProjectStatus.Concluido;
        project.ConcludedAtUtc = DateTime.UtcNow;

        projectRepository.Update(project);
        await auditRepository.AddAsync(CreateAudit(project.Id, AuditAction.Updated, actor, project), cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);

        return Map(project);
    }

    public async Task<ProjectStepDto?> CompleteStepAsync(Guid projectId, Guid stepId, ProjectStepAttemptCompleteRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var step = stepRepository.Query()
            .FirstOrDefault(s => s.Id == stepId && s.ProjectId == projectId);
        if (step is null)
            return null;

        _ = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == projectId)
            ?? throw new InvalidOperationException("Projeto não encontrado.");

        // Reutilizar tentativa ativa ou criar uma nova com os dados da mesa
        var attempt = attemptRepository.Query()
            .FirstOrDefault(a => a.StepId == stepId && a.Status == ProjectStepAttemptStatus.EmAndamento);

        if (attempt is null)
        {
            var attemptNumber = attemptRepository.Query().Where(a => a.StepId == stepId).Count() + 1;
            attempt = new ProjectStepAttempt
            {
                StepId = stepId,
                ProjectId = projectId,
                AttemptNumber = attemptNumber,
                PrinterUsed = step.PrinterPlanned ?? string.Empty,
                Status = ProjectStepAttemptStatus.EmAndamento
            };
            await attemptRepository.AddAsync(attempt, cancellationToken);
            await auditRepository.AddAsync(CreateAudit(attempt.Id, AuditAction.Created, actor, attempt), cancellationToken);
            await attemptRepository.SaveChangesAsync(cancellationToken);

            var stepFilaments = stepFilamentRepository.Query().Where(f => f.StepId == stepId).ToList();
            foreach (var sf in stepFilaments)
            {
                await attemptFilamentRepository.AddAsync(new ProjectStepAttemptFilament
                {
                    AttemptId = attempt.Id,
                    FilamentProfileId = sf.FilamentProfileId,
                    WeightGrams = sf.WeightGrams
                }, cancellationToken);
            }
            if (stepFilaments.Count > 0)
                await attemptFilamentRepository.SaveChangesAsync(cancellationToken);
        }

        attempt.TimeRealMinutes = request.TimeRealMinutes;
        attempt.WeightRealGrams = attemptFilamentRepository.Query()
            .Where(f => f.AttemptId == attempt.Id)
            .Sum(f => f.WeightGrams);
        attempt.Status = ProjectStepAttemptStatus.Concluida;
        attemptRepository.Update(attempt);
        await auditRepository.AddAsync(CreateAudit(attempt.Id, AuditAction.Updated, actor, attempt), cancellationToken);

        step.Status = ProjectStepStatus.Concluida;
        stepRepository.Update(step);
        await stepRepository.SaveChangesAsync(cancellationToken);
        await attemptRepository.SaveChangesAsync(cancellationToken);

        await RecalculateProjectTotalsAsync(projectId, cancellationToken);
        return MapStep(step);
    }

    public async Task<ProjectStepDto?> FailStepAsync(Guid projectId, Guid stepId, ProjectStepAttemptFailRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var step = stepRepository.Query()
            .FirstOrDefault(s => s.Id == stepId && s.ProjectId == projectId);
        if (step is null)
            return null;

        _ = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == projectId)
            ?? throw new InvalidOperationException("Projeto não encontrado.");

        // Reutilizar tentativa ativa ou criar uma nova com os dados da mesa
        var attempt = attemptRepository.Query()
            .FirstOrDefault(a => a.StepId == stepId && a.Status == ProjectStepAttemptStatus.EmAndamento);

        if (attempt is null)
        {
            var attemptNumber = attemptRepository.Query().Where(a => a.StepId == stepId).Count() + 1;
            attempt = new ProjectStepAttempt
            {
                StepId = stepId,
                ProjectId = projectId,
                AttemptNumber = attemptNumber,
                PrinterUsed = step.PrinterPlanned ?? string.Empty,
                Status = ProjectStepAttemptStatus.EmAndamento
            };
            await attemptRepository.AddAsync(attempt, cancellationToken);
            await auditRepository.AddAsync(CreateAudit(attempt.Id, AuditAction.Created, actor, attempt), cancellationToken);
            await attemptRepository.SaveChangesAsync(cancellationToken);

            var stepFilaments = stepFilamentRepository.Query().Where(f => f.StepId == stepId).ToList();
            foreach (var sf in stepFilaments)
            {
                await attemptFilamentRepository.AddAsync(new ProjectStepAttemptFilament
                {
                    AttemptId = attempt.Id,
                    FilamentProfileId = sf.FilamentProfileId,
                    WeightGrams = sf.WeightGrams
                }, cancellationToken);
            }
            if (stepFilaments.Count > 0)
                await attemptFilamentRepository.SaveChangesAsync(cancellationToken);
        }

        attempt.Status = ProjectStepAttemptStatus.Falhada;
        attempt.TimeLostMinutes = request.TimeLostMinutes;
        attempt.WeightLostGrams = request.WeightLostGrams;
        attempt.FailureReason = request.FailureReason?.Trim();
        attemptRepository.Update(attempt);
        await auditRepository.AddAsync(CreateAudit(attempt.Id, AuditAction.Updated, actor, attempt), cancellationToken);
        await attemptRepository.SaveChangesAsync(cancellationToken);

        // Criar nova tentativa automaticamente com os mesmos dados
        var newAttemptNumber = attemptRepository.Query().Where(a => a.StepId == stepId).Count() + 1;
        var newAttempt = new ProjectStepAttempt
        {
            StepId = stepId,
            ProjectId = projectId,
            AttemptNumber = newAttemptNumber,
            PrinterUsed = attempt.PrinterUsed,
            Status = ProjectStepAttemptStatus.EmAndamento
        };
        await attemptRepository.AddAsync(newAttempt, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(newAttempt.Id, AuditAction.Created, actor, newAttempt), cancellationToken);
        await attemptRepository.SaveChangesAsync(cancellationToken);

        var prevFilaments = attemptFilamentRepository.Query().Where(f => f.AttemptId == attempt.Id).ToList();
        foreach (var f in prevFilaments)
        {
            await attemptFilamentRepository.AddAsync(new ProjectStepAttemptFilament
            {
                AttemptId = newAttempt.Id,
                FilamentProfileId = f.FilamentProfileId,
                WeightGrams = f.WeightGrams
            }, cancellationToken);
        }
        if (prevFilaments.Count > 0)
            await attemptFilamentRepository.SaveChangesAsync(cancellationToken);

        if (step.Status == ProjectStepStatus.Pendente)
        {
            step.Status = ProjectStepStatus.EmAndamento;
            stepRepository.Update(step);
            await stepRepository.SaveChangesAsync(cancellationToken);
        }

        var project = projectRepository.Query().FirstOrDefault(p => p.Id == projectId);
        if (project is not null && project.Status == ProjectStatus.Planejado)
        {
            project.Status = ProjectStatus.EmAndamento;
            project.StartedAtUtc = project.StartedAtUtc ?? DateTime.UtcNow;
            projectRepository.Update(project);
            await projectRepository.SaveChangesAsync(cancellationToken);
        }

        await RecalculateProjectTotalsAsync(projectId, cancellationToken);
        return MapStep(step);
    }

    private async Task RecalculateProjectTotalsAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var project = projectRepository.Query()
            .FirstOrDefault(p => p.Id == projectId);

        if (project is null)
            return;

        var steps = stepRepository.Query()
            .Where(s => s.ProjectId == projectId)
            .ToList();

        // Totais estimados
        project.TimeEstimatedMinutes = steps.Sum(s => s.TimeEstimatedMinutes);
        project.WeightEstimatedGrams = steps.Sum(s => s.WeightEstimatedGrams);

        // Mesas concluídas (tempo e peso)
        var completedSteps = steps.Where(s => s.Status == ProjectStepStatus.Concluida).ToList();
        project.TimeCompletedMinutes = completedSteps.Sum(s => s.TimeEstimatedMinutes);
        project.WeightCompletedGrams = completedSteps.Sum(s => s.WeightEstimatedGrams);

        // Perdas em falhas
        var attempts = attemptRepository.Query()
            .Where(a => a.ProjectId == projectId && a.Status == ProjectStepAttemptStatus.Falhada)
            .ToList();

        project.TimeLostToFailuresMinutes = attempts.Sum(a => a.TimeLostMinutes);
        project.WeightLostToFailuresGrams = attempts.Sum(a => a.WeightLostGrams);

        // Percentual de progresso (por tempo)
        if (project.TimeEstimatedMinutes > 0)
        {
            project.ProgressPercentage = (project.TimeCompletedMinutes / project.TimeEstimatedMinutes) * 100;
        }
        else
        {
            project.ProgressPercentage = 0;
        }

        projectRepository.Update(project);
        await projectRepository.SaveChangesAsync();
    }

    private async Task HydrateProjectsAsync(IReadOnlyList<Project> projects, CancellationToken cancellationToken)
    {
        if (projects.Count == 0)
            return;

        var projectIds = projects.Select(p => p.Id).ToList();

        var steps = stepRepository.Query()
            .Where(s => projectIds.Contains(s.ProjectId))
            .ToList();

        var stepIds = steps.Select(s => s.Id).ToList();

        var attempts = attemptRepository.Query()
            .Where(a => stepIds.Contains(a.StepId))
            .ToList();

        var attemptIds = attempts.Select(a => a.Id).ToList();

        var stepFilaments = stepFilamentRepository.Query()
            .Where(f => stepIds.Contains(f.StepId))
            .ToList();

        var attemptFilaments = attemptFilamentRepository.Query()
            .Where(f => attemptIds.Contains(f.AttemptId))
            .ToList();

        var filamentIds = stepFilaments.Select(f => f.FilamentProfileId)
            .Concat(attemptFilaments.Select(f => f.FilamentProfileId))
            .Distinct()
            .ToList();

        var filamentProfiles = filamentRepository.Query()
            .Where(f => filamentIds.Contains(f.Id))
            .ToDictionary(f => f.Id, f => f);

        foreach (var sf in stepFilaments)
        {
            if (filamentProfiles.TryGetValue(sf.FilamentProfileId, out var profile))
                sf.FilamentProfile = profile;
        }

        foreach (var af in attemptFilaments)
        {
            if (filamentProfiles.TryGetValue(af.FilamentProfileId, out var profile))
                af.FilamentProfile = profile;
        }

        foreach (var step in steps)
        {
            step.Attempts = attempts.Where(a => a.StepId == step.Id).ToList();
            step.FilamentsPlanned = stepFilaments.Where(f => f.StepId == step.Id).ToList();
        }

        foreach (var attempt in attempts)
        {
            attempt.FilamentsUsed = attemptFilaments.Where(f => f.AttemptId == attempt.Id).ToList();
        }

        foreach (var project in projects)
        {
            project.Steps = steps.Where(s => s.ProjectId == project.Id).ToList();
        }
    }

    private async Task ValidateProductScopeAsync(Guid? productId, Guid? scopedSupplierId, CancellationToken cancellationToken)
    {
        if (!productId.HasValue)
        {
            return;
        }

        var product = await productRepository.GetByIdAsync(productId.Value, cancellationToken)
            ?? throw new InvalidOperationException("Produto vinculado nao encontrado.");

        if (scopedSupplierId.HasValue && product.SupplierId != scopedSupplierId)
        {
            throw new InvalidOperationException("Produto vinculado nao pertence ao seu perfil.");
        }
    }

    private static IQueryable<Project> ApplyScope(IQueryable<Project> query, Guid? scopedSupplierId)
        => scopedSupplierId.HasValue
            ? query.Where(p => p.OwnerSupplierId == scopedSupplierId)
            : query.Where(p => p.OwnerSupplierId == null);

    private static ProjectDto Map(Project p)
    {
        var steps = p.Steps.ToList();
        return new ProjectDto(
            p.Id,
            p.Name,
            p.Description,
            p.Status,
            p.OwnerSupplierId,
            p.ProductId,
            p.StartedAtUtc,
            p.ConcludedAtUtc,
            p.TimeEstimatedMinutes,
            p.WeightEstimatedGrams,
            p.TimeCompletedMinutes,
            p.WeightCompletedGrams,
            p.TimeLostToFailuresMinutes,
            p.WeightLostToFailuresGrams,
            p.ProgressPercentage,
            steps.Select(MapStep).ToList(),
            p.CreatedAtUtc,
            p.UpdatedAtUtc);
    }

    private static ProjectStepDto MapStep(ProjectStep s)
    {
        var attempts = s.Attempts.ToList();
        return new ProjectStepDto(
            s.Id,
            s.ProjectId,
            s.Name,
            s.Order,
            s.TimeEstimatedMinutes,
            s.WeightEstimatedGrams,
            s.PrinterPlanned,
                s.FilamentsPlanned
                    .Select(f => new ProjectStepFilamentDto(f.FilamentProfileId, f.FilamentProfile?.Name ?? string.Empty, f.WeightGrams))
                    .ToList(),
            s.Status,
            attempts.Select(MapAttempt).ToList(),
            s.CreatedAtUtc,
            s.UpdatedAtUtc);
    }

    private static ProjectStepAttemptDto MapAttempt(ProjectStepAttempt a)
        => new(
            a.Id,
            a.StepId,
            a.ProjectId,
            a.AttemptNumber,
            a.PrinterUsed,
                a.FilamentsUsed
                    .Select(f => new ProjectStepFilamentDto(f.FilamentProfileId, f.FilamentProfile?.Name ?? string.Empty, f.WeightGrams))
                    .ToList(),
            a.TimeRealMinutes,
            a.WeightRealGrams,
            a.Status,
            a.TimeLostMinutes,
            a.WeightLostGrams,
            a.FailureReason,
            a.CreatedAtUtc,
            a.UpdatedAtUtc);

    private static readonly JsonSerializerOptions _auditJsonOptions = new() { ReferenceHandler = ReferenceHandler.IgnoreCycles };

    private static AuditLog CreateAudit(Guid entityId, AuditAction action, string actor, object payload)
        => new()
        {
            EntityName = "Project",
            EntityId = entityId.ToString(),
            Action = action,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(payload, _auditJsonOptions)
        };
}
