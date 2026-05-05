using Lojinha.Api.Contracts.Personalized;
using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Contracts.Projects;
using Lojinha.Api.Contracts.Sales;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IPersonalizedService
{
    Task<IReadOnlyList<PersonalizedPricingTierDto>> GetPricingAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PersonalizedPricingTierDto>> SavePricingAsync(IReadOnlyList<PersonalizedPricingTierRequest> request, string actor, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PersonalizedProjectDto>> GetProjectsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto> CreateProjectAsync(CreatePersonalizedProjectRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto?> UpdateBudgetAsync(Guid projectId, UpdatePersonalizedBudgetRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto?> AdvanceBudgetAsync(Guid projectId, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto?> RejectBudgetAsync(Guid projectId, RejectPersonalizedBudgetRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto?> AdvanceModelingAsync(Guid projectId, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto?> ApproveProjectAsync(Guid projectId, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto?> ConfigurePrintProductAsync(Guid projectId, PersonalizedPrintProductRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto?> CompletePrintingAsync(Guid projectId, CompletePersonalizedPrintingRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto?> CompleteFinishingAsync(Guid projectId, CompletePersonalizedFinishingRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
    Task<PersonalizedProjectDto?> FinalizeProjectAsync(Guid projectId, FinalizePersonalizedProjectRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default);
}

public sealed class PersonalizedService(
    IRepository<PersonalizedPricingTier> pricingRepository,
    IRepository<Project> projectRepository,
    IRepository<ProjectStep> stepRepository,
    IRepository<ProductCategory> categoryRepository,
    IRepository<Product> productRepository,
    IInventoryRepository inventoryRepository,
    IRepository<AuditLog> auditRepository,
    IProjectService projectService,
    IProductService productService,
    ISalesService salesService) : IPersonalizedService
{
    private const string EncomendaCategoryName = "Encomenda";

    private const string StepBudget = "Orçamento";
    private const string StepModeling = "Elaboração modelo 3D";
    private const string StepApproval = "Aprovação do projeto";
    private const string StepPrinting = "Impressão";
    private const string StepFinishing = "Acabamento";
    private const string StepFinalization = "Finalização";

    private static readonly string[] FixedSteps =
    [
        StepBudget,
        StepModeling,
        StepApproval,
        StepPrinting,
        StepFinishing,
        StepFinalization
    ];

    public Task<IReadOnlyList<PersonalizedPricingTierDto>> GetPricingAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<PersonalizedPricingTierDto>>(pricingRepository.Query()
            .OrderBy(x => x.Order)
            .Select(MapTier)
            .ToList());

    public async Task<IReadOnlyList<PersonalizedPricingTierDto>> SavePricingAsync(IReadOnlyList<PersonalizedPricingTierRequest> request, string actor, CancellationToken cancellationToken = default)
    {
        var existing = pricingRepository.Query().ToList();
        foreach (var item in existing)
        {
            pricingRepository.Remove(item);
        }

        if (existing.Count > 0)
        {
            await pricingRepository.SaveChangesAsync(cancellationToken);
        }

        foreach (var item in request.OrderBy(x => x.Order))
        {
            await pricingRepository.AddAsync(new PersonalizedPricingTier
            {
                Order = item.Order,
                MinSizeCm = item.MinSizeCm,
                MaxSizeCm = item.MaxSizeCm,
                FinishedPriceBRL = item.FinishedPriceBRL,
                UnpaintedPriceBRL = item.UnpaintedPriceBRL,
                IsActive = item.IsActive
            }, cancellationToken);
        }

        if (request.Count > 0)
        {
            await pricingRepository.SaveChangesAsync(cancellationToken);
        }

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(PersonalizedPricingTier),
            EntityId = "bulk",
            Action = AuditAction.Updated,
            ChangedBy = actor,
            PayloadJson = $"{{\"count\":{request.Count}}}"
        }, cancellationToken);
        await auditRepository.SaveChangesAsync(cancellationToken);

        return pricingRepository.Query().OrderBy(x => x.Order).Select(MapTier).ToList();
    }

    public async Task<IReadOnlyList<PersonalizedProjectDto>> GetProjectsAsync(Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var query = projectRepository.Query().Where(x => x.IsPersonalized);
        if (scopedSupplierId.HasValue)
        {
            query = query.Where(x => x.OwnerSupplierId == scopedSupplierId.Value);
        }
        else
        {
            query = query.Where(x => x.OwnerSupplierId == null);
        }

        var projectIds = query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => x.Id)
            .ToList();

        var result = new List<PersonalizedProjectDto>(projectIds.Count);
        foreach (var projectId in projectIds)
        {
            var item = await BuildProjectResponseAsync(projectId, actor: "system", scopedSupplierId, cancellationToken);
            if (item is not null)
            {
                result.Add(item);
            }
        }

        return result;
    }

    public async Task<PersonalizedProjectDto> CreateProjectAsync(CreatePersonalizedProjectRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        ValidateRange(request.SizeMinCm, request.SizeMaxCm);

        var quote = ResolveQuote(request.SizeMaxCm, request.IsPainted);

        var project = new Project
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            Status = ProjectStatus.Planejado,
            OwnerSupplierId = scopedSupplierId,
            IsPersonalized = true,
            PersonalizedSizeCm = null,
            PersonalizedSizeMinCm = request.SizeMinCm,
            PersonalizedSizeMaxCm = request.SizeMaxCm,
            PersonalizedIsPainted = request.IsPainted,
            PersonalizedQuotedPriceBRL = quote,
            TimeEstimatedMinutes = 0,
            WeightEstimatedGrams = 0,
            TimeCompletedMinutes = 0,
            WeightCompletedGrams = 0,
            TimeLostToFailuresMinutes = 0,
            WeightLostToFailuresGrams = 0,
            ProgressPercentage = 0
        };

        await projectRepository.AddAsync(project, cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);

        for (var index = 0; index < FixedSteps.Length; index++)
        {
            await stepRepository.AddAsync(new ProjectStep
            {
                ProjectId = project.Id,
                Name = FixedSteps[index],
                Order = index + 1,
                TimeEstimatedMinutes = 0,
                WeightEstimatedGrams = 0,
                Status = ProjectStepStatus.Pendente
            }, cancellationToken);
        }

        await stepRepository.SaveChangesAsync(cancellationToken);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Project),
            EntityId = project.Id.ToString(),
            Action = AuditAction.Created,
            ChangedBy = actor,
            PayloadJson = "{\"module\":\"Personalizados\"}"
        }, cancellationToken);
        await auditRepository.SaveChangesAsync(cancellationToken);

        var dto = await projectService.GetProjectByIdAsync(project.Id, actor, scopedSupplierId, cancellationToken)
            ?? throw new InvalidOperationException("Projeto personalizado não encontrado após criação.");

        return new PersonalizedProjectDto(dto, null, dto.PersonalizedSaleId);
    }

    public async Task<PersonalizedProjectDto?> UpdateBudgetAsync(Guid projectId, UpdatePersonalizedBudgetRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = FindScopedPersonalizedProject(projectId, scopedSupplierId);
        if (project is null)
        {
            return null;
        }

        if (project.Status == ProjectStatus.Cancelado)
        {
            throw new InvalidOperationException("Este personalizado está cancelado.");
        }

        ValidateRange(request.SizeMinCm, request.SizeMaxCm);

        project.PersonalizedSizeCm = null;
        project.PersonalizedSizeMinCm = request.SizeMinCm;
        project.PersonalizedSizeMaxCm = request.SizeMaxCm;
        project.PersonalizedIsPainted = request.IsPainted;
        project.PersonalizedQuotedPriceBRL = ResolveQuote(request.SizeMaxCm, request.IsPainted);
        projectRepository.Update(project);
        await projectRepository.SaveChangesAsync(cancellationToken);

        if (project.PersonalizedGeneratedProductId.HasValue)
        {
            var existingProduct = await productRepository.GetByIdAsync(project.PersonalizedGeneratedProductId.Value, cancellationToken);
            if (existingProduct is not null)
            {
                existingProduct.SalePrice = project.PersonalizedQuotedPriceBRL.Value;
                productRepository.Update(existingProduct);
                await productRepository.SaveChangesAsync(cancellationToken);
            }
        }

        return await BuildProjectResponseAsync(projectId, actor, scopedSupplierId, cancellationToken);
    }

    public Task<PersonalizedProjectDto?> AdvanceBudgetAsync(Guid projectId, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
        => CompleteFixedStepAsync(projectId, StepBudget, 0m, actor, scopedSupplierId, cancellationToken);

    public async Task<PersonalizedProjectDto?> RejectBudgetAsync(Guid projectId, RejectPersonalizedBudgetRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = FindScopedPersonalizedProject(projectId, scopedSupplierId);
        if (project is null)
        {
            return null;
        }

        if (project.Status == ProjectStatus.Cancelado)
        {
            return await BuildProjectResponseAsync(projectId, actor, scopedSupplierId, cancellationToken);
        }

        project.Status = ProjectStatus.Cancelado;
        projectRepository.Update(project);

        var steps = stepRepository.Query().Where(x => x.ProjectId == projectId).ToList();
        foreach (var step in steps)
        {
            if (step.Status == ProjectStepStatus.Pendente || step.Status == ProjectStepStatus.EmAndamento)
            {
                step.Status = ProjectStepStatus.Cancelada;
                stepRepository.Update(step);
            }
        }

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(Project),
            EntityId = project.Id.ToString(),
            Action = AuditAction.Updated,
            ChangedBy = actor,
            PayloadJson = $"{{\"module\":\"Personalizados\",\"budgetRejected\":true,\"reason\":\"{request.Reason?.Trim() ?? string.Empty}\"}}"
        }, cancellationToken);

        await stepRepository.SaveChangesAsync(cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);
        await auditRepository.SaveChangesAsync(cancellationToken);

        return await BuildProjectResponseAsync(projectId, actor, scopedSupplierId, cancellationToken);
    }

    public Task<PersonalizedProjectDto?> AdvanceModelingAsync(Guid projectId, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
        => CompleteFixedStepAsync(projectId, StepModeling, 0m, actor, scopedSupplierId, cancellationToken);

    public Task<PersonalizedProjectDto?> ApproveProjectAsync(Guid projectId, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
        => CompleteFixedStepAsync(projectId, StepApproval, 0m, actor, scopedSupplierId, cancellationToken);

    public async Task<PersonalizedProjectDto?> ConfigurePrintProductAsync(Guid projectId, PersonalizedPrintProductRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = FindScopedPersonalizedProject(projectId, scopedSupplierId);
        if (project is null)
        {
            return null;
        }

        if (project.Status == ProjectStatus.Cancelado)
        {
            throw new InvalidOperationException("Este personalizado está cancelado.");
        }

        EnsureStepIsCompleted(projectId, StepApproval);

        project.PersonalizedSizeCm = request.RealSizeCm;
        project.PersonalizedQuotedPriceBRL = ResolveQuote(request.RealSizeCm, project.PersonalizedIsPainted ?? true);

        var categoryId = await EnsureEncomendaCategoryAsync(cancellationToken);

        var productRequest = new ProductRequest(
            request.Name,
            request.Sku?.Trim() ?? string.Empty,
            request.Description,
            categoryId,
            request.SupplierId,
            request.GenerateProductionExpenseOnStockEntry,
            0m,
            request.MinimumStock,
            request.ItemsPerPlate,
            request.EstimatedPrintTimeMinutes,
            request.HeightCentimeters,
            request.LengthMetersUsed,
            request.TariffPerKwh,
            request.FinishingPercentage,
            request.CommissionPercentage,
            request.PrinterProfileId,
            request.Filaments,
            request.MarketplaceFeeId,
            request.AdditionalCost,
            request.DesiredMarkup,
            request.CostPrice,
            request.SalePrice ?? project.PersonalizedQuotedPriceBRL);

        ProductDto product;
        if (project.PersonalizedGeneratedProductId.HasValue)
        {
            var updated = await productService.UpdateAsync(project.PersonalizedGeneratedProductId.Value, productRequest, actor, scopedSupplierId, cancellationToken);
            product = updated ?? throw new InvalidOperationException("Produto personalizado não encontrado para atualização.");
        }
        else
        {
            product = await productService.CreateAsync(productRequest, actor, scopedSupplierId, cancellationToken);
        }

        project.ProductId = product.Id;
        project.PersonalizedGeneratedProductId = product.Id;
        projectRepository.Update(project);
        await projectRepository.SaveChangesAsync(cancellationToken);

        return await BuildProjectResponseAsync(projectId, actor, scopedSupplierId, cancellationToken);
    }

    public async Task<PersonalizedProjectDto?> CompletePrintingAsync(Guid projectId, CompletePersonalizedPrintingRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = FindScopedPersonalizedProject(projectId, scopedSupplierId);
        if (project is null)
        {
            return null;
        }

        if (!project.PersonalizedGeneratedProductId.HasValue)
        {
            throw new InvalidOperationException("Configure o produto da impressão antes de finalizar esta etapa.");
        }

        if (!project.PersonalizedSizeCm.HasValue)
        {
            throw new InvalidOperationException("Defina o tamanho real antes de finalizar a impressão.");
        }

        await CompleteFixedStepAsync(projectId, StepPrinting, request.TimeRealMinutes, actor, scopedSupplierId, cancellationToken);

        var product = await productRepository.GetByIdAsync(project.PersonalizedGeneratedProductId.Value, cancellationToken)
            ?? throw new InvalidOperationException("Produto da impressão não encontrado.");

        product.CurrentStock += request.ProducedQuantity;
        product.LifecycleStatus = ProductLifecycleStatus.EmProducao;
        productRepository.Update(product);

        await inventoryRepository.AddAsync(new InventoryMovement
        {
            ItemType = InventoryItemType.Product,
            ItemId = product.Id,
            Type = InventoryMovementType.Entry,
            Quantity = request.ProducedQuantity,
            UnitCost = product.CostPrice,
            Notes = $"Entrada da etapa de impressão do personalizado {project.Name}",
            ReferenceId = project.Id,
            OccurredAtUtc = DateTime.UtcNow
        }, cancellationToken);

        await productRepository.SaveChangesAsync(cancellationToken);

        return await BuildProjectResponseAsync(projectId, actor, scopedSupplierId, cancellationToken);
    }

    public async Task<PersonalizedProjectDto?> CompleteFinishingAsync(Guid projectId, CompletePersonalizedFinishingRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = FindScopedPersonalizedProject(projectId, scopedSupplierId);
        if (project is null)
        {
            return null;
        }

        await CompleteFixedStepAsync(projectId, StepFinishing, request.TimeRealMinutes, actor, scopedSupplierId, cancellationToken);

        if (project.PersonalizedGeneratedProductId.HasValue)
        {
            var product = await productRepository.GetByIdAsync(project.PersonalizedGeneratedProductId.Value, cancellationToken);
            if (product is not null)
            {
                product.LifecycleStatus = ProductLifecycleStatus.Disponivel;
                productRepository.Update(product);
                await productRepository.SaveChangesAsync(cancellationToken);
            }
        }

        return await BuildProjectResponseAsync(projectId, actor, scopedSupplierId, cancellationToken);
    }

    public async Task<PersonalizedProjectDto?> FinalizeProjectAsync(Guid projectId, FinalizePersonalizedProjectRequest request, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken = default)
    {
        var project = FindScopedPersonalizedProject(projectId, scopedSupplierId);
        if (project is null)
        {
            return null;
        }

        if (project.PersonalizedSaleId.HasValue)
        {
            throw new InvalidOperationException("Este personalizado já foi finalizado com venda registrada.");
        }

        if (!project.PersonalizedGeneratedProductId.HasValue)
        {
            throw new InvalidOperationException("Configure e produza o produto antes de finalizar.");
        }

        await CompleteFixedStepAsync(projectId, StepFinalization, 0m, actor, scopedSupplierId, cancellationToken);

        var quote = project.PersonalizedQuotedPriceBRL
            ?? (await productRepository.GetByIdAsync(project.PersonalizedGeneratedProductId.Value, cancellationToken))?.SalePrice
            ?? 0m;

        var sale = await salesService.CreateAsync(new CreateSaleRequest(
                request.PaymentMethod,
                request.SoldAtUtc,
                request.Notes,
                [new SaleItemRequest(project.PersonalizedGeneratedProductId.Value, null, request.Quantity, quote, null)]),
            actor,
            scopedSupplierId,
            null,
            cancellationToken);

        project.PersonalizedSaleId = sale.Id;
        projectRepository.Update(project);
        await projectRepository.SaveChangesAsync(cancellationToken);

        await projectService.ConcludeProjectAsync(projectId, actor, scopedSupplierId, cancellationToken);

        return await BuildProjectResponseAsync(projectId, actor, scopedSupplierId, cancellationToken);
    }

    private async Task<PersonalizedProjectDto?> CompleteFixedStepAsync(Guid projectId, string stepName, decimal timeRealMinutes, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken)
    {
        var project = FindScopedPersonalizedProject(projectId, scopedSupplierId);
        if (project is null)
        {
            return null;
        }

        var step = FindStep(projectId, stepName)
            ?? throw new InvalidOperationException($"Etapa '{stepName}' não encontrada no projeto personalizado.");

        await projectService.CompleteStepAsync(
            projectId,
            step.Id,
            new ProjectStepAttemptCompleteRequest(timeRealMinutes),
            actor,
            scopedSupplierId,
            cancellationToken);

        return await BuildProjectResponseAsync(projectId, actor, scopedSupplierId, cancellationToken);
    }

    private Project? FindScopedPersonalizedProject(Guid projectId, Guid? scopedSupplierId)
    {
        var query = projectRepository.Query().Where(x => x.Id == projectId && x.IsPersonalized);
        if (scopedSupplierId.HasValue)
        {
            query = query.Where(x => x.OwnerSupplierId == scopedSupplierId.Value);
        }
        else
        {
            query = query.Where(x => x.OwnerSupplierId == null);
        }

        return query.FirstOrDefault();
    }

    private ProjectStep? FindStep(Guid projectId, string stepName)
        => stepRepository.Query().FirstOrDefault(x => x.ProjectId == projectId && x.Name == stepName);

    private void EnsureStepIsCompleted(Guid projectId, string stepName)
    {
        var step = FindStep(projectId, stepName)
            ?? throw new InvalidOperationException($"Etapa '{stepName}' não encontrada no projeto personalizado.");

        if (step.Status != ProjectStepStatus.Concluida)
        {
            throw new InvalidOperationException($"Conclua a etapa '{stepName}' antes de continuar.");
        }
    }

    private async Task<Guid> EnsureEncomendaCategoryAsync(CancellationToken cancellationToken)
    {
        var existing = categoryRepository.Query()
            .FirstOrDefault(x => x.Name.ToLower() == EncomendaCategoryName.ToLower());
        if (existing is not null)
        {
            return existing.Id;
        }

        var category = new ProductCategory
        {
            NumericIdentifier = (categoryRepository.Query().Select(x => (int?)x.NumericIdentifier).Max() ?? 0) + 1,
            Name = EncomendaCategoryName,
            Description = "Categoria reservada para pedidos personalizados.",
            ColorHex = "#7bcfc0"
        };

        await categoryRepository.AddAsync(category, cancellationToken);
        await categoryRepository.SaveChangesAsync(cancellationToken);
        return category.Id;
    }

    private decimal ResolveQuote(decimal sizeCm, bool isPainted)
    {
        var tier = pricingRepository.Query()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Order)
            .FirstOrDefault(x => sizeCm >= x.MinSizeCm && (!x.MaxSizeCm.HasValue || sizeCm <= x.MaxSizeCm.Value));

        if (tier is null)
        {
            throw new InvalidOperationException("Nenhuma faixa de preço ativa cobre o tamanho informado.");
        }

        var pricePerCm = isPainted ? tier.FinishedPriceBRL : tier.UnpaintedPriceBRL;
        return decimal.Round(pricePerCm * sizeCm, 2);
    }

    private static void ValidateRange(decimal sizeMinCm, decimal sizeMaxCm)
    {
        if (sizeMinCm <= 0 || sizeMaxCm <= 0)
        {
            throw new InvalidOperationException("O tamanho mínimo e máximo devem ser maiores que zero.");
        }

        if (sizeMinCm > sizeMaxCm)
        {
            throw new InvalidOperationException("O tamanho mínimo não pode ser maior que o tamanho máximo.");
        }
    }

    private async Task<PersonalizedProjectDto?> BuildProjectResponseAsync(Guid projectId, string actor, Guid? scopedSupplierId, CancellationToken cancellationToken)
    {
        var project = await projectService.GetProjectByIdAsync(projectId, actor, scopedSupplierId, cancellationToken);
        if (project is null)
        {
            return null;
        }

        ProductDto? product = null;
        if (project.PersonalizedGeneratedProductId.HasValue)
        {
            product = await productService.GetByIdAsync(project.PersonalizedGeneratedProductId.Value, scopedSupplierId, cancellationToken);
        }

        return new PersonalizedProjectDto(project, product, project.PersonalizedSaleId);
    }

    private async Task<IReadOnlyList<PersonalizedProjectDto>> HydrateProductsAsync(IReadOnlyList<ProjectDto> projects, CancellationToken cancellationToken)
    {
        var result = new List<PersonalizedProjectDto>(projects.Count);
        foreach (var project in projects)
        {
            ProductDto? product = null;
            if (project.PersonalizedGeneratedProductId.HasValue)
            {
                product = await productService.GetByIdAsync(project.PersonalizedGeneratedProductId.Value, project.OwnerSupplierId, cancellationToken);
            }

            result.Add(new PersonalizedProjectDto(project, product, project.PersonalizedSaleId));
        }

        return result;
    }

    private static PersonalizedPricingTierDto MapTier(PersonalizedPricingTier tier)
        => new(
            tier.Id,
            tier.Order,
            tier.MinSizeCm,
            tier.MaxSizeCm,
            tier.FinishedPriceBRL,
            tier.UnpaintedPriceBRL,
            tier.IsActive);
}
