using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductTypesAndBottonSizes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BottonSizeId",
                schema: "public",
                table: "Products",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BottonSizeQuantity",
                schema: "public",
                table: "Products",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 1m);

            migrationBuilder.AddColumn<decimal>(
                name: "PingenteCost",
                schema: "public",
                table: "Products",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "PingenteSupplyId",
                schema: "public",
                table: "Products",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProductType",
                schema: "public",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "Impressao3D");

            migrationBuilder.CreateTable(
                name: "BottonSizes",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    CostPerUnit = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    StockQuantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MinimumStock = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BottonSizes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Products_BottonSizeId",
                schema: "public",
                table: "Products",
                column: "BottonSizeId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_PingenteSupplyId",
                schema: "public",
                table: "Products",
                column: "PingenteSupplyId");

            migrationBuilder.CreateIndex(
                name: "IX_BottonSizes_Name",
                schema: "public",
                table: "BottonSizes",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Products_BottonSizes_BottonSizeId",
                schema: "public",
                table: "Products",
                column: "BottonSizeId",
                principalSchema: "public",
                principalTable: "BottonSizes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Supplies_PingenteSupplyId",
                schema: "public",
                table: "Products",
                column: "PingenteSupplyId",
                principalSchema: "public",
                principalTable: "Supplies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_BottonSizes_BottonSizeId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropForeignKey(
                name: "FK_Products_Supplies_PingenteSupplyId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropTable(
                name: "BottonSizes",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_Products_BottonSizeId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Products_PingenteSupplyId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "BottonSizeId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "BottonSizeQuantity",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "PingenteCost",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "PingenteSupplyId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ProductType",
                schema: "public",
                table: "Products");
        }
    }
}
