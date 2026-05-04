CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;
CREATE TABLE public."AuditLogs" (
    "Id" uuid NOT NULL,
    "EntityName" text NOT NULL,
    "EntityId" text NOT NULL,
    "Action" text NOT NULL,
    "ChangedBy" text NOT NULL,
    "PayloadJson" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_AuditLogs" PRIMARY KEY ("Id")
);

CREATE TABLE public."Categories" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Description" text NOT NULL,
    "ColorHex" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Categories" PRIMARY KEY ("Id")
);

CREATE TABLE public."FilamentProfiles" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Brand" text NOT NULL,
    "Description" text NOT NULL,
    "SpoolWeightKg" numeric(18,2) NOT NULL,
    "SpoolLengthMeters" numeric(18,2) NOT NULL,
    "CostBRL" numeric(18,2) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_FilamentProfiles" PRIMARY KEY ("Id")
);

CREATE TABLE public."FinancialEntries" (
    "Id" uuid NOT NULL,
    "Type" text NOT NULL,
    "Classification" text NOT NULL,
    "Category" text NOT NULL,
    "Description" text NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "OccurredOnUtc" timestamp with time zone NOT NULL,
    "ReferenceId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_FinancialEntries" PRIMARY KEY ("Id")
);

CREATE TABLE public."InventoryMovements" (
    "Id" uuid NOT NULL,
    "ItemType" text NOT NULL,
    "ItemId" uuid NOT NULL,
    "Type" text NOT NULL,
    "Quantity" numeric(18,2) NOT NULL,
    "UnitCost" numeric(18,2) NOT NULL,
    "Notes" text NOT NULL,
    "ReferenceId" uuid,
    "OccurredAtUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_InventoryMovements" PRIMARY KEY ("Id")
);

CREATE TABLE public."MarketplaceFees" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "FixedFee" numeric(18,2) NOT NULL,
    "PercentageFee" numeric(18,2) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_MarketplaceFees" PRIMARY KEY ("Id")
);

CREATE TABLE public."PrinterProfiles" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Brand" text NOT NULL,
    "ReturnMonths" numeric(18,2) NOT NULL,
    "MachineCost" numeric(18,2) NOT NULL,
    "WorkHoursPerDay" numeric(18,2) NOT NULL,
    "WorkingDaysPerMonth" numeric(18,2) NOT NULL,
    "PowerKw" numeric(18,2) NOT NULL,
    "UsageLevel" text NOT NULL,
    "FailureRate" numeric(18,2) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_PrinterProfiles" PRIMARY KEY ("Id")
);

CREATE TABLE public."Sales" (
    "Id" uuid NOT NULL,
    "SoldAtUtc" timestamp with time zone NOT NULL,
    "PaymentMethod" text NOT NULL,
    "TotalAmount" numeric(18,2) NOT NULL,
    "CostAmount" numeric(18,2) NOT NULL,
    "ProfitAmount" numeric(18,2) NOT NULL,
    "Status" text NOT NULL,
    "Notes" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Sales" PRIMARY KEY ("Id")
);

CREATE TABLE public."Supplies" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Unit" text NOT NULL,
    "CostPerUnit" numeric(18,2) NOT NULL,
    "StockQuantity" numeric(18,2) NOT NULL,
    "MinimumStock" numeric(18,2) NOT NULL,
    "Notes" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Supplies" PRIMARY KEY ("Id")
);

CREATE TABLE public."Users" (
    "Id" uuid NOT NULL,
    "Email" text NOT NULL,
    "FullName" text NOT NULL,
    "PasswordHash" text NOT NULL,
    "Role" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Users" PRIMARY KEY ("Id")
);

CREATE TABLE public."Products" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Sku" text NOT NULL,
    "Description" text NOT NULL,
    "CategoryId" uuid NOT NULL,
    "CostPrice" numeric(18,2) NOT NULL,
    "SalePrice" numeric(18,2) NOT NULL,
    "SuggestedPrice" numeric(18,2) NOT NULL,
    "ProfitMargin" numeric(18,2) NOT NULL,
    "CurrentStock" numeric(18,2) NOT NULL,
    "MinimumStock" numeric(18,2) NOT NULL,
    "EstimatedPrintTimeMinutes" numeric(18,2) NOT NULL,
    "EstimatedWeightGrams" numeric(18,2) NOT NULL,
    "LengthMetersUsed" numeric(18,2) NOT NULL,
    "TariffPerKwh" numeric(18,2) NOT NULL,
    "PrinterProfileId" uuid,
    "FilamentProfileId" uuid,
    "DefaultMarketplaceFeeId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Products" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Products_Categories_CategoryId" FOREIGN KEY ("CategoryId") REFERENCES public."Categories" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Products_FilamentProfiles_FilamentProfileId" FOREIGN KEY ("FilamentProfileId") REFERENCES public."FilamentProfiles" ("Id"),
    CONSTRAINT "FK_Products_MarketplaceFees_DefaultMarketplaceFeeId" FOREIGN KEY ("DefaultMarketplaceFeeId") REFERENCES public."MarketplaceFees" ("Id"),
    CONSTRAINT "FK_Products_PrinterProfiles_PrinterProfileId" FOREIGN KEY ("PrinterProfileId") REFERENCES public."PrinterProfiles" ("Id")
);

