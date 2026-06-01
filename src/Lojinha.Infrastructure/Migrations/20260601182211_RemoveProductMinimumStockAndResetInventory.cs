using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveProductMinimumStockAndResetInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE public."Products"
                SET "CurrentStock" = 0,
                    "UpdatedAtUtc" = NOW()
                WHERE "CurrentStock" <> 0;
                """);

            migrationBuilder.Sql("""
                DELETE FROM public."InventoryMovements"
                WHERE "Type" = 'Entry';
                """);

            migrationBuilder.DropColumn(
                name: "MinimumStock",
                schema: "public",
                table: "Products");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MinimumStock",
                schema: "public",
                table: "Products",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }
    }
}
