using System.Globalization;
using System.Text.Json;
using Lojinha.Api.Contracts.PaintingPricing;
using Lojinha.Api.Domain.Services;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface IPaintingPricingService
{
    Task<PaintingPricingOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default);
    Task<PaintingSettingsDto> UpdateSettingsAsync(UpdatePaintingSettingsRequest request, string actor, CancellationToken cancellationToken = default);
    Task<PaintingLevelDto> CreateLevelAsync(PaintingLevelRequest request, string actor, CancellationToken cancellationToken = default);
    Task<PaintingLevelDto?> UpdateLevelAsync(Guid id, PaintingLevelRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteLevelAsync(Guid id, string actor, CancellationToken cancellationToken = default);
    Task<PaintingComplexityDto> CreateComplexityAsync(PaintingComplexityRequest request, string actor, CancellationToken cancellationToken = default);
    Task<PaintingComplexityDto?> UpdateComplexityAsync(Guid id, PaintingComplexityRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteComplexityAsync(Guid id, string actor, CancellationToken cancellationToken = default);
    Task<PaintingSizeRangeDto> CreateSizeRangeAsync(PaintingSizeRangeRequest request, string actor, CancellationToken cancellationToken = default);
    Task<PaintingSizeRangeDto?> UpdateSizeRangeAsync(Guid id, PaintingSizeRangeRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteSizeRangeAsync(Guid id, string actor, CancellationToken cancellationToken = default);
    Task<PaintingPreparationServiceDto> CreatePreparationServiceAsync(PaintingPreparationServiceRequest request, string actor, CancellationToken cancellationToken = default);
    Task<PaintingPreparationServiceDto?> UpdatePreparationServiceAsync(Guid id, PaintingPreparationServiceRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeletePreparationServiceAsync(Guid id, string actor, CancellationToken cancellationToken = default);
    Task<PaintingMaterialDto> CreateMaterialAsync(PaintingMaterialRequest request, string actor, CancellationToken cancellationToken = default);
    Task<PaintingMaterialDto?> UpdateMaterialAsync(Guid id, PaintingMaterialRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteMaterialAsync(Guid id, string actor, CancellationToken cancellationToken = default);
    Task<PaintingAddOnDto> CreateAddOnAsync(PaintingAddOnRequest request, string actor, CancellationToken cancellationToken = default);
    Task<PaintingAddOnDto?> UpdateAddOnAsync(Guid id, PaintingAddOnRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteAddOnAsync(Guid id, string actor, CancellationToken cancellationToken = default);
    Task<PaintingPricingResultDto> CalculateAsync(PaintingPricingCalculationRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaintingHistoryEntryDto>> GetHistoryAsync(int take, CancellationToken cancellationToken = default);
    Task<ProductPaintingCalculationDto?> CalculateForProductAsync(ProductPaintingRequest? request, CancellationToken cancellationToken = default);
    Task<ProductPaintingRecalculationDto?> RecalculateForProductAsync(Guid productId, CancellationToken cancellationToken = default);
    Task<bool> HasNewerParametersAsync(ProductPainting painting, CancellationToken cancellationToken = default);
}

public sealed class PaintingPricingService(
    IRepository<PaintingSettings> settingsRepository,
    IRepository<PaintingLevel> levelRepository,
    IRepository<PaintingComplexity> complexityRepository,
    IRepository<PaintingSizeRange> sizeRangeRepository,
    IRepository<PaintingSizeRangeHours> sizeRangeHoursRepository,
    IRepository<PaintingPreparationService> preparationRepository,
    IRepository<PaintingMaterial> materialRepository,
    IRepository<PaintingAddOn> addOnRepository,
    IRepository<AuditLog> auditRepository,
    IRepository<ProductPainting> productPaintingRepository) : IPaintingPricingService
{
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    private static readonly IReadOnlyDictionary<string, string> EntityLabels = new Dictionary<string, string>
    {
        [nameof(PaintingSettings)] = "Configurações gerais",
        [nameof(PaintingLevel)] = "Nível de pintura",
        [nameof(PaintingComplexity)] = "Complexidade",
        [nameof(PaintingSizeRange)] = "Faixa de tamanho",
        [nameof(PaintingPreparationService)] = "Serviço de preparação",
        [nameof(PaintingMaterial)] = "Material",
        [nameof(PaintingAddOn)] = "Adicional"
    };

    public async Task<PaintingPricingOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default)
    {
        var settings = await GetOrCreateSettingsAsync(cancellationToken);
        var hoursByRange = sizeRangeHoursRepository.Query().ToList().ToLookup(x => x.SizeRangeId);

        return new PaintingPricingOverviewDto(
            MapSettings(settings),
            levelRepository.Query().OrderBy(x => x.Order).ThenBy(x => x.Name).ToList().Select(level => MapLevel(level, settings)).ToList(),
            complexityRepository.Query().OrderBy(x => x.Order).ThenBy(x => x.Name).ToList().Select(MapComplexity).ToList(),
            sizeRangeRepository.Query().OrderBy(x => x.Order).ThenBy(x => x.MinHeightCm).ToList().Select(range => MapSizeRange(range, hoursByRange[range.Id])).ToList(),
            preparationRepository.Query().OrderBy(x => x.Name).ToList().Select(MapPreparation).ToList(),
            materialRepository.Query().OrderBy(x => x.Category).ThenBy(x => x.Name).ToList().Select(MapMaterial).ToList(),
            addOnRepository.Query().OrderBy(x => x.Name).ToList().Select(MapAddOn).ToList());
    }

    public async Task<PaintingSettingsDto> UpdateSettingsAsync(UpdatePaintingSettingsRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var settings = await GetOrCreateSettingsAsync(cancellationToken);
        var before = Snapshot(settings);

        settings.DefaultHourlyRate = Money(request.DefaultHourlyRate);
        settings.DefaultMaterialsPercentage = Money(request.DefaultMaterialsPercentage);
        settings.MinimumMaterialsAmount = Money(request.MinimumMaterialsAmount);
        settings.MinimumPaintingPrice = Money(request.MinimumPaintingPrice);
        settings.DefaultMarginPercentage = Money(request.DefaultMarginPercentage);
        settings.Rounding = request.Rounding;

        settingsRepository.Update(settings);
        await AddAuditAsync(nameof(PaintingSettings), settings.Id, "Configurações gerais", AuditAction.Updated, actor, before, Snapshot(settings), cancellationToken);
        await settingsRepository.SaveChangesAsync(cancellationToken);
        return MapSettings(settings);
    }

    public async Task<PaintingLevelDto> CreateLevelAsync(PaintingLevelRequest request, string actor, CancellationToken cancellationToken = default)
    {
        EnsureUniqueName(levelRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), null, "nível de pintura");
        var level = new PaintingLevel();
        Apply(level, request);

        await levelRepository.AddAsync(level, cancellationToken);
        await AddAuditAsync(nameof(PaintingLevel), level.Id, level.Name, AuditAction.Created, actor, null, Snapshot(level), cancellationToken);
        await levelRepository.SaveChangesAsync(cancellationToken);
        return MapLevel(level, await GetOrCreateSettingsAsync(cancellationToken));
    }

    public async Task<PaintingLevelDto?> UpdateLevelAsync(Guid id, PaintingLevelRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var level = await levelRepository.GetByIdAsync(id, cancellationToken);
        if (level is null)
        {
            return null;
        }

        EnsureUniqueName(levelRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), id, "nível de pintura");
        var before = Snapshot(level);
        Apply(level, request);

        levelRepository.Update(level);
        await AddAuditAsync(nameof(PaintingLevel), level.Id, level.Name, AuditAction.Updated, actor, before, Snapshot(level), cancellationToken);
        await levelRepository.SaveChangesAsync(cancellationToken);
        return MapLevel(level, await GetOrCreateSettingsAsync(cancellationToken));
    }

    public async Task<bool> DeleteLevelAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var level = await levelRepository.GetByIdAsync(id, cancellationToken);
        if (level is null)
        {
            return false;
        }

        foreach (var hours in sizeRangeHoursRepository.Query().Where(x => x.LevelId == id).ToList())
        {
            sizeRangeHoursRepository.Remove(hours);
        }

        levelRepository.Remove(level);
        await AddAuditAsync(nameof(PaintingLevel), level.Id, level.Name, AuditAction.Deleted, actor, Snapshot(level), null, cancellationToken);
        await levelRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PaintingComplexityDto> CreateComplexityAsync(PaintingComplexityRequest request, string actor, CancellationToken cancellationToken = default)
    {
        EnsureUniqueName(complexityRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), null, "complexidade");
        var complexity = new PaintingComplexity();
        Apply(complexity, request);

        await complexityRepository.AddAsync(complexity, cancellationToken);
        await AddAuditAsync(nameof(PaintingComplexity), complexity.Id, complexity.Name, AuditAction.Created, actor, null, Snapshot(complexity), cancellationToken);
        await complexityRepository.SaveChangesAsync(cancellationToken);
        return MapComplexity(complexity);
    }

    public async Task<PaintingComplexityDto?> UpdateComplexityAsync(Guid id, PaintingComplexityRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var complexity = await complexityRepository.GetByIdAsync(id, cancellationToken);
        if (complexity is null)
        {
            return null;
        }

        EnsureUniqueName(complexityRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), id, "complexidade");
        var before = Snapshot(complexity);
        Apply(complexity, request);

        complexityRepository.Update(complexity);
        await AddAuditAsync(nameof(PaintingComplexity), complexity.Id, complexity.Name, AuditAction.Updated, actor, before, Snapshot(complexity), cancellationToken);
        await complexityRepository.SaveChangesAsync(cancellationToken);
        return MapComplexity(complexity);
    }

    public async Task<bool> DeleteComplexityAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var complexity = await complexityRepository.GetByIdAsync(id, cancellationToken);
        if (complexity is null)
        {
            return false;
        }

        complexityRepository.Remove(complexity);
        await AddAuditAsync(nameof(PaintingComplexity), complexity.Id, complexity.Name, AuditAction.Deleted, actor, Snapshot(complexity), null, cancellationToken);
        await complexityRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PaintingSizeRangeDto> CreateSizeRangeAsync(PaintingSizeRangeRequest request, string actor, CancellationToken cancellationToken = default)
    {
        EnsureUniqueName(sizeRangeRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), null, "faixa de tamanho");
        EnsureNoOverlap(request, null);
        var levels = levelRepository.Query().ToList();
        var range = new PaintingSizeRange();
        Apply(range, request);
        var hours = BuildHours(range.Id, request.Hours, levels);

        await sizeRangeRepository.AddAsync(range, cancellationToken);
        foreach (var item in hours)
        {
            await sizeRangeHoursRepository.AddAsync(item, cancellationToken);
        }

        await AddAuditAsync(nameof(PaintingSizeRange), range.Id, range.Name, AuditAction.Created, actor, null, Snapshot(range, hours, levels), cancellationToken);
        await sizeRangeRepository.SaveChangesAsync(cancellationToken);
        return MapSizeRange(range, hours);
    }

    public async Task<PaintingSizeRangeDto?> UpdateSizeRangeAsync(Guid id, PaintingSizeRangeRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var range = await sizeRangeRepository.GetByIdAsync(id, cancellationToken);
        if (range is null)
        {
            return null;
        }

        EnsureUniqueName(sizeRangeRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), id, "faixa de tamanho");
        EnsureNoOverlap(request, id);
        var levels = levelRepository.Query().ToList();
        var existingHours = sizeRangeHoursRepository.Query().Where(x => x.SizeRangeId == id).ToList();
        var before = Snapshot(range, existingHours, levels);

        Apply(range, request);
        var requestedHours = BuildHours(range.Id, request.Hours, levels);
        var hours = new List<PaintingSizeRangeHours>();
        foreach (var item in existingHours.Where(existing => requestedHours.All(requested => requested.LevelId != existing.LevelId)))
        {
            sizeRangeHoursRepository.Remove(item);
        }

        foreach (var item in requestedHours)
        {
            var existing = existingHours.FirstOrDefault(current => current.LevelId == item.LevelId);
            if (existing is null)
            {
                await sizeRangeHoursRepository.AddAsync(item, cancellationToken);
                hours.Add(item);
                continue;
            }

            existing.Hours = item.Hours;
            sizeRangeHoursRepository.Update(existing);
            hours.Add(existing);
        }

        sizeRangeRepository.Update(range);
        await AddAuditAsync(nameof(PaintingSizeRange), range.Id, range.Name, AuditAction.Updated, actor, before, Snapshot(range, hours, levels), cancellationToken);
        await sizeRangeRepository.SaveChangesAsync(cancellationToken);
        return MapSizeRange(range, hours);
    }

    public async Task<bool> DeleteSizeRangeAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var range = await sizeRangeRepository.GetByIdAsync(id, cancellationToken);
        if (range is null)
        {
            return false;
        }

        var levels = levelRepository.Query().ToList();
        var hours = sizeRangeHoursRepository.Query().Where(x => x.SizeRangeId == id).ToList();
        foreach (var item in hours)
        {
            sizeRangeHoursRepository.Remove(item);
        }

        sizeRangeRepository.Remove(range);
        await AddAuditAsync(nameof(PaintingSizeRange), range.Id, range.Name, AuditAction.Deleted, actor, Snapshot(range, hours, levels), null, cancellationToken);
        await sizeRangeRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PaintingPreparationServiceDto> CreatePreparationServiceAsync(PaintingPreparationServiceRequest request, string actor, CancellationToken cancellationToken = default)
    {
        EnsureUniqueName(preparationRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), null, "serviço de preparação");
        var preparation = new PaintingPreparationService();
        Apply(preparation, request);

        await preparationRepository.AddAsync(preparation, cancellationToken);
        await AddAuditAsync(nameof(PaintingPreparationService), preparation.Id, preparation.Name, AuditAction.Created, actor, null, Snapshot(preparation), cancellationToken);
        await preparationRepository.SaveChangesAsync(cancellationToken);
        return MapPreparation(preparation);
    }

    public async Task<PaintingPreparationServiceDto?> UpdatePreparationServiceAsync(Guid id, PaintingPreparationServiceRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var preparation = await preparationRepository.GetByIdAsync(id, cancellationToken);
        if (preparation is null)
        {
            return null;
        }

        EnsureUniqueName(preparationRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), id, "serviço de preparação");
        var before = Snapshot(preparation);
        Apply(preparation, request);

        preparationRepository.Update(preparation);
        await AddAuditAsync(nameof(PaintingPreparationService), preparation.Id, preparation.Name, AuditAction.Updated, actor, before, Snapshot(preparation), cancellationToken);
        await preparationRepository.SaveChangesAsync(cancellationToken);
        return MapPreparation(preparation);
    }

    public async Task<bool> DeletePreparationServiceAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var preparation = await preparationRepository.GetByIdAsync(id, cancellationToken);
        if (preparation is null)
        {
            return false;
        }

        preparationRepository.Remove(preparation);
        await AddAuditAsync(nameof(PaintingPreparationService), preparation.Id, preparation.Name, AuditAction.Deleted, actor, Snapshot(preparation), null, cancellationToken);
        await preparationRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PaintingMaterialDto> CreateMaterialAsync(PaintingMaterialRequest request, string actor, CancellationToken cancellationToken = default)
    {
        EnsureUniqueName(materialRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), null, "material");
        var material = new PaintingMaterial();
        Apply(material, request);

        await materialRepository.AddAsync(material, cancellationToken);
        await AddAuditAsync(nameof(PaintingMaterial), material.Id, material.Name, AuditAction.Created, actor, null, Snapshot(material), cancellationToken);
        await materialRepository.SaveChangesAsync(cancellationToken);
        return MapMaterial(material);
    }

    public async Task<PaintingMaterialDto?> UpdateMaterialAsync(Guid id, PaintingMaterialRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var material = await materialRepository.GetByIdAsync(id, cancellationToken);
        if (material is null)
        {
            return null;
        }

        EnsureUniqueName(materialRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), id, "material");
        var before = Snapshot(material);
        Apply(material, request);

        materialRepository.Update(material);
        await AddAuditAsync(nameof(PaintingMaterial), material.Id, material.Name, AuditAction.Updated, actor, before, Snapshot(material), cancellationToken);
        await materialRepository.SaveChangesAsync(cancellationToken);
        return MapMaterial(material);
    }

    public async Task<bool> DeleteMaterialAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var material = await materialRepository.GetByIdAsync(id, cancellationToken);
        if (material is null)
        {
            return false;
        }

        materialRepository.Remove(material);
        await AddAuditAsync(nameof(PaintingMaterial), material.Id, material.Name, AuditAction.Deleted, actor, Snapshot(material), null, cancellationToken);
        await materialRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PaintingAddOnDto> CreateAddOnAsync(PaintingAddOnRequest request, string actor, CancellationToken cancellationToken = default)
    {
        EnsureUniqueName(addOnRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), null, "adicional");
        var addOn = new PaintingAddOn();
        Apply(addOn, request);

        await addOnRepository.AddAsync(addOn, cancellationToken);
        await AddAuditAsync(nameof(PaintingAddOn), addOn.Id, addOn.Name, AuditAction.Created, actor, null, Snapshot(addOn), cancellationToken);
        await addOnRepository.SaveChangesAsync(cancellationToken);
        return MapAddOn(addOn);
    }

    public async Task<PaintingAddOnDto?> UpdateAddOnAsync(Guid id, PaintingAddOnRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var addOn = await addOnRepository.GetByIdAsync(id, cancellationToken);
        if (addOn is null)
        {
            return null;
        }

        EnsureUniqueName(addOnRepository.Query().Where(x => x.Name == request.Name.Trim()).Select(x => x.Id), id, "adicional");
        var before = Snapshot(addOn);
        Apply(addOn, request);

        addOnRepository.Update(addOn);
        await AddAuditAsync(nameof(PaintingAddOn), addOn.Id, addOn.Name, AuditAction.Updated, actor, before, Snapshot(addOn), cancellationToken);
        await addOnRepository.SaveChangesAsync(cancellationToken);
        return MapAddOn(addOn);
    }

    public async Task<bool> DeleteAddOnAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var addOn = await addOnRepository.GetByIdAsync(id, cancellationToken);
        if (addOn is null)
        {
            return false;
        }

        addOnRepository.Remove(addOn);
        await AddAuditAsync(nameof(PaintingAddOn), addOn.Id, addOn.Name, AuditAction.Deleted, actor, Snapshot(addOn), null, cancellationToken);
        await addOnRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PaintingPricingResultDto> CalculateAsync(PaintingPricingCalculationRequest request, CancellationToken cancellationToken = default)
    {
        var settings = await GetOrCreateSettingsAsync(cancellationToken);
        var level = await levelRepository.GetByIdAsync(request.LevelId, cancellationToken)
            ?? throw new InvalidOperationException("Nível de pintura não encontrado.");
        if (!level.IsActive)
        {
            throw new InvalidOperationException($"O nível de pintura '{level.Name}' está inativo e não pode ser usado em novos cálculos.");
        }

        var complexity = await complexityRepository.GetByIdAsync(request.ComplexityId, cancellationToken)
            ?? throw new InvalidOperationException("Complexidade não encontrada.");
        if (!complexity.IsActive)
        {
            throw new InvalidOperationException($"A complexidade '{complexity.Name}' está inativa e não pode ser usada em novos cálculos.");
        }

        var sizeRange = sizeRangeRepository.Query()
            .Where(x => x.IsActive)
            .ToList()
            .OrderBy(x => x.MinHeightCm)
            .FirstOrDefault(x => x.Covers(request.HeightCm));

        if (sizeRange is null && !request.HoursOverride.HasValue && request.Outsourced is null)
        {
            throw new InvalidOperationException("Nenhuma faixa de tamanho ativa cobre a altura informada. Cadastre a faixa ou informe as horas manualmente.");
        }

        var baseHours = sizeRange is null
            ? 0m
            : sizeRangeHoursRepository.Query()
                .Where(x => x.SizeRangeId == sizeRange.Id && x.LevelId == level.Id)
                .Select(x => x.Hours)
                .FirstOrDefault();

        var preparations = ResolveSelections(
            request.Preparations,
            preparationRepository.Query().ToList(),
            item => item.Id,
            item => item.IsActive,
            item => item.Name,
            "serviço de preparação",
            (item, selection) => new PaintingPreparationCharge(item.Id, item.Name, item.ChargeType, item.Value, item.EstimatedHours, selection.ManualAmount, selection.Hours));

        var addOnSelections = (request.AddOns ?? []).ToList();
        if (request.Base?.Mode == PaintingBaseMode.AddOn && request.Base.AddOnId.HasValue && addOnSelections.All(selection => selection.Id != request.Base.AddOnId.Value))
        {
            addOnSelections.Add(new PaintingItemSelectionRequest(request.Base.AddOnId.Value, null, null));
        }

        var addOns = ResolveSelections(
            addOnSelections,
            addOnRepository.Query().ToList(),
            item => item.Id,
            item => item.IsActive,
            item => item.Name,
            "adicional",
            (item, selection) => new PaintingAddOnCharge(item.Id, item.Name, item.ChargeType, item.Value, item.Percentage, item.AdditionalHours, selection.ManualAmount));

        if (request.ExtraPreparation is { UnitAmount: > 0m } extraPreparation)
        {
            preparations.Add(new PaintingPreparationCharge(Guid.Empty, ExtraName(extraPreparation, "Preparação adicional"), PaintingPreparationChargeType.Manual, 0m, 0m, ExtraAmount(extraPreparation), null));
        }

        if (request.FreeAddOn is { UnitAmount: > 0m } freeAddOn)
        {
            addOns.Add(new PaintingAddOnCharge(Guid.Empty, ExtraName(freeAddOn, "Adicional livre"), PaintingAddOnChargeType.Manual, 0m, 0m, 0m, ExtraAmount(freeAddOn)));
        }

        var baseCharge = await ResolveBaseChargeAsync(request.Base, settings, cancellationToken);
        var outsourcedCharge = request.Outsourced is null
            ? null
            : new PaintingOutsourcedCharge(request.Outsourced.ChargedAmount, request.Outsourced.FreightAmount, request.Outsourced.OtherCosts, request.Outsourced.IncorporatedPrice);

        var result = PaintingPriceCalculator.Calculate(new PaintingCalculationInput(
            settings.DefaultHourlyRate,
            settings.DefaultMaterialsPercentage,
            settings.MinimumMaterialsAmount,
            settings.MinimumPaintingPrice,
            settings.DefaultMarginPercentage,
            settings.Rounding,
            level.HourlyRate,
            baseHours,
            complexity.Multiplier,
            preparations,
            addOns,
            request.HoursOverride,
            request.HourlyRateOverride,
            request.MaterialsPercentageOverride,
            request.MaterialsAmountOverride,
            request.PreparationAmountOverride,
            request.AddOnsAmountOverride,
            request.MarginPercentageOverride,
            request.FinalPriceOverride,
            baseCharge,
            outsourcedCharge));

        var warnings = new List<string>();
        if (sizeRange?.RequiresManualReview == true)
        {
            warnings.Add("Recomendada avaliação manual.");
        }

        if (sizeRange is not null && baseHours <= 0m && !request.HoursOverride.HasValue)
        {
            warnings.Add("Não há horas base para esta faixa e nível. Informe as horas manualmente.");
        }

        if (result.MinimumPriceApplied && !result.FinalPriceOverridden)
        {
            warnings.Add($"Valor mínimo de pintura aplicado ({FormatMoney(result.MinimumPaintingPrice)}).");
        }

        return new PaintingPricingResultDto(
            request.HeightCm,
            new PaintingReferenceDto(level.Id, level.Name),
            new PaintingReferenceDto(complexity.Id, complexity.Name),
            sizeRange is null ? null : new PaintingSizeRangeReferenceDto(sizeRange.Id, sizeRange.Name, sizeRange.MinHeightCm, sizeRange.MaxHeightCm, sizeRange.RequiresManualReview),
            result.BaseHours,
            result.ComplexityMultiplier,
            result.EstimatedHours,
            result.HoursOverridden,
            result.AddOnHours,
            result.TotalHours,
            result.HourlyRate,
            result.HourlyRateSource.ToString(),
            result.LaborAmount,
            result.MaterialsPercentage,
            settings.MinimumMaterialsAmount,
            result.MaterialsAmount,
            result.MaterialsMinimumApplied,
            result.MaterialsOverridden,
            result.Preparations.Select(MapLine).ToList(),
            result.PreparationAmount,
            result.PreparationOverridden,
            result.AddOns.Select(MapLine).ToList(),
            result.AddOnsAmount,
            result.AddOnsOverridden,
            result.BaseAmount,
            result.IsOutsourced,
            result.OutsourcedAmount,
            result.CostAmount,
            result.MarginPercentage,
            result.MarginAmount,
            result.CalculatedAmount,
            result.MinimumPaintingPrice,
            result.MinimumPriceApplied,
            result.Rounding,
            result.SuggestedPrice,
            result.FinalPrice,
            result.FinalPriceOverridden,
            warnings,
            DateTime.UtcNow,
            result.MaterialsByPercentageAmount);
    }

    public Task<IReadOnlyList<PaintingHistoryEntryDto>> GetHistoryAsync(int take, CancellationToken cancellationToken = default)
    {
        var entityNames = EntityLabels.Keys.ToList();
        var logs = auditRepository.Query()
            .Where(x => entityNames.Contains(x.EntityName))
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(Math.Clamp(take, 1, 500))
            .ToList();

        return Task.FromResult<IReadOnlyList<PaintingHistoryEntryDto>>(logs.Select(MapHistory).ToList());
    }

    public async Task<ProductPaintingCalculationDto?> CalculateForProductAsync(ProductPaintingRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null || !request.Enabled)
        {
            return null;
        }

        if (request.KeepStoredSnapshot && request.SourceProductId.HasValue)
        {
            var stored = productPaintingRepository.Query().FirstOrDefault(x => x.ProductId == request.SourceProductId.Value);
            if (stored is { Enabled: true, CalculatedAtUtc: not null })
            {
                var snapshot = ProductPaintingMapper.ReadSnapshot(stored);
                return BuildProductCalculation(stored.Mode, stored.Execution, request.Application, stored.CostAmount, stored.SuggestedPrice, stored.PriceUsed, request.ManualIncorporatedAmount, snapshot?.Details, true, stored.CalculatedAtUtc.Value);
            }
        }

        if (request.Mode == PaintingPricingMode.Manual)
        {
            return BuildProductCalculation(request.Mode, request.Execution, request.Application, Money(Math.Max(0m, request.ManualCost)), Money(Math.Max(0m, request.ManualPrice)), Money(Math.Max(0m, request.ManualPrice)), request.ManualIncorporatedAmount, null, false, DateTime.UtcNow);
        }

        if (request.HeightCm <= 0m)
        {
            throw new InvalidOperationException("Informe a altura usada no cálculo da pintura.");
        }

        if (!request.LevelId.HasValue || !request.ComplexityId.HasValue)
        {
            throw new InvalidOperationException("Selecione o nível de pintura e a complexidade.");
        }

        var semi = request.Mode == PaintingPricingMode.SemiAutomatic;
        var outsourced = request.Execution == PaintingExecution.Outsourced;
        var details = await CalculateAsync(new PaintingPricingCalculationRequest(
            request.HeightCm,
            request.LevelId.Value,
            request.ComplexityId.Value,
            outsourced ? [] : request.Preparations,
            outsourced ? [] : request.AddOns,
            semi ? request.HoursOverride : null,
            semi ? request.HourlyRateOverride : null,
            null,
            semi ? request.MaterialsAmountOverride : null,
            semi ? request.PreparationAmountOverride : null,
            semi ? request.AddOnsAmountOverride : null,
            semi ? request.MarginPercentageOverride : null,
            semi ? request.FinalPriceOverride : null,
            !outsourced && request.BaseNeedsPainting ? new PaintingBaseRequest(request.BaseMode, request.BaseLevelId, request.BaseHours, request.BaseManualAmount, request.BaseAddOnId) : null,
            outsourced ? new PaintingOutsourcedRequest(request.OutsourcedChargedAmount, request.OutsourcedFreightAmount, request.OutsourcedOtherCosts, request.OutsourcedIncorporatedPrice) : null,
            outsourced ? null : new PaintingExtraChargeRequest(request.ExtraPreparationDescription, 1m, request.ExtraPreparationAmount),
            outsourced ? null : new PaintingExtraChargeRequest(request.FreeAddOnDescription, request.FreeAddOnQuantity, request.FreeAddOnUnitAmount)), cancellationToken);

        return BuildProductCalculation(request.Mode, request.Execution, request.Application, details.CostAmount, details.SuggestedPrice, details.FinalPrice, request.ManualIncorporatedAmount, details, false, details.CalculatedAtUtc);
    }

    public async Task<ProductPaintingRecalculationDto?> RecalculateForProductAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var stored = productPaintingRepository.Query().FirstOrDefault(x => x.ProductId == productId);
        if (stored is null || !stored.Enabled)
        {
            return null;
        }

        var recalculated = await CalculateForProductAsync(ProductPaintingMapper.ToRequest(stored) with { KeepStoredSnapshot = false }, cancellationToken);
        if (recalculated is null)
        {
            return null;
        }

        var storedCalculation = ProductPaintingMapper.ReadSnapshot(stored);
        var costDifference = Money(recalculated.CostAmount - stored.CostAmount);
        var priceDifference = Money(recalculated.PriceUsed - stored.PriceUsed);
        var hasDifferences = costDifference != 0m || priceDifference != 0m || recalculated.SuggestedPrice != stored.SuggestedPrice;
        return new ProductPaintingRecalculationDto(storedCalculation, recalculated, costDifference, priceDifference, hasDifferences);
    }

    public async Task<bool> HasNewerParametersAsync(ProductPainting painting, CancellationToken cancellationToken = default)
    {
        if (!painting.Enabled || painting.Mode == PaintingPricingMode.Manual || !painting.CalculatedAtUtc.HasValue)
        {
            return false;
        }

        try
        {
            var recalculated = await CalculateForProductAsync(ProductPaintingMapper.ToRequest(painting) with { KeepStoredSnapshot = false }, cancellationToken);
            return recalculated is not null
                && (recalculated.CostAmount != painting.CostAmount || recalculated.SuggestedPrice != painting.SuggestedPrice || recalculated.PriceUsed != painting.PriceUsed);
        }
        catch (InvalidOperationException)
        {
            return true;
        }
    }

    private static ProductPaintingCalculationDto BuildProductCalculation(
        PaintingPricingMode mode,
        PaintingExecution execution,
        PaintingPriceApplication application,
        decimal costAmount,
        decimal suggestedPrice,
        decimal priceUsed,
        decimal manualIncorporatedAmount,
        PaintingPricingResultDto? details,
        bool fromStoredSnapshot,
        DateTime calculatedAtUtc)
    {
        var incorporatedCost = application switch
        {
            PaintingPriceApplication.IncorporateCost => costAmount,
            PaintingPriceApplication.ManualAmount => Money(Math.Max(0m, manualIncorporatedAmount)),
            _ => 0m
        };
        var incorporatedPrice = application == PaintingPriceApplication.IncorporatePrice ? priceUsed : 0m;
        return new ProductPaintingCalculationDto(mode, execution, application, costAmount, suggestedPrice, priceUsed, incorporatedCost, incorporatedPrice, details, fromStoredSnapshot, calculatedAtUtc);
    }

    private async Task<PaintingBaseCharge?> ResolveBaseChargeAsync(PaintingBaseRequest? request, PaintingSettings settings, CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return null;
        }

        switch (request.Mode)
        {
            case PaintingBaseMode.SameLevel:
                return new PaintingBaseCharge(request.Hours, null, null);
            case PaintingBaseMode.OtherLevel:
                var level = request.LevelId.HasValue ? await levelRepository.GetByIdAsync(request.LevelId.Value, cancellationToken) : null;
                if (level is null)
                {
                    throw new InvalidOperationException("Selecione o nível de pintura da base.");
                }

                if (!level.IsActive)
                {
                    throw new InvalidOperationException($"O nível de pintura '{level.Name}' está inativo e não pode ser usado na base.");
                }

                return new PaintingBaseCharge(request.Hours, level.HourlyRate ?? settings.DefaultHourlyRate, null);
            case PaintingBaseMode.ManualAmount:
                return new PaintingBaseCharge(0m, null, request.ManualAmount);
            default:
                return null;
        }
    }

    private static string ExtraName(PaintingExtraChargeRequest charge, string fallback)
    {
        var name = string.IsNullOrWhiteSpace(charge.Description) ? fallback : charge.Description.Trim();
        return charge.Quantity > 1m ? $"{name} × {charge.Quantity.ToString("0.##", PtBr)}" : name;
    }

    private static decimal ExtraAmount(PaintingExtraChargeRequest charge)
        => Money(Math.Max(1m, charge.Quantity) * charge.UnitAmount);

    private async Task<PaintingSettings> GetOrCreateSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = settingsRepository.Query().FirstOrDefault();
        if (settings is not null)
        {
            return settings;
        }

        settings = PaintingPricingSeed.CreateDefaultSettings();
        await settingsRepository.AddAsync(settings, cancellationToken);
        await settingsRepository.SaveChangesAsync(cancellationToken);
        return settings;
    }

    private static List<TCharge> ResolveSelections<TEntity, TCharge>(
        IReadOnlyList<PaintingItemSelectionRequest>? selections,
        IReadOnlyList<TEntity> entities,
        Func<TEntity, Guid> getId,
        Func<TEntity, bool> isActive,
        Func<TEntity, string> getName,
        string label,
        Func<TEntity, PaintingItemSelectionRequest, TCharge> toCharge)
    {
        var result = new List<TCharge>();
        foreach (var selection in (selections ?? []).DistinctBy(x => x.Id))
        {
            var entity = entities.FirstOrDefault(item => getId(item) == selection.Id)
                ?? throw new InvalidOperationException($"O {label} selecionado não foi encontrado.");
            if (!isActive(entity))
            {
                throw new InvalidOperationException($"O {label} '{getName(entity)}' está inativo e não pode ser selecionado.");
            }

            result.Add(toCharge(entity, selection));
        }

        return result;
    }

    private static void EnsureUniqueName(IQueryable<Guid> matchingIds, Guid? currentId, string label)
    {
        if (matchingIds.ToList().Any(id => id != currentId))
        {
            throw new InvalidOperationException($"Já existe um {label} com este nome.");
        }
    }

    private void EnsureNoOverlap(PaintingSizeRangeRequest request, Guid? currentId)
    {
        if (!request.IsActive)
        {
            return;
        }

        var conflict = sizeRangeRepository.Query()
            .Where(x => x.IsActive && x.Id != currentId)
            .ToList()
            .FirstOrDefault(x => x.Overlaps(request.MinHeightCm, request.MaxHeightCm));

        if (conflict is not null)
        {
            throw new InvalidOperationException($"A faixa informada se sobrepõe à faixa ativa '{conflict.Name}'.");
        }
    }

    private static List<PaintingSizeRangeHours> BuildHours(Guid sizeRangeId, IReadOnlyList<PaintingSizeRangeHoursRequest>? hours, IReadOnlyList<PaintingLevel> levels)
    {
        var levelIds = levels.Select(x => x.Id).ToHashSet();
        var result = new List<PaintingSizeRangeHours>();
        foreach (var item in (hours ?? []).DistinctBy(x => x.LevelId))
        {
            if (!levelIds.Contains(item.LevelId))
            {
                throw new InvalidOperationException("Um dos níveis de pintura informados na faixa não existe.");
            }

            result.Add(new PaintingSizeRangeHours { SizeRangeId = sizeRangeId, LevelId = item.LevelId, Hours = Money(item.Hours) });
        }

        return result;
    }

    private async Task AddAuditAsync(string entityName, Guid entityId, string name, AuditAction action, string actor, IReadOnlyDictionary<string, string?>? before, IReadOnlyDictionary<string, string?>? after, CancellationToken cancellationToken)
    {
        var fields = (before?.Keys ?? []).Concat(after?.Keys ?? []).Distinct();
        var changes = fields
            .Select(field => new PaintingHistoryChangeDto(field, before?.GetValueOrDefault(field), after?.GetValueOrDefault(field)))
            .Where(change => change.Before != change.After)
            .ToList();

        if (action == AuditAction.Updated && changes.Count == 0)
        {
            return;
        }

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = entityName,
            EntityId = entityId.ToString(),
            Action = action,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new PaintingAuditPayload(name, changes))
        }, cancellationToken);
    }

    private static PaintingHistoryEntryDto MapHistory(AuditLog log)
    {
        PaintingAuditPayload? payload = null;
        try
        {
            payload = JsonSerializer.Deserialize<PaintingAuditPayload>(log.PayloadJson);
        }
        catch (JsonException)
        {
        }

        return new PaintingHistoryEntryDto(
            log.Id,
            EntityLabels.GetValueOrDefault(log.EntityName, log.EntityName),
            log.EntityId,
            payload?.Name ?? string.Empty,
            log.Action,
            log.ChangedBy,
            log.CreatedAtUtc,
            payload?.Changes ?? []);
    }

    private static Dictionary<string, string?> Snapshot(PaintingSettings settings)
        => new()
        {
            ["Valor-hora padrão"] = FormatMoney(settings.DefaultHourlyRate),
            ["Percentual de materiais"] = FormatPercent(settings.DefaultMaterialsPercentage),
            ["Valor mínimo de materiais"] = FormatMoney(settings.MinimumMaterialsAmount),
            ["Valor mínimo de pintura"] = FormatMoney(settings.MinimumPaintingPrice),
            ["Margem adicional padrão"] = FormatPercent(settings.DefaultMarginPercentage),
            ["Arredondamento"] = settings.Rounding.ToString()
        };

    private static Dictionary<string, string?> Snapshot(PaintingLevel level)
        => new()
        {
            ["Nome"] = level.Name,
            ["Descrição"] = level.Description,
            ["Valor-hora"] = level.HourlyRate.HasValue ? FormatMoney(level.HourlyRate.Value) : "Padrão",
            ["Ordem"] = level.Order.ToString(PtBr),
            ["Ativo"] = FormatBool(level.IsActive)
        };

    private static Dictionary<string, string?> Snapshot(PaintingComplexity complexity)
        => new()
        {
            ["Nome"] = complexity.Name,
            ["Descrição"] = complexity.Description,
            ["Multiplicador"] = complexity.Multiplier.ToString("0.00", PtBr),
            ["Ordem"] = complexity.Order.ToString(PtBr),
            ["Ativo"] = FormatBool(complexity.IsActive)
        };

    private static Dictionary<string, string?> Snapshot(PaintingSizeRange range, IEnumerable<PaintingSizeRangeHours> hours, IReadOnlyList<PaintingLevel> levels)
    {
        var snapshot = new Dictionary<string, string?>
        {
            ["Nome"] = range.Name,
            ["Altura mínima"] = FormatNumber(range.MinHeightCm) + " cm",
            ["Altura máxima"] = range.MaxHeightCm.HasValue ? FormatNumber(range.MaxHeightCm.Value) + " cm" : "Sem limite",
            ["Avaliação manual"] = FormatBool(range.RequiresManualReview),
            ["Ordem"] = range.Order.ToString(PtBr),
            ["Ativo"] = FormatBool(range.IsActive)
        };

        foreach (var item in hours)
        {
            var levelName = levels.FirstOrDefault(level => level.Id == item.LevelId)?.Name ?? item.LevelId.ToString();
            snapshot[$"Horas — {levelName}"] = FormatNumber(item.Hours) + " h";
        }

        return snapshot;
    }

    private static Dictionary<string, string?> Snapshot(PaintingPreparationService preparation)
        => new()
        {
            ["Nome"] = preparation.Name,
            ["Descrição"] = preparation.Description,
            ["Tipo de cobrança"] = preparation.ChargeType.ToString(),
            ["Valor"] = preparation.ChargeType == PaintingPreparationChargeType.Percentage ? FormatPercent(preparation.Value) : FormatMoney(preparation.Value),
            ["Horas estimadas"] = FormatNumber(preparation.EstimatedHours) + " h",
            ["Ativo"] = FormatBool(preparation.IsActive)
        };

    private static Dictionary<string, string?> Snapshot(PaintingMaterial material)
        => new()
        {
            ["Nome"] = material.Name,
            ["Categoria"] = material.Category.ToString(),
            ["Unidade"] = material.Unit,
            ["Valor unitário"] = FormatMoney(material.UnitCost),
            ["Quantidade padrão"] = FormatNumber(material.DefaultQuantity),
            ["Ativo"] = FormatBool(material.IsActive)
        };

    private static Dictionary<string, string?> Snapshot(PaintingAddOn addOn)
        => new()
        {
            ["Nome"] = addOn.Name,
            ["Descrição"] = addOn.Description,
            ["Tipo de cobrança"] = addOn.ChargeType.ToString(),
            ["Valor"] = FormatMoney(addOn.Value),
            ["Percentual"] = FormatPercent(addOn.Percentage),
            ["Horas adicionais"] = FormatNumber(addOn.AdditionalHours) + " h",
            ["Ativo"] = FormatBool(addOn.IsActive)
        };

    private static void Apply(PaintingLevel level, PaintingLevelRequest request)
    {
        level.Name = request.Name.Trim();
        level.Description = request.Description?.Trim() ?? string.Empty;
        level.HourlyRate = request.HourlyRate.HasValue ? Money(request.HourlyRate.Value) : null;
        level.Order = request.Order;
        level.IsActive = request.IsActive;
    }

    private static void Apply(PaintingComplexity complexity, PaintingComplexityRequest request)
    {
        complexity.Name = request.Name.Trim();
        complexity.Description = request.Description?.Trim() ?? string.Empty;
        complexity.Multiplier = Money(request.Multiplier);
        complexity.Order = request.Order;
        complexity.IsActive = request.IsActive;
    }

    private static void Apply(PaintingSizeRange range, PaintingSizeRangeRequest request)
    {
        range.Name = request.Name.Trim();
        range.MinHeightCm = Money(request.MinHeightCm);
        range.MaxHeightCm = request.MaxHeightCm.HasValue ? Money(request.MaxHeightCm.Value) : null;
        range.RequiresManualReview = request.RequiresManualReview;
        range.Order = request.Order;
        range.IsActive = request.IsActive;
    }

    private static void Apply(PaintingPreparationService preparation, PaintingPreparationServiceRequest request)
    {
        preparation.Name = request.Name.Trim();
        preparation.Description = request.Description?.Trim() ?? string.Empty;
        preparation.ChargeType = request.ChargeType;
        preparation.Value = Money(request.Value);
        preparation.EstimatedHours = Money(request.EstimatedHours);
        preparation.IsActive = request.IsActive;
    }

    private static void Apply(PaintingMaterial material, PaintingMaterialRequest request)
    {
        material.Name = request.Name.Trim();
        material.Category = request.Category;
        material.Unit = request.Unit?.Trim() ?? string.Empty;
        material.UnitCost = Money(request.UnitCost);
        material.DefaultQuantity = Money(request.DefaultQuantity);
        material.IsActive = request.IsActive;
    }

    private static void Apply(PaintingAddOn addOn, PaintingAddOnRequest request)
    {
        addOn.Name = request.Name.Trim();
        addOn.Description = request.Description?.Trim() ?? string.Empty;
        addOn.ChargeType = request.ChargeType;
        addOn.Value = Money(request.Value);
        addOn.Percentage = Money(request.Percentage);
        addOn.AdditionalHours = Money(request.AdditionalHours);
        addOn.IsActive = request.IsActive;
    }

    private static PaintingSettingsDto MapSettings(PaintingSettings settings)
        => new(
            settings.DefaultHourlyRate,
            settings.DefaultMaterialsPercentage,
            settings.MinimumMaterialsAmount,
            settings.MinimumPaintingPrice,
            settings.DefaultMarginPercentage,
            settings.Rounding,
            settings.UpdatedAtUtc);

    private static PaintingLevelDto MapLevel(PaintingLevel level, PaintingSettings settings)
        => new(level.Id, level.Name, level.Description, level.HourlyRate, level.HourlyRate ?? settings.DefaultHourlyRate, level.Order, level.IsActive);

    private static PaintingComplexityDto MapComplexity(PaintingComplexity complexity)
        => new(complexity.Id, complexity.Name, complexity.Description, complexity.Multiplier, complexity.Order, complexity.IsActive);

    private static PaintingSizeRangeDto MapSizeRange(PaintingSizeRange range, IEnumerable<PaintingSizeRangeHours> hours)
        => new(
            range.Id,
            range.Name,
            range.MinHeightCm,
            range.MaxHeightCm,
            range.RequiresManualReview,
            range.Order,
            range.IsActive,
            hours.Select(item => new PaintingSizeRangeHoursDto(item.LevelId, item.Hours)).ToList());

    private static PaintingPreparationServiceDto MapPreparation(PaintingPreparationService preparation)
        => new(preparation.Id, preparation.Name, preparation.Description, preparation.ChargeType, preparation.Value, preparation.EstimatedHours, preparation.IsActive);

    private static PaintingMaterialDto MapMaterial(PaintingMaterial material)
        => new(material.Id, material.Name, material.Category, material.Unit, material.UnitCost, material.DefaultQuantity, material.IsActive);

    private static PaintingAddOnDto MapAddOn(PaintingAddOn addOn)
        => new(addOn.Id, addOn.Name, addOn.Description, addOn.ChargeType, addOn.Value, addOn.Percentage, addOn.AdditionalHours, addOn.IsActive);

    private static PaintingChargeLineDto MapLine(PaintingChargeLine line)
        => new(line.Id, line.Name, line.ChargeType, line.Hours, line.Amount);

    private static decimal Money(decimal value)
        => decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    private static string FormatMoney(decimal value)
        => value.ToString("C2", PtBr);

    private static string FormatPercent(decimal value)
        => value.ToString("0.##", PtBr) + "%";

    private static string FormatNumber(decimal value)
        => value.ToString("0.##", PtBr);

    private static string FormatBool(bool value)
        => value ? "Sim" : "Não";

}

internal sealed record PaintingAuditPayload(string Name, IReadOnlyList<PaintingHistoryChangeDto> Changes);
