using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNumericCategoryAndProductIdentifiers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "NumericIdentifier",
                schema: "public",
                table: "Products",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "NumericIdentifier",
                schema: "public",
                table: "Categories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(
                """
                WITH ordered_categories AS (
                    SELECT "Id", ROW_NUMBER() OVER (ORDER BY "Name", "Id") AS numeric_identifier
                    FROM public."Categories"
                )
                UPDATE public."Categories" AS category
                SET "NumericIdentifier" = ordered_categories.numeric_identifier
                FROM ordered_categories
                WHERE category."Id" = ordered_categories."Id";
                """);

            migrationBuilder.Sql(
                """
                WITH ordered_products AS (
                    SELECT "Id", ROW_NUMBER() OVER (ORDER BY "Name", "Id") AS numeric_identifier
                    FROM public."Products"
                )
                UPDATE public."Products" AS product
                SET "NumericIdentifier" = ordered_products.numeric_identifier
                FROM ordered_products
                WHERE product."Id" = ordered_products."Id";
                """);

            migrationBuilder.Sql(
                """
                UPDATE public."Products" AS product
                SET "Sku" = LPAD(category."NumericIdentifier"::text, 5, '0') || '-' || LPAD(product."NumericIdentifier"::text, 8, '0')
                FROM public."Categories" AS category
                WHERE product."CategoryId" = category."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Products_NumericIdentifier",
                schema: "public",
                table: "Products",
                column: "NumericIdentifier",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Categories_NumericIdentifier",
                schema: "public",
                table: "Categories",
                column: "NumericIdentifier",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Products_NumericIdentifier",
                schema: "public",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Categories_NumericIdentifier",
                schema: "public",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "NumericIdentifier",
                schema: "public",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "NumericIdentifier",
                schema: "public",
                table: "Categories");
        }
    }
}
