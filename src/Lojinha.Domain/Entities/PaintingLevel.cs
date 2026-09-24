namespace Lojinha.Api.Entities;

public sealed class PaintingLevel : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal? HourlyRate { get; set; }
    public int Order { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<PaintingSizeRangeHours> SizeRangeHours { get; set; } = new List<PaintingSizeRangeHours>();
}
