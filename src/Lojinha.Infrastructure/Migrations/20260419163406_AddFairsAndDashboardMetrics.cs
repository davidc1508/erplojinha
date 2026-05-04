using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFairsAndDashboardMetrics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FairId",
                schema: "public",
                table: "Sales",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Fairs",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    EventDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: false),
                    RegistrationFee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    FinalizedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Fairs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Sales_FairId",
                schema: "public",
                table: "Sales",
                column: "FairId");

            migrationBuilder.CreateIndex(
                name: "IX_Fairs_Name_EventDateUtc",
                schema: "public",
                table: "Fairs",
                columns: new[] { "Name", "EventDateUtc" });

            migrationBuilder.AddForeignKey(
                name: "FK_Sales_Fairs_FairId",
                schema: "public",
                table: "Sales",
                column: "FairId",
                principalSchema: "public",
                principalTable: "Fairs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Sales_Fairs_FairId",
                schema: "public",
                table: "Sales");

            migrationBuilder.DropTable(
                name: "Fairs",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_Sales_FairId",
                schema: "public",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "FairId",
                schema: "public",
                table: "Sales");
        }
    }
}
