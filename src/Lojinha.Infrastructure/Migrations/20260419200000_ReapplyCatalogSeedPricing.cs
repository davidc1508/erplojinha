using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations;

public partial class ReapplyCatalogSeedPricing : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(CatalogSeedSql.Up);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}