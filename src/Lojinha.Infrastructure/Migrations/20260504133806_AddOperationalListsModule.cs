using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOperationalListsModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OperationalRestockItems",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerSupplierId = table.Column<Guid>(type: "uuid", nullable: true),
                    Priority = table.Column<string>(type: "text", nullable: false),
                    TargetQuantity = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    DueDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationalRestockItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationalRestockItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "public",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OperationalRestockItems_Suppliers_OwnerSupplierId",
                        column: x => x.OwnerSupplierId,
                        principalSchema: "public",
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "OperationalTodoItems",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    OwnerSupplierId = table.Column<Guid>(type: "uuid", nullable: true),
                    Priority = table.Column<string>(type: "text", nullable: false),
                    Source = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    DueDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationalTodoItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperationalTodoItems_Suppliers_OwnerSupplierId",
                        column: x => x.OwnerSupplierId,
                        principalSchema: "public",
                        principalTable: "Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OperationalRestockItems_OwnerSupplierId_Status_Priority",
                schema: "public",
                table: "OperationalRestockItems",
                columns: new[] { "OwnerSupplierId", "Status", "Priority" });

            migrationBuilder.CreateIndex(
                name: "IX_OperationalRestockItems_ProductId",
                schema: "public",
                table: "OperationalRestockItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OperationalTodoItems_OwnerSupplierId_Status_Priority",
                schema: "public",
                table: "OperationalTodoItems",
                columns: new[] { "OwnerSupplierId", "Status", "Priority" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OperationalRestockItems",
                schema: "public");

            migrationBuilder.DropTable(
                name: "OperationalTodoItems",
                schema: "public");
        }
    }
}
