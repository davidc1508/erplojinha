using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPaintingPricingModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PaintingAddOns",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    ChargeType = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Percentage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AdditionalHours = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaintingAddOns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaintingComplexities",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Multiplier = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaintingComplexities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaintingLevels",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    HourlyRate = table.Column<decimal>(type: "numeric", nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaintingLevels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaintingMaterials",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Unit = table.Column<string>(type: "text", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DefaultQuantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaintingMaterials", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaintingPreparationServices",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    ChargeType = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedHours = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaintingPreparationServices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaintingSettings",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DefaultHourlyRate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DefaultMaterialsPercentage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MinimumMaterialsAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MinimumPaintingPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DefaultMarginPercentage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Rounding = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaintingSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaintingSizeRanges",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    MinHeightCm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MaxHeightCm = table.Column<decimal>(type: "numeric", nullable: true),
                    RequiresManualReview = table.Column<bool>(type: "boolean", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaintingSizeRanges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PaintingSizeRangeHours",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SizeRangeId = table.Column<Guid>(type: "uuid", nullable: false),
                    LevelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Hours = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaintingSizeRangeHours", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PaintingSizeRangeHours_PaintingLevels_LevelId",
                        column: x => x.LevelId,
                        principalSchema: "public",
                        principalTable: "PaintingLevels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PaintingSizeRangeHours_PaintingSizeRanges_SizeRangeId",
                        column: x => x.SizeRangeId,
                        principalSchema: "public",
                        principalTable: "PaintingSizeRanges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaintingAddOns_Name",
                schema: "public",
                table: "PaintingAddOns",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaintingComplexities_Name",
                schema: "public",
                table: "PaintingComplexities",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaintingLevels_Name",
                schema: "public",
                table: "PaintingLevels",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaintingMaterials_Name",
                schema: "public",
                table: "PaintingMaterials",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaintingPreparationServices_Name",
                schema: "public",
                table: "PaintingPreparationServices",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaintingSizeRangeHours_LevelId",
                schema: "public",
                table: "PaintingSizeRangeHours",
                column: "LevelId");

            migrationBuilder.CreateIndex(
                name: "IX_PaintingSizeRangeHours_SizeRangeId_LevelId",
                schema: "public",
                table: "PaintingSizeRangeHours",
                columns: new[] { "SizeRangeId", "LevelId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaintingSizeRanges_Name",
                schema: "public",
                table: "PaintingSizeRanges",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaintingAddOns",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PaintingComplexities",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PaintingMaterials",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PaintingPreparationServices",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PaintingSettings",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PaintingSizeRangeHours",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PaintingLevels",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PaintingSizeRanges",
                schema: "public");
        }
    }
}
