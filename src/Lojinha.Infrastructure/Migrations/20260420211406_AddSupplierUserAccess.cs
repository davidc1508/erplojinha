using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierUserAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                schema: "public",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_SupplierId",
                schema: "public",
                table: "Users",
                column: "SupplierId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Suppliers_SupplierId",
                schema: "public",
                table: "Users",
                column: "SupplierId",
                principalSchema: "public",
                principalTable: "Suppliers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Suppliers_SupplierId",
                schema: "public",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_SupplierId",
                schema: "public",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                schema: "public",
                table: "Users");
        }
    }
}
