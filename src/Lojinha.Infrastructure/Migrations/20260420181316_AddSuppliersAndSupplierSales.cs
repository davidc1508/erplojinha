using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSuppliersAndSupplierSales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "LojinhaGainAmount",
                schema: "public",
                table: "SaleItems",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "LojinhaGainPercentage",
                schema: "public",
                table: "SaleItems",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                schema: "public",
                table: "Products",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Suppliers",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    ContactName = table.Column<string>(type: "text", nullable: false),
                    PhoneNumber = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FairSuppliers",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FairId = table.Column<Guid>(type: "uuid", nullable: false),
                    SupplierId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FairSuppliers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FairSuppliers_Fairs_FairId",
                        column: x => x.FairId,
                        principalSchema: "public",
                        principalTable: "Fairs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FairSuppliers_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalSchema: "public",
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Products_SupplierId",
                schema: "public",
                table: "Products",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_FairSuppliers_FairId_SupplierId",
                schema: "public",
                table: "FairSuppliers",
                columns: new[] { "FairId", "SupplierId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FairSuppliers_SupplierId",
                schema: "public",
                table: "FairSuppliers",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_Name",
                schema: "public",
                table: "Suppliers",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Suppliers_SupplierId",
                schema: "public",
                table: "Products",
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
                name: "FK_Products_Suppliers_SupplierId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropTable(
                name: "FairSuppliers",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Suppliers",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_Products_SupplierId",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "LojinhaGainAmount",
                schema: "public",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "LojinhaGainPercentage",
                schema: "public",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                schema: "public",
                table: "Products");
        }
    }
}
