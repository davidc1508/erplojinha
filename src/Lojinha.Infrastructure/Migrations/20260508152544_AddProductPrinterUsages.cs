using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductPrinterUsages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductPrinterUsages",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    PrinterProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    TimeRealMinutes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductPrinterUsages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductPrinterUsages_PrinterProfiles_PrinterProfileId",
                        column: x => x.PrinterProfileId,
                        principalSchema: "public",
                        principalTable: "PrinterProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductPrinterUsages_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "public",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductPrinterUsages_PrinterProfileId",
                schema: "public",
                table: "ProductPrinterUsages",
                column: "PrinterProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductPrinterUsages_ProductId",
                schema: "public",
                table: "ProductPrinterUsages",
                column: "ProductId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductPrinterUsages",
                schema: "public");
        }
    }
}
