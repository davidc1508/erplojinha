using System.Text.Json;
using Lojinha.Api.Caching;
using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;

namespace Lojinha.Api.Services;

public interface ISupplyService
{
    Task<IReadOnlyList<Supply>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<Supply?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Supply> CreateAsync(Supply supply, string actor, CancellationToken cancellationToken = default);
    Task<Supply?> UpdateAsync(Guid id, Supply request, string actor, CancellationToken cancellationToken = default);
}

public sealed class SupplyService(
    IAppCacheInvalidationService cacheInvalidationService,
    IRepository<Supply> supplyRepository,
    IRepository<FilamentProfile> filamentRepository,
    IRepository<AuditLog> auditRepository) : ISupplyService
{
    public Task<IReadOnlyList<Supply>> GetAllAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<Supply>>(supplyRepository.Query().OrderBy(x => x.Name).ToList());

    public Task<Supply?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => supplyRepository.GetByIdAsync(id, cancellationToken);

    public async Task<Supply> CreateAsync(Supply supply, string actor, CancellationToken cancellationToken = default)
    {
        await supplyRepository.AddAsync(supply, cancellationToken);
        await SyncFilamentProfileAsync(supply, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(supply, AuditAction.Created, actor), cancellationToken);
        await supplyRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        return supply;
    }

    public async Task<Supply?> UpdateAsync(Guid id, Supply request, string actor, CancellationToken cancellationToken = default)
    {
        var supply = await supplyRepository.GetByIdAsync(id, cancellationToken);
        if (supply is null)
        {
            return null;
        }

        supply.Name = request.Name.Trim();
        supply.Unit = request.Unit.Trim();
        supply.CostPerUnit = request.CostPerUnit;
        supply.StockQuantity = request.StockQuantity;
        supply.MinimumStock = request.MinimumStock;
        supply.Notes = request.Notes?.Trim() ?? string.Empty;

        await SyncFilamentProfileAsync(supply, cancellationToken);
        supplyRepository.Update(supply);
        await auditRepository.AddAsync(CreateAudit(supply, AuditAction.Updated, actor), cancellationToken);
        await supplyRepository.SaveChangesAsync(cancellationToken);
        await cacheInvalidationService.InvalidateMetadataAsync(cancellationToken: cancellationToken);
        return supply;
    }

    private static AuditLog CreateAudit(Supply supply, AuditAction action, string actor)
        => new()
        {
            EntityName = nameof(Supply),
            EntityId = supply.Id.ToString(),
            Action = action,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(new { supply.Name, supply.CostPerUnit, supply.StockQuantity })
        };

    private async Task SyncFilamentProfileAsync(Supply supply, CancellationToken cancellationToken)
    {
        var unit = (supply.Unit ?? string.Empty).Trim().ToLowerInvariant();
        if (unit is not ("g" or "kg"))
        {
            return;
        }

        var normalizedName = supply.Name.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return;
        }

        var filament = filamentRepository.Query().FirstOrDefault(item => item.Name == normalizedName);
        var costPerKg = unit == "kg"
            ? supply.CostPerUnit
            : decimal.Round(supply.CostPerUnit * 1000m, 2, MidpointRounding.AwayFromZero);

        if (filament is null)
        {
            filament = new FilamentProfile
            {
                Name = normalizedName,
                Brand = string.Empty,
                Description = $"Sincronizado automaticamente do insumo '{normalizedName}'.",
                SpoolWeightKg = 1m,
                SpoolLengthMeters = 0m,
                CostBRL = costPerKg
            };

            await filamentRepository.AddAsync(filament, cancellationToken);
            return;
        }

        filament.CostBRL = costPerKg;
        filamentRepository.Update(filament);
    }
}