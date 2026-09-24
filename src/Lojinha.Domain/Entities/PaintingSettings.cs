namespace Lojinha.Api.Entities;

public sealed class PaintingSettings : AuditableEntity
{
    public decimal DefaultHourlyRate { get; set; }
    public decimal DefaultMaterialsPercentage { get; set; }
    public decimal MinimumMaterialsAmount { get; set; }
    public decimal MinimumPaintingPrice { get; set; }
    public decimal DefaultMarginPercentage { get; set; }
    public PaintingPriceRounding Rounding { get; set; } = PaintingPriceRounding.None;
}
