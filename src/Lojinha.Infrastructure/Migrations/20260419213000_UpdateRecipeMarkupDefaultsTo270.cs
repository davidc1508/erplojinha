using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations;

public partial class UpdateRecipeMarkupDefaultsTo270 : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE public."ProductRecipes"
            SET "RetailMarkup" = 2.7,
                "ResellerMarkup" = 2.7
            WHERE "RetailMarkup" <> 2.7
               OR "ResellerMarkup" <> 2.7;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE public."ProductRecipes"
            SET "RetailMarkup" = 2.5,
                "ResellerMarkup" = 2.7
            WHERE "RetailMarkup" = 2.7
               OR "ResellerMarkup" = 2.7;
            """);
    }
}