using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFairRegistrationFeeSplitCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RegistrationFeeSplitCount",
                schema: "public",
                table: "Fairs",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RegistrationFeeSplitCount",
                schema: "public",
                table: "Fairs");
        }
    }
}
