using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectsPhase2Module : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FileReference",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "Material",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "Priority",
                schema: "public",
                table: "Projects");

            migrationBuilder.RenameColumn(
                name: "CompletedAtUtc",
                schema: "public",
                table: "Projects",
                newName: "StartedAtUtc");

            migrationBuilder.AddColumn<DateTime>(
                name: "ConcludedAtUtc",
                schema: "public",
                table: "Projects",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProductId",
                schema: "public",
                table: "Projects",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProgressPercentage",
                schema: "public",
                table: "Projects",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TimeCompletedMinutes",
                schema: "public",
                table: "Projects",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TimeEstimatedMinutes",
                schema: "public",
                table: "Projects",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TimeLostToFailuresMinutes",
                schema: "public",
                table: "Projects",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "WeightCompletedGrams",
                schema: "public",
                table: "Projects",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "WeightEstimatedGrams",
                schema: "public",
                table: "Projects",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "WeightLostToFailuresGrams",
                schema: "public",
                table: "Projects",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "ProjectSteps",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    TimeEstimatedMinutes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WeightEstimatedGrams = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PrinterPlanned = table.Column<string>(type: "text", nullable: true),
                    MaterialPlanned = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectSteps_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "public",
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectStepAttempts",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StepId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptNumber = table.Column<int>(type: "integer", nullable: false),
                    PrinterUsed = table.Column<string>(type: "text", nullable: false),
                    MaterialUsed = table.Column<string>(type: "text", nullable: false),
                    TimeRealMinutes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WeightRealGrams = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    TimeLostMinutes = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WeightLostGrams = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FailureReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectStepAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectStepAttempts_ProjectSteps_StepId",
                        column: x => x.StepId,
                        principalSchema: "public",
                        principalTable: "ProjectSteps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectStepAttempts_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "public",
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Projects_ProductId",
                schema: "public",
                table: "Projects",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectStepAttempts_ProjectId",
                schema: "public",
                table: "ProjectStepAttempts",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectStepAttempts_StepId",
                schema: "public",
                table: "ProjectStepAttempts",
                column: "StepId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectSteps_ProjectId",
                schema: "public",
                table: "ProjectSteps",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Products_ProductId",
                schema: "public",
                table: "Projects",
                column: "ProductId",
                principalSchema: "public",
                principalTable: "Products",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Products_ProductId",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropTable(
                name: "ProjectStepAttempts",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ProjectSteps",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_Projects_ProductId",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ConcludedAtUtc",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ProductId",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ProgressPercentage",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "TimeCompletedMinutes",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "TimeEstimatedMinutes",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "TimeLostToFailuresMinutes",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "WeightCompletedGrams",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "WeightEstimatedGrams",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "WeightLostToFailuresGrams",
                schema: "public",
                table: "Projects");

            migrationBuilder.RenameColumn(
                name: "StartedAtUtc",
                schema: "public",
                table: "Projects",
                newName: "CompletedAtUtc");

            migrationBuilder.AddColumn<string>(
                name: "FileReference",
                schema: "public",
                table: "Projects",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Material",
                schema: "public",
                table: "Projects",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "public",
                table: "Projects",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                schema: "public",
                table: "Projects",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
