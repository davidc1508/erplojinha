using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductCombos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductComboItems",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ComboId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductComboItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductComboItems_Products_ComboId",
                        column: x => x.ComboId,
                        principalSchema: "public",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductComboItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "public",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SaleItemComponents",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SaleItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    SupplierId = table.Column<Guid>(type: "uuid", nullable: true),
                    Quantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CostPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SaleItemComponents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SaleItemComponents_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "public",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SaleItemComponents_SaleItems_SaleItemId",
                        column: x => x.SaleItemId,
                        principalSchema: "public",
                        principalTable: "SaleItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductComboItems_ComboId_ProductId",
                schema: "public",
                table: "ProductComboItems",
                columns: new[] { "ComboId", "ProductId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductComboItems_ProductId",
                schema: "public",
                table: "ProductComboItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleItemComponents_ProductId",
                schema: "public",
                table: "SaleItemComponents",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleItemComponents_SaleItemId",
                schema: "public",
                table: "SaleItemComponents",
                column: "SaleItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductComboItems",
                schema: "public");

            migrationBuilder.DropTable(
                name: "SaleItemComponents",
                schema: "public");
        }
    }
}