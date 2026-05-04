using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFairDurationAndAwaitingStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Fairs_Name_EventDateUtc",
                schema: "public",
                table: "Fairs");

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDateUtc",
                schema: "public",
                table: "Fairs",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateIndex(
                name: "IX_Fairs_Name_EventDateUtc_EndDateUtc",
                schema: "public",
                table: "Fairs",
                columns: new[] { "Name", "EventDateUtc", "EndDateUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Fairs_Name_EventDateUtc_EndDateUtc",
                schema: "public",
                table: "Fairs");

            migrationBuilder.DropColumn(
                name: "EndDateUtc",
                schema: "public",
                table: "Fairs");

            migrationBuilder.CreateIndex(
                name: "IX_Fairs_Name_EventDateUtc",
                schema: "public",
                table: "Fairs",
                columns: new[] { "Name", "EventDateUtc" });
        }
    }
}
