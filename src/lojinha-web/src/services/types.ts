export type PaymentMethod = 'Pix' | 'CreditCard' | 'DebitCard' | 'Cash' | 'Transfer';
export type FinancialEntryType = 'Income' | 'Expense';
export type FinancialClassification = 'Fixed' | 'Variable';
export type InventoryItemType = 'Product' | 'Supply';
export type InventoryMovementType = 'Entry' | 'Exit' | 'Sale' | 'Adjustment';
export type FairStatus = 'Awaiting' | 'Open' | 'Finalized' | 'Cancelled';
export type OperationalItemPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type RestockTaskStatus = 'Open' | 'InProgress' | 'Completed' | 'Cancelled';
export type TodoTaskStatus = 'Backlog' | 'InAnalysis' | 'InDevelopment' | 'Completed' | 'Cancelled';

export interface AuthResponse {
  token: string;
  email: string;
  fullName: string;
  role: string;
  supplierId?: string;
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
  minimumStock: number;
  itemsPerPlate: number;
  estimatedPrintTimeMinutes: number;
  heightCentimeters: number;
  estimatedWeightGrams: number;
  lengthMetersUsed: number;
  tariffPerKwh: number;
  finishingPercentage: number;
  commissionPercentage: number;
  additionalCost: number;
  printerProfileId?: string;
    filaments: ProductFilamentItem[];
  printer?: string;
  marketplaceFeeId?: string;
  marketplace?: string;
}

export interface ProductMetadata {
  categories: CatalogItem[];
  suppliers: CatalogItem[];
  printers: CatalogItem[];
  filaments: CatalogItem[];
  marketplaces: CatalogItem[];
  supplies: CatalogItem[];
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
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  totalPrice: number;
  supplierId?: string;
  supplierName?: string;
  lojinhaGainPercentage: number;
  lojinhaGainAmount: number;
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
  suppliers: { supplierId: string; supplierName: string }[];
  storeRegistrationFee: number;
  notes: string;
  status: FairStatus;
  finalizedAtUtc?: string;
  totalSales: number;
  grossRevenue: number;
  netRevenue: number;
  piggyBankAmount: number;
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
  suppliers: { supplierId: string; supplierName: string }[];
  storeRegistrationFee: number;
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
  status: TodoTaskStatus;
  source: string;
  completedAtUtc?: string;
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
}