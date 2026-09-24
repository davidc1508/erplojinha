using Lojinha.Api.Entities;

namespace Lojinha.Api.Services;

public sealed record PaintingPricingSeedData(
    PaintingSettings Settings,
    IReadOnlyList<PaintingLevel> Levels,
    IReadOnlyList<PaintingComplexity> Complexities,
    IReadOnlyList<PaintingSizeRange> SizeRanges,
    IReadOnlyList<PaintingSizeRangeHours> SizeRangeHours,
    IReadOnlyList<PaintingPreparationService> PreparationServices,
    IReadOnlyList<PaintingAddOn> AddOns);

public static class PaintingPricingSeed
{
    public static PaintingSettings CreateDefaultSettings()
        => new()
        {
            DefaultHourlyRate = 45m,
            DefaultMaterialsPercentage = 12m,
            MinimumMaterialsAmount = 20m,
            MinimumPaintingPrice = 50m,
            DefaultMarginPercentage = 0m,
            Rounding = PaintingPriceRounding.None
        };

    public static PaintingPricingSeedData Create()
    {
        var levels = new List<PaintingLevel>
        {
            Level(1, "Básica / Comercial", "Pintura simples, poucas cores, acabamento comercial e menor tempo de execução.", 35m),
            Level(2, "Colecionável", "Boa definição de cores, sombras, highlights, detalhes e acabamento adequado para figures colecionáveis.", 45m),
            Level(3, "Detalhada", "Maior quantidade de detalhes, técnicas adicionais, acabamento refinado, maior tempo de execução.", 60m),
            Level(4, "Premium / Display", "Pintura artística, técnicas avançadas e acabamento de exposição.", 75m)
        };

        var complexities = new List<PaintingComplexity>
        {
            Complexity(1, "Simples", 1.00m, "Grandes áreas de cor uniforme, poucas cores, pouca textura, sem rosto humano, pouco mascaramento e poucos acessórios. Ex.: Pokémon simples, personagens cartoon e objetos."),
            Complexity(2, "Normal", 1.25m, "Pele, cabelo, roupas, olhos, sombras, highlights, quantidade moderada de acessórios e aproximadamente 6 a 10 cores."),
            Complexity(3, "Detalhada", 1.50m, "Rosto detalhado, olhos pequenos, armaduras, tecidos, couro, metais, acessórios, várias texturas e diversas áreas de mascaramento."),
            Complexity(4, "Muito detalhada / Premium", 2.00m, "Dioramas, múltiplos personagens, pele realista, NMM, OSL, weathering, efeitos de energia, fogo, iluminação, degradês complexos e bases altamente detalhadas.")
        };

        var rangeDefinitions = new (string Name, decimal Min, decimal? Max, decimal[] Hours, bool ManualReview)[]
        {
            ("Até 5 cm", 0m, 5m, [0.75m, 1.25m, 2m, 3m], false),
            ("6 a 10 cm", 5m, 10m, [1.5m, 2.5m, 4m, 6m], false),
            ("11 a 15 cm", 10m, 15m, [2.5m, 4m, 6m, 9m], false),
            ("16 a 20 cm", 15m, 20m, [3.5m, 5m, 8m, 12m], false),
            ("21 a 25 cm", 20m, 25m, [4.5m, 6.5m, 10m, 15m], false),
            ("26 a 30 cm", 25m, 30m, [5.5m, 8m, 12m, 18m], false),
            ("31 a 40 cm", 30m, 40m, [7m, 10m, 15m, 22m], false),
            ("Acima de 40 cm", 40m, null, [0m, 0m, 0m, 0m], true)
        };

        var sizeRanges = new List<PaintingSizeRange>();
        var sizeRangeHours = new List<PaintingSizeRangeHours>();
        for (var index = 0; index < rangeDefinitions.Length; index++)
        {
            var definition = rangeDefinitions[index];
            var range = new PaintingSizeRange
            {
                Name = definition.Name,
                MinHeightCm = definition.Min,
                MaxHeightCm = definition.Max,
                RequiresManualReview = definition.ManualReview,
                Order = index + 1,
                IsActive = true
            };
            sizeRanges.Add(range);

            for (var levelIndex = 0; levelIndex < levels.Count; levelIndex++)
            {
                sizeRangeHours.Add(new PaintingSizeRangeHours
                {
                    SizeRangeId = range.Id,
                    LevelId = levels[levelIndex].Id,
                    Hours = definition.Hours[levelIndex]
                });
            }
        }

        var preparationServices = new List<PaintingPreparationService>
        {
            Preparation("Limpeza básica / preparação", "Limpeza da peça e preparação para pintura.", PaintingPreparationChargeType.FixedAmount, 20m, 0m),
            Preparation("Remoção de marcas de suporte e lixamento", "Faixa comercial de referência: R$ 20,00 a R$ 60,00.", PaintingPreparationChargeType.FixedAmount, 35m, 0m),
            Preparation("Montagem e colagem", "Montagem das partes e colagem.", PaintingPreparationChargeType.FixedAmount, 40m, 0m),
            Preparation("Correção de emendas", "Preenchimento e acabamento de emendas.", PaintingPreparationChargeType.FixedAmount, 50m, 0m),
            Preparation("Correção de defeitos de impressão", "Cobrado por hora. Sem valor próprio, usa o valor-hora do cálculo.", PaintingPreparationChargeType.Hourly, 0m, 1m),
            Preparation("Aplicação de primer", "Aplicação de primer antes da pintura.", PaintingPreparationChargeType.FixedAmount, 20m, 0m)
        };

        var addOns = new[]
        {
            "Base detalhada",
            "Pintura de olhos complexos",
            "Pele realista",
            "NMM",
            "OSL",
            "Weathering",
            "Efeito de fogo",
            "Efeito de energia",
            "Transparências",
            "Sangue",
            "Textura de couro",
            "Textura metálica",
            "Mascaramento complexo",
            "Diorama",
            "Personagem adicional"
        }.Select(name => new PaintingAddOn
        {
            Name = name,
            ChargeType = PaintingAddOnChargeType.FixedAmount,
            IsActive = true
        }).ToList();

        return new PaintingPricingSeedData(
            CreateDefaultSettings(),
            levels,
            complexities,
            sizeRanges,
            sizeRangeHours,
            preparationServices,
            addOns);
    }

    private static PaintingLevel Level(int order, string name, string description, decimal hourlyRate)
        => new() { Order = order, Name = name, Description = description, HourlyRate = hourlyRate, IsActive = true };

    private static PaintingComplexity Complexity(int order, string name, decimal multiplier, string description)
        => new() { Order = order, Name = name, Multiplier = multiplier, Description = description, IsActive = true };

    private static PaintingPreparationService Preparation(string name, string description, PaintingPreparationChargeType chargeType, decimal value, decimal estimatedHours)
        => new() { Name = name, Description = description, ChargeType = chargeType, Value = value, EstimatedHours = estimatedHours, IsActive = true };
}
