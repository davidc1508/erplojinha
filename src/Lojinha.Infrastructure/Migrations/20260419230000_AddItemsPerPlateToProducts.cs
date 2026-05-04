using Lojinha.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260419230000_AddItemsPerPlateToProducts")]
public sealed class AddItemsPerPlateToProducts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "ItemsPerPlate",
            schema: "public",
            table: "Products",
            type: "integer",
            nullable: false,
            defaultValue: 1);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "ItemsPerPlate",
            schema: "public",
            table: "Products");
    }
}