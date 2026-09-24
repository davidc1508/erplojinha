import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { PageSection } from '../../components/PageSection';
import type { ProductPricing } from '../../services/types';
import { formatCurrency, formatNumber } from '../paintingPricing/paintingPricingShared';

interface ProductCostSummarySectionProps {
  pricing?: ProductPricing;
  itemsPerPlate: number;
  commissionPercentage: number;
  desiredMarkup: number;
  materialLabel: string;
  isPrint3D: boolean;
  persistedCost?: number;
  showDivergence: boolean;
  missingPrinterWarning: boolean;
  paintingApplicationNote?: string | null;
  dirty: boolean;
}

const partColors = ['#a54b62', '#d96b87', '#e1a657', '#4c9f93', '#8fd3c6', '#c9b3a6', '#b98f7a', '#6d5a9e'];

function ProductCostSummarySectionView({
  pricing,
  itemsPerPlate,
  commissionPercentage,
  desiredMarkup,
  materialLabel,
  isPrint3D,
  persistedCost,
  showDivergence,
  missingPrinterWarning,
  paintingApplicationNote,
  dirty
}: ProductCostSummarySectionProps) {
  const perPlate = Math.max(1, itemsPerPlate);
  const parts = pricing ? [
    { label: materialLabel, value: pricing.materialCost / perPlate },
    ...(isPrint3D ? [
      { label: 'Energia', value: pricing.energyCost / perPlate },
      { label: 'Manutenção', value: pricing.maintenanceCost / perPlate },
      { label: 'Falhas', value: pricing.failureCost / perPlate }
    ] : []),
    { label: 'Acabamento', value: pricing.finishingCost / perPlate },
    { label: 'Mão de obra', value: pricing.laborCost / perPlate },
    { label: 'Custo adicional', value: pricing.additionalCosts / perPlate },
    { label: 'Pintura', value: pricing.paintingCost ?? 0 }
  ].filter((part) => part.value > 0).map((part, index) => ({ ...part, color: part.label === 'Pintura' ? partColors[7] : partColors[index % 7] })) : [];
  const partsTotal = parts.reduce((sum, part) => sum + part.value, 0);

  return (
    <PageSection title="5 · Resumo de custo" subtitle={dirty ? 'Calculado com os dados atuais do formulário — por unidade.' : 'Calculado com os dados salvos — por unidade. Edite o formulário para recalcular.'}>
      {pricing ? (
        <Stack spacing={2.5}>
          {missingPrinterWarning ? (
            <Alert severity="warning"><strong>Aviso:</strong> nenhuma impressora selecionada. Custo calculado apenas com material (filamento). Com impressora, entram energia, manutenção e falhas.</Alert>
          ) : null}
          {showDivergence && persistedCost !== undefined ? (
            <Alert severity="info"><strong>Divergência de custo:</strong> persistido {formatCurrency(persistedCost)} → recalculado {formatCurrency(pricing.totalCost)}{!dirty ? ' • Salve para atualizar.' : ''}</Alert>
          ) : null}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, gridColumn: { xs: '1 / -1', md: 'auto' } }}>
              <Typography variant="body2" color="text.secondary" fontWeight={700}>Custo calculado</Typography>
              <Typography variant="h5">{formatCurrency(pricing.totalCost)}</Typography>
              <Typography variant="caption" color="text.secondary">{(pricing.paintingCost ?? 0) > 0 ? 'por unidade, com pintura' : 'por unidade'}{persistedCost !== undefined ? ` · persistido ${formatCurrency(persistedCost)}` : ''}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 4 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={700}>Preço sugerido</Typography>
              <Typography variant="h5" color="primary.dark">{formatCurrency(pricing.suggestedPrice)}</Typography>
              <Typography variant="caption" color="text.secondary">markup desejado {formatNumber(desiredMarkup)}×</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 4 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={700}>{commissionPercentage > 0 ? `Sugerido + comissão (${formatNumber(commissionPercentage, 0)}%)` : 'Sugerido com marketplace'}</Typography>
              <Typography variant="h5">{formatCurrency(commissionPercentage > 0 ? pricing.suggestedPriceWithCommission : pricing.marketplaceAdjustedPrice)}</Typography>
              <Typography variant="caption" color="text.secondary">{commissionPercentage > 0 ? 'para venda comissionada' : 'com taxas do marketplace'}</Typography>
            </Paper>
          </Box>
          {paintingApplicationNote ? <Alert severity="info" icon={false} sx={{ bgcolor: '#efebf7', color: '#4d3f75', fontWeight: 700 }}>{paintingApplicationNote}</Alert> : null}
          {partsTotal > 0 ? (
            <div>
              <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ mb: 1 }}>Composição do custo</Typography>
              <Box sx={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', gap: '2px', bgcolor: 'rgba(125,101,88,0.08)' }}>
                {parts.map((part) => <Box key={part.label} sx={{ flex: `${Math.max(part.value / partsTotal * 100, 0.8)} 0 0`, bgcolor: part.color }} />)}
              </Box>
              <Box sx={{ display: 'grid', gap: 1.5, mt: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(auto-fill, minmax(150px, 1fr))' } }}>
                {parts.map((part) => (
                  <Stack key={part.label} direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.75, bgcolor: part.color, mt: 0.6, flexShrink: 0 }} />
                    <div>
                      <Typography variant="body2" color="text.secondary">{part.label}</Typography>
                      <Typography fontWeight={700}>{formatCurrency(part.value)}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatNumber(part.value / partsTotal * 100, 1)}%</Typography>
                    </div>
                  </Stack>
                ))}
              </Box>
            </div>
          ) : null}
        </Stack>
      ) : (
        <Typography color="text.secondary">Selecione uma categoria para visualizar o resumo de custo.</Typography>
      )}
    </PageSection>
  );
}

export const ProductCostSummarySection = memo(ProductCostSummarySectionView);
