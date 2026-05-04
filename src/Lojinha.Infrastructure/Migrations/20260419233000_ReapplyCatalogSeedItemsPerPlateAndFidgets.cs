using Lojinha.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260419233000_ReapplyCatalogSeedItemsPerPlateAndFidgets")]
public partial class ReapplyCatalogSeedItemsPerPlateAndFidgets : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(CatalogSeedSql.Up);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}