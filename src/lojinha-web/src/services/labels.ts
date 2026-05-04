import type { FairStatus, FinancialClassification, FinancialEntryType, InventoryItemType, InventoryMovementType, PaymentMethod } from './types';

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) {
    return 0;
  }

  return Number(digits) / 100;
}

export function formatCurrencyInput(value: number | string) {
  const numericValue = typeof value === 'string' ? Number(value || 0) : value;
  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function paymentMethodLabel(value: PaymentMethod | string) {
  return {
    Pix: 'Pix',
    CreditCard: 'Cartão de crédito',
    DebitCard: 'Cartão de débito',
    Cash: 'Dinheiro',
    Transfer: 'Transferência'
  }[value as PaymentMethod] ?? value;
}

export function inventoryItemTypeLabel(value: InventoryItemType | string) {
  return value === 'Product' ? 'Produto' : 'Insumo';
}

export function inventoryMovementTypeLabel(value: InventoryMovementType | string) {
  return {
    Entry: 'Entrada',
    Exit: 'Saída',
    Sale: 'Venda',
    Adjustment: 'Ajuste'
  }[value as InventoryMovementType] ?? value;
}

export function financialTypeLabel(value: FinancialEntryType | string) {
  return value === 'Income' ? 'Receita' : 'Despesa';
}

export function financialClassificationLabel(value: FinancialClassification | string) {
  return value === 'Fixed' ? 'Fixa' : 'Variável';
}

export function financialCategoryLabel(value: string) {
  return {
    'Inscricao de feira': 'Feira: inscrição paga pela lojinha',
    'Contas a pagar de feiras': 'Feira: obrigação do fornecedor (contas a pagar)',
    'Pagamento de cota de feira': 'Feira: pagamento de cota do fornecedor',
    'Recebimento de fornecedores em feiras': 'Feira: recebimento da lojinha',
    'Pendencia de pagamento em feiras': 'Feira: pendência de pagamento (legado)'
  }[value] ?? value;
}

export function fairStatusLabel(value: FairStatus | string) {
  return {
    Awaiting: 'Aguardando',
    Open: 'Em aberto',
    Finalized: 'Finalizada',
    Cancelled: 'Cancelada'
  }[value as FairStatus] ?? value;
}