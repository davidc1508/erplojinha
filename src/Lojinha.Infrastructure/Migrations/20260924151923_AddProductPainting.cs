using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductPainting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductPaintings",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    Mode = table.Column<string>(type: "text", nullable: false),
                    Execution = table.Column<string>(type: "text", nullable: false),
                    Application = table.Column<string>(type: "text", nullable: false),
                    HeightCm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    HeightOverridden = table.Column<bool>(type: "boolean", nullable: false),
                    LevelId = table.Column<Guid>(type: "uuid", nullable: true),
                    ComplexityId = table.Column<Guid>(type: "uuid", nullable: true),
                    CharacterCount = table.Column<int>(type: "integer", nullable: false),
                    HoursOverride = table.Column<decimal>(type: "numeric", nullable: true),
                    HourlyRateOverride = table.Column<decimal>(type: "numeric", nullable: true),
                    MaterialsAmountOverride = table.Column<decimal>(type: "numeric", nullable: true),
                    PreparationAmountOverride = table.Column<decimal>(type: "numeric", nullable: true),
                    AddOnsAmountOverride = table.Column<decimal>(type: "numeric", nullable: true),
                    MarginPercentageOverride = table.Column<decimal>(type: "numeric", nullable: true),
                    FinalPriceOverride = table.Column<decimal>(type: "numeric", nullable: true),
                    PreparationSelectionsJson = table.Column<string>(type: "text", nullable: false),
                    AddOnSelectionsJson = table.Column<string>(type: "text", nullable: false),
                    ExtraPreparationDescription = table.Column<string>(type: "text", nullable: false),
                    ExtraPreparationAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FreeAddOnDescription = table.Column<string>(type: "text", nullable: false),
                    FreeAddOnQuantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FreeAddOnUnitAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BaseNeedsPainting = table.Column<bool>(type: "boolean", nullable: false),
                    BaseMode = table.Column<string>(type: "text", nullable: false),
                    BaseLevelId = table.Column<Guid>(type: "uuid", nullable: true),
                    BaseHours = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BaseManualAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BaseAddOnId = table.Column<Guid>(type: "uuid", nullable: true),
                    OutsourcedSupplierId = table.Column<Guid>(type: "uuid", nullable: true),
                    OutsourcedChargedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OutsourcedFreightAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OutsourcedOtherCosts = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OutsourcedIncorporatedPrice = table.Column<decimal>(type: "numeric", nullable: true),
                    ManualCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ManualPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ManualIncorporatedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    ColorReferences = table.Column<string>(type: "text", nullable: false),
                    NeedsReview = table.Column<bool>(type: "boolean", nullable: false),
                    CostAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SuggestedPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PriceUsed = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IncorporatedCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IncorporatedPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SnapshotJson = table.Column<string>(type: "text", nullable: false),
                    CalculatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductPaintings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductPaintings_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "public",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductPaintings_ProductId",
                schema: "public",
                table: "ProductPaintings",
                column: "ProductId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductPaintings",
                schema: "public");
        }
    }
}
