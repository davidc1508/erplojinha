import { Alert, Box, Button, Chip, Paper, Slider, Stack, TextField, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useEffect, useState } from 'react';
import { PageSection } from '../../components/PageSection';
import type { ProductPricing } from '../../services/types';
import { formatCurrency, formatNumber } from '../paintingPricing/paintingPricingShared';

interface ProductProjectionSectionProps {
  pricing?: ProductPricing;
  unitCost: number;
  salePrice: number;
  commissionPercentage: number;
  itemsPerPlate: number;
  isPrint3D: boolean;
  isEarring: boolean;
  isBotton: boolean;
  filamentGramsPerPlate: number;
  printMinutesPerPlate: number;
  bottonQuantityPerUnit: number;
  bottonStock?: number;
  onApplyPrice: (price: number) => void;
  disabled?: boolean;
}

const maxQuantity = 1000;
const plateMultipliers = [1, 2, 5, 10, 25];

function formatMinutes(totalMinutes: number) {
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  const base = hours > 0 ? `${hours.toLocaleString('pt-BR')}h ${minutes}min` : `${minutes}min`;
  return rounded >= 1440 ? `${base} (≈ ${formatNumber(rounded / 1440, 1)} dias)` : base;
}

function clampQuantity(value: number) {
  return Math.min(maxQuantity, Math.max(1, Math.round(value) || 1));
}

