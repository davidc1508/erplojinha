namespace Lojinha.Api.Entities;

public sealed class FairSupplier : BaseEntity
{
    public Guid FairId { get; set; }
    public Fair? Fair { get; set; }
    public Guid SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
}