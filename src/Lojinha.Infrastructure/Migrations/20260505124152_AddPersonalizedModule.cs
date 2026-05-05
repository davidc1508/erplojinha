using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPersonalizedModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPersonalized",
                schema: "public",
                table: "Projects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "PersonalizedGeneratedProductId",
                schema: "public",
                table: "Projects",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PersonalizedIsPainted",
                schema: "public",
                table: "Projects",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PersonalizedQuotedPriceBRL",
                schema: "public",
                table: "Projects",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PersonalizedSaleId",
                schema: "public",
                table: "Projects",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PersonalizedSizeCm",
                schema: "public",
                table: "Projects",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LifecycleStatus",
                schema: "public",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "Disponivel");

            migrationBuilder.Sql("UPDATE public.\"Products\" SET \"LifecycleStatus\" = 'Disponivel' WHERE \"LifecycleStatus\" = '' OR \"LifecycleStatus\" IS NULL;");

            migrationBuilder.CreateTable(
                name: "PersonalizedPricingTiers",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    MinSizeCm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MaxSizeCm = table.Column<decimal>(type: "numeric", nullable: true),
                    FinishedPriceBRL = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnpaintedPriceBRL = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PersonalizedPricingTiers", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PersonalizedPricingTiers_Order",
                schema: "public",
                table: "PersonalizedPricingTiers",
                column: "Order",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PersonalizedPricingTiers",
                schema: "public");

            migrationBuilder.DropColumn(
                name: "IsPersonalized",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "PersonalizedGeneratedProductId",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "PersonalizedIsPainted",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "PersonalizedQuotedPriceBRL",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "PersonalizedSaleId",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "PersonalizedSizeCm",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "LifecycleStatus",
                schema: "public",
                table: "Products");
        }
    }
}
