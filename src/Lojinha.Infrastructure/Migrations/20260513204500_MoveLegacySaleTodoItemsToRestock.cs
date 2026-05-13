using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    public partial class MoveLegacySaleTodoItemsToRestock : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
WITH todo_with_sale AS (
    SELECT
        t.""Id"" AS ""TodoId"",
        t.""OwnerSupplierId"",
        t.""Source"",
        t.""CreatedAtUtc"",
        t.""UpdatedAtUtc"",
        (regexp_match(t.""Source"", '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'))[1]::uuid AS ""SaleId""
    FROM ""OperationalTodoItems"" t
    WHERE t.""Source"" ILIKE 'Gerado automaticamente da venda %'
),
aggregated AS (
    SELECT
        tws.""TodoId"",
        tws.""OwnerSupplierId"",
        tws.""Source"",
        tws.""CreatedAtUtc"",
        tws.""UpdatedAtUtc"",
        si.""ProductId"",
        ROUND(SUM(si.""Quantity""), 2) AS ""TargetQuantity""
    FROM todo_with_sale tws
    JOIN ""SaleItems"" si ON si.""SaleId"" = tws.""SaleId""
    GROUP BY
        tws.""TodoId"",
        tws.""OwnerSupplierId"",
        tws.""Source"",
        tws.""CreatedAtUtc"",
        tws.""UpdatedAtUtc"",
        si.""ProductId""
),
rows_to_insert AS (
    SELECT
        (
            SUBSTRING(hash, 1, 8) || '-' ||
            SUBSTRING(hash, 9, 4) || '-' ||
            SUBSTRING(hash, 13, 4) || '-' ||
            SUBSTRING(hash, 17, 4) || '-' ||
            SUBSTRING(hash, 21, 12)
        )::uuid AS ""Id"",
        a.""ProductId"",
        a.""OwnerSupplierId"",
        'Medium' AS ""Priority"",
        a.""TargetQuantity"",
        'Open' AS ""Status"",
        a.""Source"" AS ""Notes"",
        a.""CreatedAtUtc"",
        a.""UpdatedAtUtc""
    FROM (
        SELECT
            a.*,
            md5(a.""TodoId""::text || '-' || a.""ProductId""::text) AS hash
        FROM aggregated a
    ) a
)
INSERT INTO ""OperationalRestockItems"" (
    ""Id"", ""ProductId"", ""OwnerSupplierId"", ""Priority"", ""TargetQuantity"", ""Status"", ""Notes"", ""DueDateUtc"", ""CompletedAtUtc"", ""CreatedAtUtc"", ""UpdatedAtUtc""
)
SELECT
    r.""Id"", r.""ProductId"", r.""OwnerSupplierId"", r.""Priority"", r.""TargetQuantity"", r.""Status"", r.""Notes"", NULL, NULL, r.""CreatedAtUtc"", r.""UpdatedAtUtc""
FROM rows_to_insert r
ON CONFLICT (""Id"") DO NOTHING;

DELETE FROM ""OperationalTodoItems"" t
WHERE t.""Source"" ILIKE 'Gerado automaticamente da venda %'
  AND (regexp_match(t.""Source"", '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'))[1] IS NOT NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data migration intentionally not reverted.
        }
    }
}
