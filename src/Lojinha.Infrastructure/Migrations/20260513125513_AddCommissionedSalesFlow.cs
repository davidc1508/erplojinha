using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCommissionedSalesFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CommissionAmount",
                schema: "public",
                table: "SaleItems",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "CommissionSellerSupplierId",
                schema: "public",
                table: "SaleItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCommissionedSale",
                schema: "public",
                table: "SaleItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "CommissionedSalePrice",
                schema: "public",
                table: "Products",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_SaleItems_CommissionSellerSupplierId",
                schema: "public",
                table: "SaleItems",
                column: "CommissionSellerSupplierId");

            migrationBuilder.Sql(@"
UPDATE ""public"".""Products""
SET ""CommissionPercentage"" = 20,
    ""CommissionedSalePrice"" = CASE
        WHEN ""SalePrice"" > 0 THEN ROUND((""SalePrice"" / 0.8)::numeric, 2)
        ELSE 0
    END;
");

            migrationBuilder.AddForeignKey(
                name: "FK_SaleItems_Suppliers_CommissionSellerSupplierId",
                schema: "public",
                table: "SaleItems",
                column: "CommissionSellerSupplierId",
                principalSchema: "public",
                principalTable: "Suppliers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SaleItems_Suppliers_CommissionSellerSupplierId",
                schema: "public",
                table: "SaleItems");

            migrationBuilder.DropIndex(
                name: "IX_SaleItems_CommissionSellerSupplierId",
                schema: "public",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "CommissionAmount",
                schema: "public",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "CommissionSellerSupplierId",
                schema: "public",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "IsCommissionedSale",
                schema: "public",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "CommissionedSalePrice",
                schema: "public",
                table: "Products");
        }
    }
}
