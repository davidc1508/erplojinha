export type PaymentMethod = 'Pix' | 'CreditCard' | 'DebitCard' | 'Cash' | 'Transfer';
export type OutsourcedProductionStatus = 'Pendente' | 'ConvertidoEmProduto' | 'Cancelado';
export type FinancialEntryType = 'Income' | 'Expense';
export type FinancialClassification = 'Fixed' | 'Variable';
export type InventoryItemType = 'Product' | 'Supply';
export type InventoryMovementType = 'Entry' | 'Exit' | 'Sale' | 'Adjustment';
export type FairStatus = 'Awaiting' | 'Open' | 'Finalized' | 'Cancelled';
export type ProductLifecycleStatus = 'Disponivel' | 'EmProducao' | 'Orcamento';
export type ProductType = 'Impressao3D' | 'Brinco' | 'Botton';
export type OperationalItemPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type RestockTaskStatus = 'Open' | 'InProgress' | 'Completed' | 'Cancelled';

export interface AuthResponse {
  token: string;
  email: string;
  fullName: string;
  role: string;
  supplierId?: string;
  isImpersonating?: boolean;
  impersonatorUserId?: string;
  impersonatorEmail?: string;
  expiresAtUtc: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  supplierId?: string;
  supplierName?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CatalogItem {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phoneNumber: string;
  notes: string;
}

export interface ProductCategory {
  id: string;
  numericIdentifier: number;
  name: string;
  description: string;
  colorHex: string;
}

export interface PrinterProfile {
  id: string;
  name: string;
  brand: string;
  returnMonths: number;
  machineCost: number;
  workHoursPerDay: number;
  workingDaysPerMonth: number;
  powerKw: number;
  usageLevel: string;
  failureRate: number;
}

export interface ProductFilamentItem {
  filamentProfileId: string;
  filamentName: string;
  weightGrams: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  category: string;
  supplierId?: string;
  supplier?: string;
  generateProductionExpenseOnStockEntry: boolean;
  costPrice: number;
  salePrice: number;
  suggestedPrice: number;
  desiredMarkup: number;
  profitMargin: number;
  currentStock: number;
  itemsPerPlate: number;
  estimatedPrintTimeMinutes: number;
  heightCentimeters: number;
  estimatedWeightGrams: number;
  lengthMetersUsed: number;
  tariffPerKwh: number;
  finishingPercentage: number;
  commissionPercentage: number;
  commissionedSalePrice: number;
  additionalCost: number;
  printerProfileId?: string;
  filaments: ProductFilamentItem[];
  printer?: string;
  marketplaceFeeId?: string;
  marketplace?: string;
  lifecycleStatus: ProductLifecycleStatus;
  outsourcedProductionId?: string;
  producerSupplierId?: string;
  producerSupplier?: string;
  productionFeeAmount?: number;
  productType: ProductType;
  pingenteSupplyId?: string;
  pingenteSupply?: string;
  pingenteCost: number;
  bottonSizeId?: string;
  bottonSize?: string;
  bottonSizeQuantity: number;
  bottonSizeStockQuantity: number;
  bottonSizeCostPerUnit: number;
  laborCost: number;
  painting?: ProductPainting | null;
}

export interface OutsourcedProductionFilamentItem {
  filamentProfileId: string;
  filamentName: string;
  weightGrams: number;
}

export interface OutsourcedProduction {
  id: string;
  name: string;
  description: string;
  categoryId?: string;
  category?: string;
  producerSupplierId?: string | null;
  producerSupplier: string;
  ownerSupplierId: string;
  ownerSupplier: string;
  itemsPerPlate: number;
  estimatedPrintTimeMinutes: number;
  heightCentimeters: number;
  estimatedWeightGrams: number;
  lengthMetersUsed: number;
  tariffPerKwh: number;
  finishingPercentage: number;
  additionalCost: number;
  printerProfileId?: string;
  printer?: string;
  filaments: OutsourcedProductionFilamentItem[];
  marketplaceFeeId?: string;
  marketplace?: string;
  desiredMarkup: number;
  productionFeePercentage: number;
  productionCost: number;
  supplierCost: number;
  status: OutsourcedProductionStatus;
  convertedProductId?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ProductMetadata {
  categories: CatalogItem[];
  suppliers: CatalogItem[];
  printers: CatalogItem[];
  filaments: CatalogItem[];
  marketplaces: CatalogItem[];
  supplies: CatalogItem[];
  bottonSizes: CatalogItem[];
}

export interface BottonSize {
  id: string;
  name: string;
  costPerUnit: number;
  stockQuantity: number;
  minimumStock: number;
  notes: string;
}

export interface ProductPricing {
  compositionCost: number;
  totalCost: number;
  materialCost: number;
  energyCost: number;
  maintenanceCost: number;
  failureCost: number;
  finishingCost: number;
  laborCost: number;
  additionalCosts: number;
  wholesalePrice: number;
  retailPrice: number;
  resellerPrice: number;
  desiredMarkup: number;
  suggestedPrice: number;
  commissionPercentage: number;
  commissionAmount: number;
  suggestedPriceWithCommission: number;
  finalPriceWithoutCommission: number;
  finalPriceWithCommission: number;
  marketplaceAdjustedPrice: number;
  estimatedMargin: number;
  paintingCost: number;
  paintingPrice: number;
}

export interface ProductPriceHistoryEntry {
  changedAtUtc: string;
  changedBy: string;
  action: string;
  costPrice?: number;
  salePrice?: number;
  currentStock?: number;
}

export interface Supply {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  stockQuantity: number;
  minimumStock: number;
  notes: string;
}

export interface SaleLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  totalPrice: number;
  supplierId?: string;
  supplierName?: string;
  lojinhaGainPercentage: number;
  lojinhaGainAmount: number;
  isCommissionedSale: boolean;
  commissionSellerSupplierId?: string;
  commissionSellerSupplierName?: string;
  commissionAmount: number;
}

export interface Sale {
  id: string;
  soldAtUtc: string;
  paymentMethod: PaymentMethod;
  fairName?: string;
  totalAmount: number;
  feeAmount: number;
  netReceivedAmount: number;
  costAmount: number;
  profitAmount: number;
  status: string;
  notes: string;
  items: SaleLine[];
  canDelete: boolean;
}

export interface CardFeeSettings {
  creditCardPercentage: number;
  debitCardPercentage: number;
  additionalPercentage: number;
  additionalFixedAmount: number;
  creditCardEffectivePercentage: number;
  debitCardEffectivePercentage: number;
}

export interface CardFeeReprocessResult {
  updatedSalesCount: number;
}

export interface FinancialEntry {
  id: string;
  type: FinancialEntryType;
  classification: FinancialClassification;
  category: string;
  description: string;
  amount: number;
  occurredOnUtc: string;
  supplierId?: string;
  supplierName?: string;
  referenceId?: string;
}

export interface MonthlySeriesPoint {
  label: string;
  value: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
}

export interface FinanceReport {
  revenue: number;
  expenses: number;
  profit: number;
  monthlySeries: MonthlySeriesPoint[];
  categories: CategoryBreakdown[];
}

export interface TopProduct {
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface DashboardSummary {
  monthlyRevenue: number;
  realizedProfit: number;
  totalExpenses: number;
  monthlyPiggyBankAmount: number;
  averageTicket: number;
  totalSalesCount: number;
  openFairsCount: number;
  topProducts: TopProduct[];
  topProfitProducts: { productName: string; profit: number }[];
  recentFairs: { fairName: string; eventDateUtc: string; status: FairStatus; grossRevenue: number; netRevenue: number; registrationFee: number; piggyBankAmount: number }[];
  periodMetrics: { label: string; days: number; itemsSold: number; grossRevenue: number; netRevenue: number; piggyBankAmount: number }[];
  revenueSeries: MonthlySeriesPoint[];
  revenueByPayment: CategoryBreakdown[];
}

export interface InventoryMovement {
  id: string;
  itemType: InventoryItemType;
  itemId: string;
  supplierId?: string;
  itemName: string;
  type: InventoryMovementType;
  quantity: number;
  unitCost: number;
  notes: string;
  occurredAtUtc: string;
}

export interface Fair {
  id: string;
  name: string;
  eventDateUtc: string;
  endDateUtc: string;
  location: string;
  registrationFee: number;
  registrationFeeSplitCount: number;
  storeFeePercentage: number;
  suppliers: { supplierId: string; supplierName: string }[];
  storeRegistrationFee: number;
  supplierRegistrationFee: number;
  notes: string;
  status: FairStatus;
  finalizedAtUtc?: string;
  totalSales: number;
  grossRevenue: number;
  netRevenue: number;
  piggyBankAmount: number;
  totalExpenses: number;
}

export interface FairExpense {
  id: string;
  description: string;
  amount: number;
  occurredOnUtc: string;
  kind: string;
}

export interface FairReportSeries {
  label: string;
  grossRevenue: number;
  netRevenue: number;
  itemsSold: number;
}

export interface FairReport {
  fairId: string;
  fairName: string;
  status: FairStatus;
  eventDateUtc: string;
  endDateUtc: string;
  location: string;
  registrationFee: number;
  registrationFeeSplitCount: number;
  storeFeePercentage: number;
  suppliers: { supplierId: string; supplierName: string }[];
  storeRegistrationFee: number;
  supplierRegistrationFee: number;
  grossRevenue: number;
  netRevenue: number;
  piggyBankAmount: number;
  result: number;
  totalItemsSold: number;
  supplierQuotaStatus: {
    supplierId: string;
    supplierName: string;
    quotaAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    isSettled: boolean;
  }[];
  topProducts: TopProduct[];
  sales: Sale[];
  series: FairReportSeries[];
  totalExpenses: number;
  expenses: FairExpense[];
}

export interface OperationalRestockItem {
  id: string;
  productId: string;
  productName: string;
  productCategory: string;
  ownerSupplierId?: string;
  targetQuantity: number;
  priority: OperationalItemPriority;
  status: RestockTaskStatus;
  notes: string;
  dueDateUtc?: string;
  completedAtUtc?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface OperationalTodoItem {
  id: string;
  name: string;
  ownerSupplierId?: string;
  priority: OperationalItemPriority;
  source: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export type ProjectStatus = 'Planejado' | 'EmAndamento' | 'Concluido' | 'Cancelado';
export type ProjectStepStatus = 'Pendente' | 'EmAndamento' | 'Concluida' | 'Cancelada';
export type ProjectStepAttemptStatus = 'EmAndamento' | 'Concluida' | 'Falhada';

export interface ProjectStepFilamentItem {
  filamentProfileId: string;
  filamentName: string;
  weightGrams: number;
}

export interface ProjectStepAttempt {
  id: string;
  stepId: string;
  projectId: string;
  attemptNumber: number;
  printerUsed: string;
  filaments: ProjectStepFilamentItem[];
  timeRealMinutes: number;
  weightRealGrams: number;
  status: ProjectStepAttemptStatus;
  timeLostMinutes: number;
  weightLostGrams: number;
  failureReason?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ProjectStep {
  id: string;
  projectId: string;
  name: string;
  order: number;
  timeEstimatedMinutes: number;
  weightEstimatedGrams: number;
  printerPlanned?: string;
  filaments: ProjectStepFilamentItem[];
  status: ProjectStepStatus;
  attempts: ProjectStepAttempt[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  ownerSupplierId?: string;
  productId?: string;
  startedAtUtc?: string;
  concludedAtUtc?: string;
  timeEstimatedMinutes: number;
  weightEstimatedGrams: number;
  timeCompletedMinutes: number;
  weightCompletedGrams: number;
  timeLostToFailuresMinutes: number;
  weightLostToFailuresGrams: number;
  progressPercentage: number;
  steps: ProjectStep[];
  createdAtUtc: string;
  updatedAtUtc: string;
  estimatedMaterialCostBRL: number;
  estimatedTotalCostBRL: number;
  isPersonalized: boolean;
  personalizedSizeCm?: number;
  personalizedSizeMinCm?: number;
  personalizedSizeMaxCm?: number;
  personalizedIsPainted?: boolean;
  personalizedQuotedPriceBRL?: number;
  personalizedGeneratedProductId?: string;
  personalizedSaleId?: string;
}

export interface ProjectProductDraftPrinterUsage {
  printerName: string;
  printerProfileId?: string;
  timeRealMinutes: number;
}

export interface ProjectProductDraftMaterialUsage {
  filamentProfileId: string;
  filamentName: string;
  weightGrams: number;
  weightPercentage: number;
}

export interface ProjectProductDraft {
  projectId: string;
  existingProductId?: string;
  projectName: string;
  name: string;
  sku: string;
  description: string;
  categoryId?: string;
  supplierId?: string;
  generateProductionExpenseOnStockEntry: boolean;
  currentStock: number;
  itemsPerPlate: number;
  estimatedPrintTimeMinutes: number;
  heightCentimeters: number;
  lengthMetersUsed: number;
  tariffPerKwh: number;
  finishingPercentage: number;
  commissionPercentage: number;
  printerProfileId?: string;
  filaments: ProjectStepFilamentItem[];
  marketplaceFeeId?: string;
  additionalCost: number;
  failureAdditionalCost: number;
  desiredMarkup: number;
  salePrice?: number;
  printerUsages: ProjectProductDraftPrinterUsage[];
  materialUsages: ProjectProductDraftMaterialUsage[];
}

export interface PersonalizedPricingTier {
  id: string;
  order: number;
  minSizeCm: number;
  maxSizeCm?: number;
  finishedPriceBRL: number;
  unpaintedPriceBRL: number;
  isActive: boolean;
}

export interface PersonalizedProject {
  project: Project;
  product?: Product;
  saleId?: string;
}
export type PaintingPriceRounding = 'None' | 'NearestInteger' | 'EndsWith90' | 'EndsWith99' | 'MultipleOf5' | 'MultipleOf10';
export type PaintingPreparationChargeType = 'FixedAmount' | 'Hourly' | 'Percentage' | 'Manual';
export type PaintingAddOnChargeType = 'FixedAmount' | 'Percentage' | 'AdditionalHours' | 'Manual';
export type PaintingMaterialCategory = 'Tinta' | 'Primer' | 'Verniz' | 'Thinner' | 'Limpeza' | 'Massa' | 'FitaMascaramento' | 'Pincel' | 'Aerografo' | 'Consumivel' | 'Outros';

export interface PaintingSettings {
  defaultHourlyRate: number;
  defaultMaterialsPercentage: number;
  minimumMaterialsAmount: number;
  minimumPaintingPrice: number;
  defaultMarginPercentage: number;
  rounding: PaintingPriceRounding;
  updatedAtUtc: string;
}

export interface PaintingLevel {
  id: string;
  name: string;
  description: string;
  hourlyRate?: number | null;
  effectiveHourlyRate: number;
  order: number;
  isActive: boolean;
}

export interface PaintingComplexity {
  id: string;
  name: string;
  description: string;
  multiplier: number;
  order: number;
  isActive: boolean;
}

export interface PaintingSizeRange {
  id: string;
  name: string;
  minHeightCm: number;
  maxHeightCm?: number | null;
  requiresManualReview: boolean;
  order: number;
  isActive: boolean;
  hours: { levelId: string; hours: number }[];
}

export interface PaintingPreparationService {
  id: string;
  name: string;
  description: string;
  chargeType: PaintingPreparationChargeType;
  value: number;
  estimatedHours: number;
  isActive: boolean;
}

export interface PaintingMaterial {
  id: string;
  name: string;
  category: PaintingMaterialCategory;
  unit: string;
  unitCost: number;
  defaultQuantity: number;
  isActive: boolean;
}

export interface PaintingAddOn {
  id: string;
  name: string;
  description: string;
  chargeType: PaintingAddOnChargeType;
  value: number;
  percentage: number;
  additionalHours: number;
  isActive: boolean;
}

export interface PaintingPricingOverview {
  settings: PaintingSettings;
  levels: PaintingLevel[];
  complexities: PaintingComplexity[];
  sizeRanges: PaintingSizeRange[];
  preparationServices: PaintingPreparationService[];
  materials: PaintingMaterial[];
  addOns: PaintingAddOn[];
}

export interface PaintingItemSelection {
  id: string;
  manualAmount?: number | null;
  hours?: number | null;
}

export interface PaintingPricingCalculationRequest {
  heightCm: number;
  levelId: string;
  complexityId: string;
  preparations: PaintingItemSelection[];
  addOns: PaintingItemSelection[];
  hoursOverride?: number | null;
  hourlyRateOverride?: number | null;
  materialsPercentageOverride?: number | null;
  materialsAmountOverride?: number | null;
  preparationAmountOverride?: number | null;
  addOnsAmountOverride?: number | null;
  marginPercentageOverride?: number | null;
  finalPriceOverride?: number | null;
}

export interface PaintingChargeLine {
  id: string;
  name: string;
  chargeType: string;
  hours: number;
  amount: number;
}

export interface PaintingPricingResult {
  heightCm: number;
  level: { id: string; name: string };
  complexity: { id: string; name: string };
  sizeRange?: { id: string; name: string; minHeightCm: number; maxHeightCm?: number | null; requiresManualReview: boolean } | null;
  baseHours: number;
  complexityMultiplier: number;
  estimatedHours: number;
  hoursOverridden: boolean;
  addOnHours: number;
  totalHours: number;
  hourlyRate: number;
  hourlyRateSource: 'Override' | 'Level' | 'Default';
  laborAmount: number;
  materialsPercentage: number;
  minimumMaterialsAmount: number;
  materialsAmount: number;
  materialsMinimumApplied: boolean;
  materialsOverridden: boolean;
  preparations: PaintingChargeLine[];
  preparationAmount: number;
  preparationOverridden: boolean;
  addOns: PaintingChargeLine[];
  addOnsAmount: number;
  addOnsOverridden: boolean;
  baseAmount: number;
  isOutsourced: boolean;
  outsourcedAmount: number;
  costAmount: number;
  marginPercentage: number;
  marginAmount: number;
  calculatedAmount: number;
  minimumPaintingPrice: number;
  minimumPriceApplied: boolean;
  rounding: PaintingPriceRounding;
  suggestedPrice: number;
  finalPrice: number;
  finalPriceOverridden: boolean;
  warnings: string[];
  calculatedAtUtc: string;
  materialsByPercentageAmount: number;
}

export interface PaintingHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  name: string;
  action: 'Created' | 'Updated' | 'Deleted' | string;
  changedBy: string;
  changedAtUtc: string;
  changes: { field: string; before?: string | null; after?: string | null }[];
}

export type PaintingPricingMode = 'Automatic' | 'SemiAutomatic' | 'Manual';
export type PaintingExecution = 'Internal' | 'Outsourced';
export type PaintingPriceApplication = 'IncorporateCost' | 'IncorporatePrice' | 'ReferenceOnly' | 'ManualAmount';
export type PaintingBaseMode = 'SameLevel' | 'OtherLevel' | 'ManualAmount' | 'AddOn';

export interface ProductPaintingRequest {
  enabled: boolean;
  mode: PaintingPricingMode;
  execution: PaintingExecution;
  application: PaintingPriceApplication;
  heightCm: number;
  heightOverridden: boolean;
  levelId?: string | null;
  complexityId?: string | null;
  characterCount: number;
  hoursOverride?: number | null;
  hourlyRateOverride?: number | null;
  materialsAmountOverride?: number | null;
  preparationAmountOverride?: number | null;
  addOnsAmountOverride?: number | null;
  marginPercentageOverride?: number | null;
  finalPriceOverride?: number | null;
  preparations: PaintingItemSelection[];
  addOns: PaintingItemSelection[];
  extraPreparationDescription?: string | null;
  extraPreparationAmount: number;
  freeAddOnDescription?: string | null;
  freeAddOnQuantity: number;
  freeAddOnUnitAmount: number;
  baseNeedsPainting: boolean;
  baseMode: PaintingBaseMode;
  baseLevelId?: string | null;
  baseHours: number;
  baseManualAmount: number;
  baseAddOnId?: string | null;
  outsourcedSupplierId?: string | null;
  outsourcedChargedAmount: number;
  outsourcedFreightAmount: number;
  outsourcedOtherCosts: number;
  outsourcedIncorporatedPrice?: number | null;
  manualCost: number;
  manualPrice: number;
  manualIncorporatedAmount: number;
  notes?: string | null;
  colorReferences?: string | null;
  needsReview: boolean;
  keepStoredSnapshot: boolean;
  sourceProductId?: string | null;
}

export interface ProductPaintingCalculation {
  mode: PaintingPricingMode;
  execution: PaintingExecution;
  application: PaintingPriceApplication;
  costAmount: number;
  suggestedPrice: number;
  priceUsed: number;
  incorporatedCost: number;
  incorporatedPrice: number;
  details?: PaintingPricingResult | null;
  fromStoredSnapshot: boolean;
  calculatedAtUtc: string;
}

export interface ProductPainting {
  configuration: ProductPaintingRequest;
  snapshot?: ProductPaintingCalculation | null;
  levelName?: string | null;
  complexityName?: string | null;
  totalHours: number;
  hasNewerParameters: boolean;
}

export interface ProductPaintingRecalculation {
  stored?: ProductPaintingCalculation | null;
  recalculated: ProductPaintingCalculation;
  costDifference: number;
  priceDifference: number;
  hasDifferences: boolean;
}