CREATE TABLE public."ProductRecipes" (
    "Id" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "LaborHours" numeric(18,2) NOT NULL,
    "LaborCostPerHour" numeric(18,2) NOT NULL,
    "AdditionalCosts" numeric(18,2) NOT NULL,
    "WholesaleMarkup" numeric(18,2) NOT NULL,
    "RetailMarkup" numeric(18,2) NOT NULL,
    "ResellerMarkup" numeric(18,2) NOT NULL,
    "TotalCost" numeric(18,2) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_ProductRecipes" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductRecipes_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES public."Products" ("Id") ON DELETE CASCADE
);

CREATE TABLE public."SaleItems" (
    "Id" uuid NOT NULL,
    "SaleId" uuid NOT NULL,
    "ProductId" uuid NOT NULL,
    "Quantity" numeric(18,2) NOT NULL,
    "UnitPrice" numeric(18,2) NOT NULL,
    "CostPrice" numeric(18,2) NOT NULL,
    "TotalPrice" numeric(18,2) NOT NULL,
    CONSTRAINT "PK_SaleItems" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SaleItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES public."Products" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_SaleItems_Sales_SaleId" FOREIGN KEY ("SaleId") REFERENCES public."Sales" ("Id") ON DELETE CASCADE
);

CREATE TABLE public."ProductRecipeItems" (
    "Id" uuid NOT NULL,
    "ProductRecipeId" uuid NOT NULL,
    "SupplyId" uuid NOT NULL,
    "Quantity" numeric(18,2) NOT NULL,
    CONSTRAINT "PK_ProductRecipeItems" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ProductRecipeItems_ProductRecipes_ProductRecipeId" FOREIGN KEY ("ProductRecipeId") REFERENCES public."ProductRecipes" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ProductRecipeItems_Supplies_SupplyId" FOREIGN KEY ("SupplyId") REFERENCES public."Supplies" ("Id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "IX_Categories_Name" ON public."Categories" ("Name");

CREATE UNIQUE INDEX "IX_FilamentProfiles_Name" ON public."FilamentProfiles" ("Name");

CREATE UNIQUE INDEX "IX_MarketplaceFees_Name" ON public."MarketplaceFees" ("Name");

CREATE UNIQUE INDEX "IX_PrinterProfiles_Name" ON public."PrinterProfiles" ("Name");

CREATE INDEX "IX_ProductRecipeItems_ProductRecipeId" ON public."ProductRecipeItems" ("ProductRecipeId");

CREATE INDEX "IX_ProductRecipeItems_SupplyId" ON public."ProductRecipeItems" ("SupplyId");

CREATE UNIQUE INDEX "IX_ProductRecipes_ProductId" ON public."ProductRecipes" ("ProductId");

CREATE INDEX "IX_Products_CategoryId" ON public."Products" ("CategoryId");

CREATE INDEX "IX_Products_DefaultMarketplaceFeeId" ON public."Products" ("DefaultMarketplaceFeeId");

CREATE INDEX "IX_Products_FilamentProfileId" ON public."Products" ("FilamentProfileId");

CREATE INDEX "IX_Products_PrinterProfileId" ON public."Products" ("PrinterProfileId");

CREATE UNIQUE INDEX "IX_Products_Sku" ON public."Products" ("Sku");

CREATE INDEX "IX_SaleItems_ProductId" ON public."SaleItems" ("ProductId");

CREATE INDEX "IX_SaleItems_SaleId" ON public."SaleItems" ("SaleId");

CREATE UNIQUE INDEX "IX_Supplies_Name" ON public."Supplies" ("Name");

CREATE UNIQUE INDEX "IX_Users_Email" ON public."Users" ("Email");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260419161343_InitialCreate', '10.0.4');

COMMIT;

