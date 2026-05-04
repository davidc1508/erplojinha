using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleItemSupplierSelection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                schema: "public",
                table: "SaleItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_SupplierId",
                schema: "public",
                table: "SaleItems",
                column: "SupplierId");

            migrationBuilder.AddForeignKey(
                name: "FK_SaleItems_Suppliers_SupplierId",
                schema: "public",
                table: "SaleItems",
                column: "SupplierId",
                principalSchema: "public",
                principalTable: "Suppliers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SaleItems_Suppliers_SupplierId",
                schema: "public",
                table: "SaleItems");

            migrationBuilder.DropIndex(
                name: "IX_SaleItems_SupplierId",
                schema: "public",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                schema: "public",
                table: "SaleItems");
        }
    }
}
