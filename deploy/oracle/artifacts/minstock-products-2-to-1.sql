SELECT COUNT(*) AS produtos_com_minimo_2_antes FROM "Products" WHERE "MinimumStock" = 2;

UPDATE "Products"
SET "MinimumStock" = 1,
    "UpdatedAtUtc" = NOW()
WHERE "MinimumStock" = 2;

SELECT COUNT(*) AS produtos_com_minimo_2_depois FROM "Products" WHERE "MinimumStock" = 2;
SELECT COUNT(*) AS produtos_com_minimo_1_total FROM "Products" WHERE "MinimumStock" = 1;
