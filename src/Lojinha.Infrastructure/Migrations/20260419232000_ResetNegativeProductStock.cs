using Lojinha.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260419232000_ResetNegativeProductStock")]
public partial class ResetNegativeProductStock : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("UPDATE public.\"Products\" SET \"CurrentStock\" = 0 WHERE \"CurrentStock\" < 0;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}