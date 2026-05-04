using Lojinha.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260419191000_AdjustSeedPricingAndFinishingUi")]
public sealed class AdjustSeedPricingAndFinishingUi : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE public."Products"
            SET "CostPrice" = 41.99,
                "SuggestedPrice" = 113.38,
                "SalePrice" = CASE WHEN "SalePrice" = "SuggestedPrice" THEN 113.38 ELSE "SalePrice" END,
                "ProfitMargin" = ROUND((113.38 - 41.99) / 113.38, 4)
            WHERE "Sku" = 'ENCOMENDAS-JOGO-BOLA-BINGO-24MM';

            UPDATE public."ProductRecipes"
            SET "TotalCost" = 37.64
            WHERE "ProductId" = (
                SELECT "Id"
                FROM public."Products"
                WHERE "Sku" = 'ENCOMENDAS-JOGO-BOLA-BINGO-24MM'
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE public."Products"
            SET "CostPrice" = 45.35,
                "SuggestedPrice" = 122.45,
                "SalePrice" = CASE WHEN "SalePrice" = 113.38 THEN 122.45 ELSE "SalePrice" END,
                "ProfitMargin" = ROUND((122.45 - 45.35) / 122.45, 4)
            WHERE "Sku" = 'ENCOMENDAS-JOGO-BOLA-BINGO-24MM';

            UPDATE public."ProductRecipes"
            SET "TotalCost" = 40.99
            WHERE "ProductId" = (
                SELECT "Id"
                FROM public."Products"
                WHERE "Sku" = 'ENCOMENDAS-JOGO-BOLA-BINGO-24MM'
            );
            """);
    }
}