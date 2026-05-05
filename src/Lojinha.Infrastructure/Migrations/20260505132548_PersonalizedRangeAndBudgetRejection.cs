using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PersonalizedRangeAndBudgetRejection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PersonalizedSizeMaxCm",
                schema: "public",
                table: "Projects",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PersonalizedSizeMinCm",
                schema: "public",
                table: "Projects",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PersonalizedSizeMaxCm",
                schema: "public",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "PersonalizedSizeMinCm",
                schema: "public",
                table: "Projects");
        }
    }
}
