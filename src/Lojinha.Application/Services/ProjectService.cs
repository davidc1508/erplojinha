using System.Text.Json;
using System.Text.Json.Serialization;
using Lojinha.Api.Contracts.Projects;
using Lojinha.Api.Contracts.Products;
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
    
    Task<ProjectProductDraftDto?> GetProductDraftAsync(Guid id, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectDto?> ConcludeProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectDto?> ConcludeProjectWithProductAsync(Guid id, ProductRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectDto?> DuplicateProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectDto?> StartProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<ProjectDto?> ReopenProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);

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
    IRepository<PrinterProfile> printerProfileRepository,
    IRepository<AuditLog> auditRepository,
    IProductService productService) : IProjectService
{
public async Task<IReadOnlyList<ProjectDto>> GetProjectsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var projects = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .Where(p => !p.IsPersonalized)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToList();

        // Listagem de projetos nao precisa hidratar etapas/tentativas completas.
        // Isso reduz bastante o payload e o tempo de resposta em bases grandes.
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

        await EnsureProjectStartedAsync(projectId, actor, cancellationToken);

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

        await EnsureProjectStartedAsync(projectId, actor, cancellationToken);

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

    public async Task<ProjectProductDraftDto?> GetProductDraftAsync(Guid id, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (project is null)
            return null;

        await HydrateProjectsAsync([project], cancellationToken);

        var concludedSteps = project.Steps
            .Where(step => step.Status == ProjectStepStatus.Concluida)
            .OrderBy(step => step.Order)
            .ToList();

        if (concludedSteps.Count == 0)
        {
            throw new InvalidOperationException("O projeto precisa ter ao menos uma mesa concluida para gerar o produto.");
        }

        var completedAttempts = concludedSteps
            .SelectMany(step => step.Attempts)
            .Where(attempt => attempt.Status == ProjectStepAttemptStatus.Concluida)
            .ToList();

        var failedAttempts = concludedSteps
            .SelectMany(step => step.Attempts)
            .Where(attempt => attempt.Status == ProjectStepAttemptStatus.Falhada)
            .ToList();

        var printerUsages = completedAttempts
            .GroupBy(attempt => attempt.PrinterUsed.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(group =>
            {
                var printerProfile = printerProfileRepository.Query()
                    .FirstOrDefault(printer => printer.Name == group.First().PrinterUsed);
                return new ProjectProductDraftPrinterUsageDto(
                    group.First().PrinterUsed,
                    printerProfile?.Id,
                    group.Sum(attempt => attempt.TimeRealMinutes));
            })
            .OrderByDescending(item => item.TimeRealMinutes)
            .ToList();

        var materialUsages = completedAttempts
            .SelectMany(attempt => attempt.FilamentsUsed)
            .GroupBy(filament => filament.FilamentProfileId)
            .Select(group =>
            {
                var totalWeight = group.Sum(item => item.WeightGrams);
                var filamentName = group.First().FilamentProfile?.Name ?? string.Empty;
                return new
                {
                    group.Key,
                    FilamentName = filamentName,
                    WeightGrams = totalWeight
                };
            })
            .OrderByDescending(item => item.WeightGrams)
            .ToList();

        var totalMaterialWeight = materialUsages.Sum(item => item.WeightGrams);
        var materialDraft = materialUsages
            .Select(item => new ProjectProductDraftMaterialUsageDto(
                item.Key,
                item.FilamentName,
                item.WeightGrams,
                totalMaterialWeight <= 0 ? 0 : decimal.Round((item.WeightGrams / totalMaterialWeight) * 100m, 2)))
            .ToList();

        var existingProduct = project.ProductId.HasValue
            ? await productService.GetByIdAsync(project.ProductId.Value, scopedSupplierId, cancellationToken)
            : null;

        var dominantPrinterProfileId = printerUsages.FirstOrDefault(item => item.PrinterProfileId.HasValue)?.PrinterProfileId;
        var estimatedPrintTime = concludedSteps.Sum(step => step.TimeEstimatedMinutes);
        var failureAdditionalCost = decimal.Round(ComputeFailureAdditionalCost(failedAttempts), 2);

        return new ProjectProductDraftDto(
            project.Id,
            project.ProductId,
            project.Name,
            existingProduct?.Name ?? project.Name,
            existingProduct?.Sku ?? string.Empty,
            existingProduct?.Description ?? project.Description,
            existingProduct?.CategoryId,
            existingProduct?.SupplierId ?? project.OwnerSupplierId,
            existingProduct?.GenerateProductionExpenseOnStockEntry ?? false,
            existingProduct?.CurrentStock ?? 0,
            existingProduct?.MinimumStock ?? 2,
            existingProduct?.ItemsPerPlate ?? 1,
            estimatedPrintTime,
            existingProduct?.HeightCentimeters ?? 0,
            existingProduct?.LengthMetersUsed ?? 0,
            existingProduct?.TariffPerKwh ?? DefaultTariffPerKwh,
            existingProduct?.FinishingPercentage ?? 2,
            existingProduct?.CommissionPercentage ?? 0,
            existingProduct?.PrinterProfileId ?? dominantPrinterProfileId,
            materialDraft.Select(item => new ProjectStepFilamentDto(item.FilamentProfileId, item.FilamentName, item.WeightGrams)).ToList(),
            existingProduct?.MarketplaceFeeId,
            existingProduct?.AdditionalCost ?? 0,
            failureAdditionalCost,
            existingProduct?.DesiredMarkup ?? 2.7m,
            existingProduct?.SalePrice,
            printerUsages,
            materialDraft);
    }

    public async Task<ProjectDto?> ConcludeProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (project is null)
            return null;

        var steps = stepRepository.Query()
            .Where(s => s.ProjectId == id)
            .ToList();

        EnsureProjectCanBeConcluded(steps, requireLinkedProduct: true, project.ProductId.HasValue);

        project.Status = ProjectStatus.Concluido;
        project.ConcludedAtUtc = DateTime.UtcNow;

        projectRepository.Update(project);
        await auditRepository.AddAsync(CreateAudit(project.Id, AuditAction.Updated, actor, project), cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);

        return Map(project);
    }

    public async Task<ProjectDto?> ConcludeProjectWithProductAsync(Guid id, ProductRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (project is null)
            return null;

        await HydrateProjectsAsync([project], cancellationToken);
        EnsureProjectCanBeConcluded(project.Steps.ToList(), requireLinkedProduct: false, hasLinkedProduct: project.ProductId.HasValue);

        ProductDto product;
        if (project.ProductId.HasValue)
        {
            product = await productService.UpdateAsync(project.ProductId.Value, request, actor, scopedSupplierId, cancellationToken)
                ?? throw new InvalidOperationException("Nao foi possivel atualizar o produto vinculado ao projeto.");
        }
        else
        {
            product = await productService.CreateAsync(request, actor, scopedSupplierId, cancellationToken);
        }

        project.ProductId = product.Id;
        project.Status = ProjectStatus.Concluido;
        project.ConcludedAtUtc = DateTime.UtcNow;
        projectRepository.Update(project);
        await auditRepository.AddAsync(CreateAudit(project.Id, AuditAction.Updated, actor, project), cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);

        await HydrateProjectsAsync([project], cancellationToken);
        return Map(project);
    }

    public async Task<ProjectDto?> DuplicateProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var sourceProject = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (sourceProject is null)
            return null;

        if (sourceProject.Status != ProjectStatus.Concluido)
        {
            throw new InvalidOperationException("A duplicacao e permitida apenas para projetos concluidos.");
        }

        await HydrateProjectsAsync([sourceProject], cancellationToken);

        var duplicatedProject = new Project
        {
            Name = $"{sourceProject.Name} (nova execucao)",
            Description = sourceProject.Description,
            Status = ProjectStatus.Planejado,
            OwnerSupplierId = sourceProject.OwnerSupplierId,
            ProductId = sourceProject.ProductId,
            TimeEstimatedMinutes = 0,
            WeightEstimatedGrams = 0,
            TimeCompletedMinutes = 0,
            WeightCompletedGrams = 0,
            TimeLostToFailuresMinutes = 0,
            WeightLostToFailuresGrams = 0,
            ProgressPercentage = 0
        };

        await projectRepository.AddAsync(duplicatedProject, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(duplicatedProject.Id, AuditAction.Created, actor, duplicatedProject), cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);

        foreach (var step in sourceProject.Steps.OrderBy(item => item.Order))
        {
            var duplicatedStep = new ProjectStep
            {
                ProjectId = duplicatedProject.Id,
                Name = step.Name,
                Order = step.Order,
                TimeEstimatedMinutes = step.TimeEstimatedMinutes,
                WeightEstimatedGrams = step.WeightEstimatedGrams,
                PrinterPlanned = step.PrinterPlanned,
                Status = ProjectStepStatus.Pendente
            };

            await stepRepository.AddAsync(duplicatedStep, cancellationToken);
            await auditRepository.AddAsync(CreateAudit(duplicatedStep.Id, AuditAction.Created, actor, duplicatedStep), cancellationToken);
            await stepRepository.SaveChangesAsync(cancellationToken);

            foreach (var filament in step.FilamentsPlanned)
            {
                await stepFilamentRepository.AddAsync(new ProjectStepFilament
                {
                    StepId = duplicatedStep.Id,
                    FilamentProfileId = filament.FilamentProfileId,
                    WeightGrams = filament.WeightGrams
                }, cancellationToken);
            }

            if (step.FilamentsPlanned.Count > 0)
            {
                await stepFilamentRepository.SaveChangesAsync(cancellationToken);
            }
        }

        await RecalculateProjectTotalsAsync(duplicatedProject.Id, cancellationToken);
        await HydrateProjectsAsync([duplicatedProject], cancellationToken);
        return Map(duplicatedProject);
    }

    public async Task<ProjectDto?> ReopenProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (project is null)
            return null;

        if (project.Status != ProjectStatus.Concluido)
        {
            throw new InvalidOperationException("A reabertura e permitida apenas para projetos concluidos.");
        }

        project.Status = ProjectStatus.EmAndamento;
        project.ConcludedAtUtc = null;

        projectRepository.Update(project);
        await auditRepository.AddAsync(CreateAudit(project.Id, AuditAction.Updated, actor, project), cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);

        return Map(project);
    }

    public async Task<ProjectDto?> StartProjectAsync(Guid id, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = ApplyScope(projectRepository.Query(), scopedSupplierId)
            .FirstOrDefault(p => p.Id == id);

        if (project is null)
            return null;

        if (project.Status == ProjectStatus.Cancelado)
        {
            throw new InvalidOperationException("Nao e possivel iniciar um projeto cancelado.");
        }

        if (project.Status == ProjectStatus.Concluido)
        {
            throw new InvalidOperationException("Nao e possivel iniciar um projeto concluido. Reabra o projeto antes.");
        }

        if (project.Status == ProjectStatus.Planejado)
        {
            project.Status = ProjectStatus.EmAndamento;
            project.StartedAtUtc = project.StartedAtUtc ?? DateTime.UtcNow;
            projectRepository.Update(project);
            await auditRepository.AddAsync(CreateAudit(project.Id, AuditAction.Updated, actor, project), cancellationToken);
            await projectRepository.SaveChangesAsync(cancellationToken);
        }

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

        await EnsureProjectStartedAsync(projectId, actor, cancellationToken);

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

        await EnsureProjectStartedAsync(projectId, actor, cancellationToken);

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

        // Garantia adicional: ao ter qualquer atividade/conclusao de mesa, o projeto
        // deve sair de Planejado para EmAndamento mesmo que um fluxo anterior falhe.
        if (project.Status == ProjectStatus.Planejado)
        {
            var hasWorkStarted = completedSteps.Count > 0
                || steps.Any(s => s.Status == ProjectStepStatus.EmAndamento)
                || attempts.Any(a => a.Status == ProjectStepAttemptStatus.EmAndamento || a.Status == ProjectStepAttemptStatus.Concluida || a.Status == ProjectStepAttemptStatus.Falhada);

            if (hasWorkStarted)
            {
                project.Status = ProjectStatus.EmAndamento;
                project.StartedAtUtc ??= DateTime.UtcNow;
            }
        }

        projectRepository.Update(project);
        await projectRepository.SaveChangesAsync();
    }

    private async Task EnsureProjectStartedAsync(Guid projectId, string actor, CancellationToken cancellationToken)
    {
        var project = projectRepository.Query().FirstOrDefault(p => p.Id == projectId);
        if (project is null || project.Status != ProjectStatus.Planejado)
        {
            return;
        }

        project.Status = ProjectStatus.EmAndamento;
        project.StartedAtUtc = project.StartedAtUtc ?? DateTime.UtcNow;
        projectRepository.Update(project);
        await auditRepository.AddAsync(CreateAudit(project.Id, AuditAction.Updated, actor, project), cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);
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

        var printerNames = steps
            .Where(s => !string.IsNullOrEmpty(s.PrinterPlanned))
            .Select(s => s.PrinterPlanned!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var printersByName = printerProfileRepository.Query()
            .Where(p => printerNames.Contains(p.Name))
            .ToDictionary(p => p.Name, p => p, StringComparer.OrdinalIgnoreCase);

        foreach (var step in steps)
            step.PrinterProfile = printersByName.GetValueOrDefault(step.PrinterPlanned ?? string.Empty);

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

    private static void EnsureProjectCanBeConcluded(IReadOnlyList<ProjectStep> steps, bool requireLinkedProduct, bool hasLinkedProduct)
    {
        if (steps.Count == 0)
        {
            throw new InvalidOperationException("Adicione ao menos uma mesa antes de finalizar o projeto.");
        }

        var hasPendingSteps = steps.Any(step => step.Status is not (ProjectStepStatus.Concluida or ProjectStepStatus.Cancelada));
        if (hasPendingSteps)
        {
            throw new InvalidOperationException("Todas as etapas precisam estar concluidas ou canceladas para finalizar o projeto.");
        }

        if (!steps.Any(step => step.Status == ProjectStepStatus.Concluida))
        {
            throw new InvalidOperationException("O projeto precisa ter ao menos uma etapa concluida para gerar o produto.");
        }

        if (requireLinkedProduct && !hasLinkedProduct)
        {
            throw new InvalidOperationException("Finalize o produto a partir da tela de pre-cadastro do projeto antes de concluir o projeto.");
        }
    }

    private decimal ComputeFailureAdditionalCost(IReadOnlyList<ProjectStepAttempt> failedAttempts)
    {
        if (failedAttempts.Count == 0)
        {
            return 0;
        }

        return failedAttempts.Sum(attempt =>
        {
            var printerProfile = string.IsNullOrWhiteSpace(attempt.PrinterUsed)
                ? null
                : printerProfileRepository.Query().FirstOrDefault(printer => printer.Name == attempt.PrinterUsed);

            var materialCost = attempt.FilamentsUsed
                .Where(item => item.FilamentProfile is not null && item.FilamentProfile.SpoolWeightKg > 0)
                .Sum(item =>
                {
                    var lostWeight = attempt.WeightLostGrams > 0 && attempt.WeightRealGrams > 0
                        ? item.WeightGrams * (attempt.WeightLostGrams / attempt.WeightRealGrams)
                        : item.WeightGrams;

                    return (lostWeight / (item.FilamentProfile!.SpoolWeightKg * 1000m)) * item.FilamentProfile.CostBRL;
                });

            var lostHours = attempt.TimeLostMinutes / 60m;
            var wearLevel = GetWearLevel(printerProfile?.UsageLevel);
            var energyCost = lostHours * (printerProfile?.PowerKw ?? 0m) * DefaultTariffPerKwh;
            var maintenanceCost = printerProfile is null
                ? 0m
                : ((printerProfile.MachineCost * wearLevel) / Math.Max(1m, printerProfile.WorkHoursPerDay * printerProfile.WorkingDaysPerMonth * 12m)) * lostHours;

            return materialCost + energyCost + maintenanceCost;
        });
    }

    private static IQueryable<Project> ApplyScope(IQueryable<Project> query, Guid? scopedSupplierId)
        => scopedSupplierId.HasValue
            ? query.Where(p => p.OwnerSupplierId == scopedSupplierId)
            : query.Where(p => p.OwnerSupplierId == null);

    private const decimal DefaultTariffPerKwh = 1.0m;

    private static decimal ComputeStepMaterialCost(ProjectStep step)
        => step.FilamentsPlanned
            .Where(f => f.FilamentProfile is not null && f.FilamentProfile.SpoolWeightKg > 0)
            .Sum(f => (f.WeightGrams / (f.FilamentProfile!.SpoolWeightKg * 1000m)) * f.FilamentProfile!.CostBRL);

    private static decimal ComputeStepTotalCost(ProjectStep step)
    {
        var materialCost = ComputeStepMaterialCost(step);
        var printer = step.PrinterProfile;
        var printHours = step.TimeEstimatedMinutes / 60m;
        var wearLevel = GetWearLevel(printer?.UsageLevel);
        var energyCost = printHours * (printer?.PowerKw ?? 0m) * DefaultTariffPerKwh;
        var maintenanceCost = printer is null ? 0m
            : ((printer.MachineCost * wearLevel) / Math.Max(1m, printer.WorkHoursPerDay * printer.WorkingDaysPerMonth * 12m)) * printHours;
        var failureCost = materialCost * (printer?.FailureRate ?? 0m);
        return materialCost + energyCost + maintenanceCost + failureCost;
    }

    private static decimal GetWearLevel(string? usageLevel)
        => usageLevel?.Trim().ToLowerInvariant() switch
        {
            "basico" => 0.10m,
            "medio" => 0.20m,
            "profissional" => 0.30m,
            _ => 0.45m
        };

    private static ProjectDto Map(Project p)
    {
        var steps = p.Steps.ToList();

        // Quando a entidade nao esta hidratada (ex.: listagem), nao recalcula
        // custos detalhados para evitar consultas pesadas no endpoint de lista.
        var estimatedMaterial = steps.Count == 0
            ? 0
            : steps.Sum(ComputeStepMaterialCost);
        var estimatedTotal = steps.Count == 0
            ? 0
            : steps.Sum(ComputeStepTotalCost);
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
            p.UpdatedAtUtc,
            decimal.Round(estimatedMaterial, 2),
            decimal.Round(estimatedTotal, 2),
            p.IsPersonalized,
            p.PersonalizedSizeCm,
            p.PersonalizedSizeMinCm,
            p.PersonalizedSizeMaxCm,
            p.PersonalizedIsPainted,
            p.PersonalizedQuotedPriceBRL,
            p.PersonalizedGeneratedProductId,
            p.PersonalizedSaleId);
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
