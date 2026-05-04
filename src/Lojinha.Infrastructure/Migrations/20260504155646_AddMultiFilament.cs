using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiFilament : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_FilamentProfiles_FilamentProfileId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Products_FilamentProfileId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "MaterialPlanned",
                schema: "public",
                table: "ProjectSteps");

            migrationBuilder.DropColumn(
                name: "MaterialUsed",
                schema: "public",
                table: "ProjectStepAttempts");


            migrationBuilder.CreateTable(
                name: "ProductFilaments",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    FilamentProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    WeightGrams = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductFilaments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductFilaments_FilamentProfiles_FilamentProfileId",
                        column: x => x.FilamentProfileId,
                        principalSchema: "public",
                        principalTable: "FilamentProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductFilaments_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "public",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectStepAttemptFilaments",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    FilamentProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    WeightGrams = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectStepAttemptFilaments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectStepAttemptFilaments_FilamentProfiles_FilamentProfil~",
                        column: x => x.FilamentProfileId,
                        principalSchema: "public",
                        principalTable: "FilamentProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProjectStepAttemptFilaments_ProjectStepAttempts_AttemptId",
                        column: x => x.AttemptId,
                        principalSchema: "public",
                        principalTable: "ProjectStepAttempts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectStepFilaments",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StepId = table.Column<Guid>(type: "uuid", nullable: false),
                    FilamentProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    WeightGrams = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectStepFilaments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectStepFilaments_FilamentProfiles_FilamentProfileId",
                        column: x => x.FilamentProfileId,
                        principalSchema: "public",
                        principalTable: "FilamentProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProjectStepFilaments_ProjectSteps_StepId",
                        column: x => x.StepId,
                        principalSchema: "public",
                        principalTable: "ProjectSteps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductFilaments_FilamentProfileId",
                schema: "public",
                table: "ProductFilaments",
                column: "FilamentProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductFilaments_ProductId",
                schema: "public",
                table: "ProductFilaments",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectStepAttemptFilaments_AttemptId",
                schema: "public",
                table: "ProjectStepAttemptFilaments",
                column: "AttemptId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectStepAttemptFilaments_FilamentProfileId",
                schema: "public",
                table: "ProjectStepAttemptFilaments",
                column: "FilamentProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectStepFilaments_FilamentProfileId",
                schema: "public",
                table: "ProjectStepFilaments",
                column: "FilamentProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectStepFilaments_StepId",
                schema: "public",
                table: "ProjectStepFilaments",
                column: "StepId");

            migrationBuilder.Sql(@"
                INSERT INTO public.""ProductFilaments"" (""Id"", ""ProductId"", ""FilamentProfileId"", ""WeightGrams"")
                SELECT p.""Id"", p.""Id"", p.""FilamentProfileId"", COALESCE(p.""EstimatedWeightGrams"", 0)
                FROM public.""Products"" p
                WHERE p.""FilamentProfileId"" IS NOT NULL;
            ");

            migrationBuilder.DropColumn(
                name: "FilamentProfileId",
                schema: "public",
                table: "Products");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductFilaments",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ProjectStepAttemptFilaments",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ProjectStepFilaments",
                schema: "public");

            migrationBuilder.AddColumn<string>(
                name: "MaterialPlanned",
                schema: "public",
                table: "ProjectSteps",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MaterialUsed",
                schema: "public",
                table: "ProjectStepAttempts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "FilamentProfileId",
                schema: "public",
                table: "Products",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_FilamentProfileId",
                schema: "public",
                table: "Products",
                column: "FilamentProfileId");

            migrationBuilder.AddForeignKey(
                name: "FK_Products_FilamentProfiles_FilamentProfileId",
                schema: "public",
                table: "Products",
                column: "FilamentProfileId",
                principalSchema: "public",
                principalTable: "FilamentProfiles",
                principalColumn: "Id");
        }
    }
}
