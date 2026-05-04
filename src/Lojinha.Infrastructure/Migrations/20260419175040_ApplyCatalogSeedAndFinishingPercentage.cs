using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations
{
    /// <inheritdoc />
    public partial class ApplyCatalogSeedAndFinishingPercentage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "FinishingPercentage",
                schema: "public",
                table: "Products",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.Sql(CatalogSeedSql.Up);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(CatalogSeedSql.Down);

            migrationBuilder.DropColumn(
                name: "FinishingPercentage",
                schema: "public",
                table: "Products");
        }
    }
}
