using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveTodoItemNotesAndDueDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DueDateUtc",
                schema: "public",
                table: "OperationalTodoItems");

            migrationBuilder.DropColumn(
                name: "Notes",
                schema: "public",
                table: "OperationalTodoItems");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DueDateUtc",
                schema: "public",
                table: "OperationalTodoItems",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                schema: "public",
                table: "OperationalTodoItems",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