export function ProductProjectionSection({
  pricing,
  unitCost,
  salePrice,
  commissionPercentage,
  itemsPerPlate,
  isPrint3D,
  isEarring,
  isBotton,
  filamentGramsPerPlate,
  printMinutesPerPlate,
  bottonQuantityPerUnit,
  bottonStock,
  onApplyPrice,
  disabled
}: ProductProjectionSectionProps) {
  const perPlate = Math.max(1, itemsPerPlate);
  const [quantity, setQuantity] = useState(clampQuantity(perPlate));
  const currentShare = salePrice > 0 && unitCost > 0 ? Math.min(95, Math.max(10, unitCost / salePrice * 100)) : 50;
  const [costShare, setCostShare] = useState(currentShare);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setQuantity(clampQuantity(perPlate));
  }, [perPlate]);

  useEffect(() => {
    setCostShare(currentShare);
    setApplied(false);
  }, [currentShare]);

  if (!pricing || unitCost <= 0) {
    return (
      <PageSection title="6 · Projeção de produção e lucro" subtitle="Escolha o lote e arraste a divisa entre custo e lucro para descobrir o preço de venda.">
        <Typography color="text.secondary">Selecione uma categoria e informe os dados de produção para ver a projeção.</Typography>
      </PageSection>
    );
  }

  const plates = Math.ceil(quantity / perPlate);
  const simulatedPrice = Math.round(unitCost / (costShare / 100) * 100) / 100;
  const margin = 100 - costShare;
  const belowMinimum = costShare > 50.0001;
  const commissionRate = commissionPercentage > 0 ? commissionPercentage / 100 : 0;
  const simulatedWithCommission = commissionRate > 0 && commissionRate < 1 ? simulatedPrice / (1 - commissionRate) : simulatedPrice;
  const unitScale = 1 / perPlate;
  const chips = [...plateMultipliers.map((multiplier) => ({ label: `${multiplier === 1 ? '1 placa' : `${multiplier} placas`} (${Math.min(maxQuantity, perPlate * multiplier)})`, value: Math.min(maxQuantity, perPlate * multiplier) })), { label: 'Máx. 1000', value: maxQuantity }]
    .filter((chip, index, list) => list.findIndex((item) => item.value === chip.value) === index);
  const bottonConsumed = bottonQuantityPerUnit * quantity;

  return (
    <PageSection title="6 · Projeção de produção e lucro" subtitle="Escolha o lote e arraste a divisa entre custo e lucro para descobrir o preço de venda.">
      <Stack spacing={3}>
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '240px minmax(0, 1fr)' }, alignItems: 'center' }}>
          <Stack direction={{ xs: 'row', md: 'column' }} justifyContent="space-between" alignItems={{ xs: 'flex-end', md: 'flex-start' }} spacing={1}>
            <div>
              <Typography variant="body2" color="text.secondary" fontWeight={700}>Tamanho do lote</Typography>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography variant="h3" color="primary.dark" sx={{ fontSize: { xs: '2.4rem', md: '3rem' } }}>{quantity}</Typography>
                <Typography color="text.secondary" fontWeight={700}>unidades</Typography>
              </Stack>
              {isPrint3D ? <Typography variant="caption" color="text.secondary">= {plates} {plates === 1 ? 'placa' : 'placas'} de {perPlate} {perPlate === 1 ? 'item' : 'itens'}</Typography> : null}
            </div>
            <TextField label="Qtd." type="number" size="small" value={quantity} onChange={(event) => setQuantity(clampQuantity(Number(event.target.value)))} inputProps={{ min: 1, max: maxQuantity, inputMode: 'numeric' }} sx={{ width: 110 }} />
          </Stack>
          <div>
            <Slider value={quantity} min={1} max={maxQuantity} step={1} onChange={(_, value) => setQuantity(clampQuantity(Array.isArray(value) ? value[0] : value))} valueLabelDisplay="auto" marks={[{ value: 1, label: '1' }, { value: 250, label: '250' }, { value: 500, label: '500' }, { value: 750, label: '750' }, { value: 1000, label: '1000' }]} aria-label="Quantidade do lote" />
            <Stack direction="row" spacing={1} sx={{ mt: 1, overflowX: 'auto', pb: 0.5 }}>
              {chips.map((chip) => <Chip key={chip.label} label={chip.label} onClick={() => setQuantity(chip.value)} color={quantity === chip.value ? 'primary' : 'default'} sx={{ flexShrink: 0, fontWeight: 700 }} />)}
            </Stack>
          </div>
        </Box>

        <div>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5} sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={700}>Lucro esperado — arraste a divisa</Typography>
            <Typography variant="body2" color="text.secondary">Preço atual do produto: <strong>{formatCurrency(salePrice)}</strong></Typography>
          </Stack>
          <Box sx={{ position: 'relative', height: 52, mx: 1.5 }}>
            <Box sx={{ display: 'flex', height: 52, borderRadius: 999, overflow: 'hidden' }}>
              <Box sx={{ width: `${costShare}%`, bgcolor: '#a54b62', color: '#fff', display: 'flex', alignItems: 'center', pl: 2, fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden' }}>Custo {formatNumber(costShare, 0)}%</Box>
              <Box sx={{ flex: 1, bgcolor: '#4f7a3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 2, fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden' }}>Lucro {formatNumber(margin, 1)}%</Box>
            </Box>
            <Box sx={{ position: 'absolute', top: -6, bottom: -6, left: '50%', borderLeft: '2px dashed rgba(71,51,40,0.55)', pointerEvents: 'none' }} />
            <Box sx={{ position: 'absolute', top: -6, bottom: -6, left: `${currentShare}%`, borderLeft: '2px solid #473328', pointerEvents: 'none' }} />
            <Slider
              value={costShare}
              min={10}
              max={95}
              step={0.5}
              onChange={(_, value) => { setCostShare(Array.isArray(value) ? value[0] : value); setApplied(false); }}
              track={false}
              aria-label="Divisa entre custo e lucro"
              disabled={disabled}
              sx={{
                position: 'absolute', inset: 0, height: 52, p: '0 !important',
                '& .MuiSlider-rail': { opacity: 0 },
                '& .MuiSlider-thumb': { width: 20, height: 60, borderRadius: 999, bgcolor: '#fffcf9', border: '3px solid #473328', boxShadow: '0 4px 12px rgba(71,51,40,0.3)', cursor: 'ew-resize' }
              }}
            />
          </Box>
          <Box sx={{ position: 'relative', height: 40, mx: 1.5, mt: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>markup mínimo 2×</Typography>
            <Typography variant="caption" fontWeight={700} sx={{ position: 'absolute', left: `${currentShare}%`, top: Math.abs(currentShare - 50) < 25 ? 18 : 0, transform: 'translateX(-10px)', whiteSpace: 'nowrap' }}>▲ preço atual</Typography>
          </Box>
        </div>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '1.1fr 1fr' } }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, borderColor: belowMinimum ? 'warning.main' : 'rgba(217,107,135,0.3)', bgcolor: belowMinimum ? 'rgba(225,166,87,0.08)' : 'background.paper' }}>
            <Typography variant="body2" color="text.secondary" fontWeight={700}>Preço de venda para {formatNumber(margin, 1)}% de lucro</Typography>
            <Stack direction="row" spacing={1} alignItems="baseline">
              <Typography variant="h4">{formatCurrency(simulatedPrice)}</Typography>
              <Typography color="text.secondary" fontWeight={700}>/ unidade</Typography>
            </Stack>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', mt: 1 }}>
              <div><Typography variant="caption" color="text.secondary">Com comissão</Typography><Typography fontWeight={800}>{formatCurrency(simulatedWithCommission)}</Typography></div>
              <div><Typography variant="caption" color="text.secondary">Markup</Typography><Typography fontWeight={800}>{formatNumber(simulatedPrice / unitCost, 2)}×</Typography></div>
              <div><Typography variant="caption" color="text.secondary">Lucro/un</Typography><Typography fontWeight={800} sx={{ color: '#3f6a2c' }}>{formatCurrency(simulatedPrice - unitCost)}</Typography></div>
            </Box>
            {belowMinimum ? <Alert severity="warning" sx={{ mt: 1.5 }}>Abaixo do markup mínimo (2×). O cadastro não aceita preço menor que {formatCurrency(unitCost * 2)}.</Alert> : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 2 }}>
              <Button variant="contained" onClick={() => { onApplyPrice(simulatedPrice); setApplied(true); }} disabled={disabled || belowMinimum}>Usar como preço final</Button>
              <Button onClick={() => { setCostShare(currentShare); setApplied(false); }}>Voltar ao preço atual</Button>
              {applied ? <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: '#3f6a2c' }}><CheckRoundedIcon fontSize="small" /><Typography variant="body2" fontWeight={700}>Aplicado em “Preço final de venda”</Typography></Stack> : null}
            </Stack>
          </Paper>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 4 }}><Typography variant="body2" color="text.secondary" fontWeight={700}>Custo do lote</Typography><Typography variant="h6">{formatCurrency(unitCost * quantity)}</Typography></Paper>
            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 4 }}><Typography variant="body2" color="text.secondary" fontWeight={700}>Receita do lote</Typography><Typography variant="h6">{formatCurrency(simulatedPrice * quantity)}</Typography></Paper>
            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 4, bgcolor: '#eef5e9', borderColor: 'rgba(79,122,58,0.2)' }}><Typography variant="body2" fontWeight={700} sx={{ color: '#4f7a3a' }}>Lucro do lote</Typography><Typography variant="h6" sx={{ color: '#3f6a2c' }}>{formatCurrency((simulatedPrice - unitCost) * quantity)}</Typography></Paper>
            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 4 }}><Typography variant="body2" color="text.secondary" fontWeight={700}>Margem</Typography><Typography variant="h6">{formatNumber(margin, 1)}%</Typography></Paper>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' }, p: 2, borderRadius: 4, bgcolor: 'rgba(251,243,239,0.9)' }}>
          {isPrint3D ? (
            <>
              <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Placas necessárias</Typography><Typography fontWeight={700}>{plates} ({perPlate} por placa)</Typography></div>
              <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Tempo de impressão</Typography><Typography fontWeight={700}>{formatMinutes(printMinutesPerPlate * plates)}</Typography></div>
              <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Filamento</Typography><Typography fontWeight={700}>{filamentGramsPerPlate * plates >= 1000 ? `${formatNumber(filamentGramsPerPlate * plates / 1000, 1)} kg` : `${formatNumber(filamentGramsPerPlate * plates, 0)} g`} · {formatCurrency(pricing.materialCost * unitScale * quantity)}</Typography></div>
              <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Energia · Falhas</Typography><Typography fontWeight={700}>{formatCurrency(pricing.energyCost * unitScale * quantity)} · {formatCurrency(pricing.failureCost * unitScale * quantity)}</Typography></div>
            </>
          ) : null}
          {isEarring ? <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Pingentes</Typography><Typography fontWeight={700}>{quantity} un · {formatCurrency(pricing.materialCost * quantity)}</Typography></div> : null}
          {isBotton ? (
            <div>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>Tamanho de botton</Typography>
              <Typography fontWeight={700}>{formatNumber(bottonConsumed, 0)} peça(s) · {formatCurrency(pricing.materialCost * quantity)}</Typography>
              {bottonStock !== undefined ? <Typography variant="caption" color={bottonStock >= bottonConsumed ? 'success.main' : 'error.main'} fontWeight={700}>Estoque {bottonStock} — {bottonStock >= bottonConsumed ? 'suficiente' : `faltam ${formatNumber(bottonConsumed - bottonStock, 0)}`}</Typography> : null}
            </div>
          ) : null}
          <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Mão de obra + acabamento</Typography><Typography fontWeight={700}>{formatCurrency((pricing.finishingCost + pricing.laborCost) * unitScale * quantity)}</Typography></div>
          {(pricing.paintingCost ?? 0) > 0 ? <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Pintura</Typography><Typography fontWeight={700}>{formatCurrency(pricing.paintingCost * quantity)}</Typography></div> : null}
        </Box>
      </Stack>
    </PageSection>
  );
}
