import type {
  PaintingAddOnChargeType,
  PaintingMaterialCategory,
  PaintingPreparationChargeType,
  PaintingPriceRounding
} from '../../services/types';

export const paintingPricingQueryKey = ['painting-pricing'];
export const paintingHistoryQueryKey = ['painting-pricing-history'];

export const roundingLabels: Record<PaintingPriceRounding, string> = {
  None: 'Nenhum',
  NearestInteger: 'Próximo inteiro',
  EndsWith90: 'Terminar em ,90',
  EndsWith99: 'Terminar em ,99',
  MultipleOf5: 'Múltiplo de R$ 5',
  MultipleOf10: 'Múltiplo de R$ 10'
};

export const preparationChargeLabels: Record<PaintingPreparationChargeType, string> = {
  FixedAmount: 'Valor fixo',
  Hourly: 'Por hora',
  Percentage: 'Percentual',
  Manual: 'Manual'
};

export const addOnChargeLabels: Record<PaintingAddOnChargeType, string> = {
  FixedAmount: 'Valor fixo',
  Percentage: 'Percentual',
  AdditionalHours: 'Horas adicionais',
  Manual: 'Manual'
};

export const materialCategoryLabels: Record<PaintingMaterialCategory, string> = {
  Tinta: 'Tinta',
  Primer: 'Primer',
  Verniz: 'Verniz',
  Thinner: 'Thinner',
  Limpeza: 'Limpeza',
  Massa: 'Massa',
  FitaMascaramento: 'Fita de mascaramento',
  Pincel: 'Pincel',
  Aerografo: 'Aerógrafo',
  Consumivel: 'Consumível',
  Outros: 'Outros'
};

export const hourlyRateSourceLabels: Record<string, string> = {
  Override: 'informado na simulação',
  Level: 'do nível',
  Default: 'padrão'
};

export const auditActionLabels: Record<string, string> = {
  Created: 'Criado',
  Updated: 'Alterado',
  Deleted: 'Excluído'
};

const enumValueLabels: Record<string, string> = {
  ...roundingLabels,
  ...preparationChargeLabels,
  ...addOnChargeLabels,
  ...materialCategoryLabels
};

export function historyValueLabel(value?: string | null) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return enumValueLabels[value] ?? value;
}

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits });
}

export function formatHours(value: number) {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
}

export function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}

export function formatHeightRange(minHeightCm: number, maxHeightCm?: number | null) {
  if (maxHeightCm === null || maxHeightCm === undefined) {
    return `Acima de ${formatNumber(minHeightCm)} cm`;
  }

  return minHeightCm <= 0
    ? `Até ${formatNumber(maxHeightCm)} cm`
    : `Acima de ${formatNumber(minHeightCm)} até ${formatNumber(maxHeightCm)} cm`;
}

export function toOptionalNumber(value: string) {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
    if (data?.message) {
      return data.message;
    }

    const firstError = data?.errors ? Object.values(data.errors).flat()[0] : undefined;
    if (firstError) {
      return firstError;
    }
  }

  return fallback;
}
