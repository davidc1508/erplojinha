using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lojinha.Infrastructure.Migrations
{
    public partial class NormalizeProductNamesFirstLetterUppercase : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE public.""Products""
SET ""Name"" = upper(left(""Name"", 1)) || substring(""Name"" from 2)
WHERE ""Name"" ~ '^[a-z]';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
