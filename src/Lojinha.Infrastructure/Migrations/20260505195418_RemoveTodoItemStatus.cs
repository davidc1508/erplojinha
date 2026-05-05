using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveTodoItemStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OperationalTodoItems_OwnerSupplierId_Status_Priority",
                schema: "public",
                table: "OperationalTodoItems");

            migrationBuilder.DropColumn(
                name: "CompletedAtUtc",
                schema: "public",
                table: "OperationalTodoItems");

            migrationBuilder.DropColumn(
                name: "Status",
                schema: "public",
                table: "OperationalTodoItems");

            migrationBuilder.CreateIndex(
                name: "IX_OperationalTodoItems_OwnerSupplierId_Priority",
                schema: "public",
                table: "OperationalTodoItems",
                columns: new[] { "OwnerSupplierId", "Priority" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OperationalTodoItems_OwnerSupplierId_Priority",
                schema: "public",
                table: "OperationalTodoItems");

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAtUtc",
                schema: "public",
                table: "OperationalTodoItems",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                schema: "public",
                table: "OperationalTodoItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_OperationalTodoItems_OwnerSupplierId_Status_Priority",
                schema: "public",
                table: "OperationalTodoItems",
                columns: new[] { "OwnerSupplierId", "Status", "Priority" });
        }
    }
}
