namespace Lojinha.Api.Entities;

public sealed class PaintingSizeRangeHours : BaseEntity
{
    public Guid SizeRangeId { get; set; }
    public PaintingSizeRange? SizeRange { get; set; }
    public Guid LevelId { get; set; }
    public PaintingLevel? Level { get; set; }
    public decimal Hours { get; set; }
}
