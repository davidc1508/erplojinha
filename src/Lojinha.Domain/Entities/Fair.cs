using Lojinha.Api.Domain.Abstractions;

namespace Lojinha.Api.Entities;

public sealed class Fair : AuditableEntity, IAggregateRoot
{
    public string Name { get; set; } = string.Empty;
    public DateTime EventDateUtc { get; set; }
    public DateTime EndDateUtc { get; set; }
    public string Location { get; set; } = string.Empty;
    public decimal RegistrationFee { get; set; }
    public int RegistrationFeeSplitCount { get; set; } = 1;
    public decimal StoreFeePercentage { get; set; } = 50m;
    public string Notes { get; set; } = string.Empty;
    public FairStatus Status { get; private set; } = FairStatus.Open;
    public DateTime? FinalizedAtUtc { get; private set; }
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
    public ICollection<FairSupplier> Suppliers { get; set; } = new List<FairSupplier>();

    public decimal StoreRegistrationFee
        => decimal.Round(RegistrationFee * (StoreFeePercentage / 100m), 2, MidpointRounding.AwayFromZero);

    public decimal SupplierRegistrationFee
        => decimal.Round(Math.Max(RegistrationFee - StoreRegistrationFee, 0m), 2, MidpointRounding.AwayFromZero);

    public void UpdateDetails(string name, DateTime eventDateUtc, DateTime endDateUtc, string location, decimal registrationFee, int registrationFeeSplitCount, decimal storeFeePercentage, string notes)
    {
        var normalizedStartDate = NormalizeUtc(eventDateUtc);
        var normalizedEndDate = NormalizeUtc(endDateUtc);
        if (normalizedEndDate < normalizedStartDate)
        {
            throw new InvalidOperationException("A data final da feira nao pode ser anterior a data inicial.");
        }

        Name = name.Trim();
        EventDateUtc = normalizedStartDate;
        EndDateUtc = normalizedEndDate;
        Location = location.Trim();
        RegistrationFee = registrationFee;
        RegistrationFeeSplitCount = Math.Max(1, registrationFeeSplitCount);
        StoreFeePercentage = decimal.Round(Math.Clamp(storeFeePercentage, 0m, 100m), 2, MidpointRounding.AwayFromZero);
        Notes = notes.Trim();

        if (Status != FairStatus.Finalized && Status != FairStatus.Cancelled && EventDateUtc.Date > DateTime.UtcNow.Date)
        {
            Status = FairStatus.Awaiting;
        }
    }

    private static DateTime NormalizeUtc(DateTime value)
        => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    public void EnsureOpen()
    {
        if (Status == FairStatus.Awaiting)
        {
            throw new InvalidOperationException("A feira ainda esta aguardando inicio e nao aceita vendas.");
        }

        if (Status == FairStatus.Finalized)
        {
            throw new InvalidOperationException("A feira já foi finalizada e não aceita novas vendas.");
        }

        if (Status == FairStatus.Cancelled)
        {
            throw new InvalidOperationException("A feira foi cancelada e nao aceita novas vendas.");
        }
    }

    public bool CanStart()
        => Status == FairStatus.Awaiting && EventDateUtc.Date <= DateTime.UtcNow.Date;

    public void StartFair()
    {
        if (Status != FairStatus.Awaiting)
        {
            throw new InvalidOperationException("A feira nao esta aguardando inicio.");
        }

        if (EventDateUtc.Date > DateTime.UtcNow.Date)
        {
            throw new InvalidOperationException("A feira so pode ser iniciada a partir da data de inicio.");
        }

        Status = FairStatus.Open;
        FinalizedAtUtc = null;
    }

    public void FinalizeFair()
    {
        EnsureOpen();
        Status = FairStatus.Finalized;
        FinalizedAtUtc = DateTime.UtcNow;
    }

    public void ReopenFair()
    {
        if (Status == FairStatus.Open)
        {
            throw new InvalidOperationException("A feira ja esta em aberto.");
        }

        Status = EventDateUtc.Date > DateTime.UtcNow.Date ? FairStatus.Awaiting : FairStatus.Open;
        FinalizedAtUtc = null;
    }

    public void CancelFair()
    {
        if (Status == FairStatus.Cancelled)
        {
            throw new InvalidOperationException("A feira ja esta cancelada.");
        }

        if (Sales.Count > 0)
        {
            throw new InvalidOperationException("Nao e possivel cancelar uma feira que ja possui vendas registradas.");
        }

        Status = FairStatus.Cancelled;
        FinalizedAtUtc = null;
    }
}