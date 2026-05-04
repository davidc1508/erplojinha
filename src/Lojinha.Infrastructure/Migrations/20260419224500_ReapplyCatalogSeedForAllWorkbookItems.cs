using Lojinha.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260419224500_ReapplyCatalogSeedForAllWorkbookItems")]
public partial class ReapplyCatalogSeedForAllWorkbookItems : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(CatalogSeedSql.Up);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}