namespace Lojinha.Api.Entities;

public sealed class PaintingSizeRange : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public decimal MinHeightCm { get; set; }
    public decimal? MaxHeightCm { get; set; }
    public bool RequiresManualReview { get; set; }
    public int Order { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<PaintingSizeRangeHours> Hours { get; set; } = new List<PaintingSizeRangeHours>();

    public bool Covers(decimal heightCm)
        => heightCm > MinHeightCm && (!MaxHeightCm.HasValue || heightCm <= MaxHeightCm.Value);

    public bool Overlaps(decimal otherMinHeightCm, decimal? otherMaxHeightCm)
        => MinHeightCm < (otherMaxHeightCm ?? decimal.MaxValue) && otherMinHeightCm < (MaxHeightCm ?? decimal.MaxValue);
}
