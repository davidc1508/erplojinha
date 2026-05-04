using Lojinha.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260421235900_ReclassifyFairSupplierPayablesAndPayments")]
public partial class ReclassifyFairSupplierPayablesAndPayments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE "FinancialEntries" AS supplier_entry
            SET "Category" = 'Pagamento de cota de feira'
            WHERE supplier_entry."SupplierId" IS NOT NULL
              AND supplier_entry."Type" = 'Expense'
              AND supplier_entry."Category" = 'Pendencia de pagamento em feiras'
              AND EXISTS (
                    SELECT 1
                    FROM "FinancialEntries" AS store_entry
                    WHERE store_entry."SupplierId" IS NULL
                      AND store_entry."Type" = 'Income'
                      AND store_entry."Category" = 'Recebimento de fornecedores em feiras'
                      AND store_entry."Amount" = supplier_entry."Amount"
                      AND store_entry."OccurredOnUtc" = supplier_entry."OccurredOnUtc"
                      AND store_entry."Description" LIKE '%' || supplier_entry."Description"
                );
            """);

        migrationBuilder.Sql(
            """
            UPDATE "FinancialEntries"
            SET "Category" = 'Contas a pagar de feiras'
            WHERE "SupplierId" IS NOT NULL
              AND "Type" = 'Expense'
              AND "Category" = 'Pendencia de pagamento em feiras';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE "FinancialEntries"
            SET "Category" = 'Pendencia de pagamento em feiras'
            WHERE "SupplierId" IS NOT NULL
              AND "Type" = 'Expense'
              AND "Category" IN ('Contas a pagar de feiras', 'Pagamento de cota de feira');
            """);
    }
}
