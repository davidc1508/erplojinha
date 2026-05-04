using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierScopeToFinancialEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                schema: "public",
                table: "FinancialEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FinancialEntries_SupplierId",
                schema: "public",
                table: "FinancialEntries",
                column: "SupplierId");

            migrationBuilder.AddForeignKey(
                name: "FK_FinancialEntries_Suppliers_SupplierId",
                schema: "public",
                table: "FinancialEntries",
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
                name: "FK_FinancialEntries_Suppliers_SupplierId",
                schema: "public",
                table: "FinancialEntries");

            migrationBuilder.DropIndex(
                name: "IX_FinancialEntries_SupplierId",
                schema: "public",
                table: "FinancialEntries");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                schema: "public",
                table: "FinancialEntries");
        }
    }
}
