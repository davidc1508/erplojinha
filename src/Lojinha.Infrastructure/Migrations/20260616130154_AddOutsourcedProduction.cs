using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOutsourcedProduction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OutsourcedProductionId",
                schema: "public",
                table: "Products",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProducerSupplierId",
                schema: "public",
                table: "Products",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProductionFeeAmount",
                schema: "public",
                table: "Products",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "OutsourcedProductions",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProducerSupplierId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerSupplierId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemsPerPlate = table.Column<int>(type: "integer", nullable: false),
                    EstimatedPrintTimeMinutes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    HeightCentimeters = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedWeightGrams = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LengthMetersUsed = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TariffPerKwh = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FinishingPercentage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PrinterProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    DefaultMarketplaceFeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProductionCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ProductionFeePercentage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SupplierCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    ConvertedProductId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutsourcedProductions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OutsourcedProductions_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalSchema: "public",
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_OutsourcedProductions_MarketplaceFees_DefaultMarketplaceFee~",
                        column: x => x.DefaultMarketplaceFeeId,
                        principalSchema: "public",
                        principalTable: "MarketplaceFees",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OutsourcedProductions_PrinterProfiles_PrinterProfileId",
                        column: x => x.PrinterProfileId,
                        principalSchema: "public",
                        principalTable: "PrinterProfiles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OutsourcedProductions_Products_ConvertedProductId",
                        column: x => x.ConvertedProductId,
                        principalSchema: "public",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_OutsourcedProductions_Suppliers_OwnerSupplierId",
                        column: x => x.OwnerSupplierId,
                        principalSchema: "public",
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OutsourcedProductions_Suppliers_ProducerSupplierId",
                        column: x => x.ProducerSupplierId,
                        principalSchema: "public",
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OutsourcedProductionFilaments",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OutsourcedProductionId = table.Column<Guid>(type: "uuid", nullable: false),
                    FilamentProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    WeightGrams = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutsourcedProductionFilaments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OutsourcedProductionFilaments_FilamentProfiles_FilamentProf~",
                        column: x => x.FilamentProfileId,
                        principalSchema: "public",
                        principalTable: "FilamentProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OutsourcedProductionFilaments_OutsourcedProductions_Outsour~",
                        column: x => x.OutsourcedProductionId,
                        principalSchema: "public",
                        principalTable: "OutsourcedProductions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OutsourcedProductionRecipes",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OutsourcedProductionId = table.Column<Guid>(type: "uuid", nullable: false),
                    LaborHours = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LaborCostPerHour = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AdditionalCosts = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WholesaleMarkup = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RetailMarkup = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ResellerMarkup = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutsourcedProductionRecipes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OutsourcedProductionRecipes_OutsourcedProductions_Outsource~",
                        column: x => x.OutsourcedProductionId,
                        principalSchema: "public",
                        principalTable: "OutsourcedProductions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Products_ProducerSupplierId",
                schema: "public",
                table: "Products",
                column: "ProducerSupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_OutsourcedProductionFilaments_FilamentProfileId",
                schema: "public",
                table: "OutsourcedProductionFilaments",
                column: "FilamentProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_OutsourcedProductionFilaments_OutsourcedProductionId",
                schema: "public",
                table: "OutsourcedProductionFilaments",
                column: "OutsourcedProductionId");

            migrationBuilder.CreateIndex(
                name: "IX_OutsourcedProductionRecipes_OutsourcedProductionId",
                schema: "public",
                table: "OutsourcedProductionRecipes",
                column: "OutsourcedProductionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OutsourcedProductions_CategoryId",
                schema: "public",
                table: "OutsourcedProductions",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_OutsourcedProductions_ConvertedProductId",
                schema: "public",
                table: "OutsourcedProductions",
                column: "ConvertedProductId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OutsourcedProductions_DefaultMarketplaceFeeId",
                schema: "public",
                table: "OutsourcedProductions",
                column: "DefaultMarketplaceFeeId");

            migrationBuilder.CreateIndex(
                name: "IX_OutsourcedProductions_OwnerSupplierId",
                schema: "public",
                table: "OutsourcedProductions",
                column: "OwnerSupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_OutsourcedProductions_PrinterProfileId",
                schema: "public",
                table: "OutsourcedProductions",
                column: "PrinterProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_OutsourcedProductions_ProducerSupplierId",
                schema: "public",
                table: "OutsourcedProductions",
                column: "ProducerSupplierId");

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Suppliers_ProducerSupplierId",
                schema: "public",
                table: "Products",
                column: "ProducerSupplierId",
                principalSchema: "public",
                principalTable: "Suppliers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_Suppliers_ProducerSupplierId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropTable(
                name: "OutsourcedProductionFilaments",
                schema: "public");

            migrationBuilder.DropTable(
                name: "OutsourcedProductionRecipes",
                schema: "public");

            migrationBuilder.DropTable(
                name: "OutsourcedProductions",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_Products_ProducerSupplierId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "OutsourcedProductionId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ProducerSupplierId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ProductionFeeAmount",
                schema: "public",
                table: "Products");
        }
    }
}
