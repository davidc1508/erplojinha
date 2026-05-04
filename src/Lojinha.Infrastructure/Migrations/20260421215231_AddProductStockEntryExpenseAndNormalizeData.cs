using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductStockEntryExpenseAndNormalizeData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "GenerateProductionExpenseOnStockEntry",
                schema: "public",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

                        migrationBuilder.Sql(@"
UPDATE public.""Products""
SET ""Name"" = upper(substring(""Name"" from 1 for 1)) || substring(""Name"" from 2)
WHERE ""Name"" IS NOT NULL
    AND length(""Name"") > 0
    AND substring(""Name"" from 1 for 1) <> upper(substring(""Name"" from 1 for 1));");

                        migrationBuilder.Sql(@"
UPDATE public.""Products""
SET ""CurrentStock"" = 0
WHERE ""SupplierId"" IS NULL
    AND ""CurrentStock"" <> 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GenerateProductionExpenseOnStockEntry",
                schema: "public",
                table: "Products");
        }
    }
}
