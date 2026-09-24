import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { PageSection } from '../../components/PageSection';
import { paintingPricingApi } from '../../services/api';
import type { PaintingChargeLine, PaintingPricingCalculationRequest, PaintingPricingOverview, PaintingPricingResult } from '../../services/types';
import {
  addOnChargeLabels,
  formatCurrency,
  formatHours,
  formatNumber,
  formatPercent,
  getErrorMessage,
  hourlyRateSourceLabels,
  preparationChargeLabels,
  roundingLabels,
  toOptionalNumber
} from './paintingPricingShared';

interface SelectionState {
  manualAmount: string;
  hours: string;
}

interface ManualState {
  hours: string;
  materialsAmount: string;
  preparationAmount: string;
  addOnsAmount: string;
  finalPrice: string;
}

const emptyManual: ManualState = { hours: '', materialsAmount: '', preparationAmount: '', addOnsAmount: '', finalPrice: '' };

function MoneyInput({ label, value, onChange, placeholder, helperText }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; helperText?: string }) {
  return (
    <TextField
      label={label}
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      helperText={helperText}
      InputLabelProps={{ shrink: true }}
      InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
      inputProps={{ min: 0, step: 0.01 }}
      fullWidth
    />
  );
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function PaintingSimulatorTab({ overview }: { overview: PaintingPricingOverview }) {
  const activeLevels = overview.levels.filter((level) => level.isActive);
  const activeComplexities = overview.complexities.filter((complexity) => complexity.isActive);
  const activePreparations = overview.preparationServices.filter((service) => service.isActive);
  const activeAddOns = overview.addOns.filter((addOn) => addOn.isActive);

  const [heightCm, setHeightCm] = useState('20');
  const [levelId, setLevelId] = useState(activeLevels[0]?.id ?? '');
  const [complexityId, setComplexityId] = useState(activeComplexities[0]?.id ?? '');
  const [preparations, setPreparations] = useState<Record<string, SelectionState>>({});
  const [addOns, setAddOns] = useState<Record<string, SelectionState>>({});
  const [hourlyRate, setHourlyRate] = useState('');
  const [materialsPercentage, setMaterialsPercentage] = useState('');
  const [marginPercentage, setMarginPercentage] = useState('');
  const [useAutomatic, setUseAutomatic] = useState(true);
  const [manual, setManual] = useState<ManualState>(emptyManual);

  useEffect(() => {
    if (!activeLevels.some((level) => level.id === levelId)) {
      setLevelId(activeLevels[0]?.id ?? '');
    }

    if (!activeComplexities.some((complexity) => complexity.id === complexityId)) {
      setComplexityId(activeComplexities[0]?.id ?? '');
    }
  }, [activeComplexities, activeLevels, complexityId, levelId]);

  const selectedLevel = activeLevels.find((level) => level.id === levelId);

  const request = useMemo<PaintingPricingCalculationRequest>(() => ({
    heightCm: toOptionalNumber(heightCm) ?? 0,
    levelId,
    complexityId,
    preparations: Object.entries(preparations)
      .filter(([id]) => activePreparations.some((service) => service.id === id))
      .map(([id, selection]) => ({ id, manualAmount: toOptionalNumber(selection.manualAmount), hours: toOptionalNumber(selection.hours) })),
    addOns: Object.entries(addOns)
      .filter(([id]) => activeAddOns.some((addOn) => addOn.id === id))
      .map(([id, selection]) => ({ id, manualAmount: toOptionalNumber(selection.manualAmount) })),
    hourlyRateOverride: toOptionalNumber(hourlyRate),
    materialsPercentageOverride: toOptionalNumber(materialsPercentage),
    marginPercentageOverride: toOptionalNumber(marginPercentage),
    hoursOverride: useAutomatic ? null : toOptionalNumber(manual.hours),
    materialsAmountOverride: useAutomatic ? null : toOptionalNumber(manual.materialsAmount),
    preparationAmountOverride: useAutomatic ? null : toOptionalNumber(manual.preparationAmount),
    addOnsAmountOverride: useAutomatic ? null : toOptionalNumber(manual.addOnsAmount),
    finalPriceOverride: useAutomatic ? null : toOptionalNumber(manual.finalPrice)
  }), [activeAddOns, activePreparations, addOns, complexityId, heightCm, hourlyRate, levelId, manual, marginPercentage, materialsPercentage, preparations, useAutomatic]);

  const debouncedRequest = useDebouncedValue(request, 300);
  const canCalculate = debouncedRequest.heightCm > 0 && Boolean(debouncedRequest.levelId) && Boolean(debouncedRequest.complexityId);
  const { data: result, error, isFetching } = useQuery({
    queryKey: ['painting-pricing-calculation', debouncedRequest],
    queryFn: () => paintingPricingApi.calculate(debouncedRequest),
    enabled: canCalculate,
    keepPreviousData: true,
    retry: false
  });

  function togglePreparation(id: string, defaultHours: number) {
    setPreparations((current) => {
      if (current[id]) {
        const { [id]: _removed, ...rest } = current;
        return rest;
      }

      return { ...current, [id]: { manualAmount: '', hours: String(defaultHours) } };
    });
  }

  function toggleAddOn(id: string) {
    setAddOns((current) => {
      if (current[id]) {
        const { [id]: _removed, ...rest } = current;
        return rest;
      }

      return { ...current, [id]: { manualAmount: '', hours: '' } };
    });
  }

  if (activeLevels.length === 0 || activeComplexities.length === 0) {
    return <Alert severity="warning">Cadastre ao menos um nível de pintura e uma complexidade ativos para simular.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <ResultStrip result={result} isFetching={isFetching} />

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
        <PageSection title="Peça" subtitle="Altura, nível e complexidade definem as horas estimadas.">
          <Stack spacing={2}>
            <TextField label="Altura da peça" type="number" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }} inputProps={{ min: 0, step: 0.5 }} fullWidth />
            <TextField select label="Nível de pintura" value={levelId} onChange={(event) => setLevelId(event.target.value)} fullWidth>
              {activeLevels.map((level) => <MenuItem key={level.id} value={level.id}>{level.name} · {formatCurrency(level.effectiveHourlyRate)}/h</MenuItem>)}
            </TextField>
            <TextField select label="Complexidade" value={complexityId} onChange={(event) => setComplexityId(event.target.value)} fullWidth>
              {activeComplexities.map((complexity) => <MenuItem key={complexity.id} value={complexity.id}>{complexity.name} · {formatNumber(complexity.multiplier)}×</MenuItem>)}
            </TextField>
          </Stack>
        </PageSection>

        <PageSection title="Ajustes do cálculo" subtitle="Campos vazios usam os valores configurados.">
          <Stack spacing={2}>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' } }}>
              <MoneyInput label="Valor-hora" value={hourlyRate} onChange={setHourlyRate} placeholder={selectedLevel ? formatNumber(selectedLevel.effectiveHourlyRate) : undefined} />
              <TextField label="% materiais" type="number" value={materialsPercentage} onChange={(event) => setMaterialsPercentage(event.target.value)} placeholder={formatNumber(overview.settings.defaultMaterialsPercentage)} InputLabelProps={{ shrink: true }} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} inputProps={{ min: 0 }} fullWidth />
              <TextField label="Margem adicional" type="number" value={marginPercentage} onChange={(event) => setMarginPercentage(event.target.value)} placeholder={formatNumber(overview.settings.defaultMarginPercentage)} InputLabelProps={{ shrink: true }} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} inputProps={{ min: 0 }} fullWidth />
            </Box>
            <Divider />
            <FormControlLabel
              control={<Switch checked={useAutomatic} onChange={(event) => { setUseAutomatic(event.target.checked); if (event.target.checked) { setManual(emptyManual); } }} />}
              label={<Typography fontWeight={700}>Usar cálculo automático</Typography>}
            />
            {!useAutomatic ? (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">Preencha só o que quiser corrigir. Campos vazios continuam automáticos.</Typography>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                  <TextField label="Horas" type="number" value={manual.hours} onChange={(event) => setManual({ ...manual, hours: event.target.value })} placeholder={result ? formatNumber(result.estimatedHours) : undefined} InputLabelProps={{ shrink: true }} InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }} inputProps={{ min: 0, step: 0.25 }} fullWidth />
                  <MoneyInput label="Materiais" value={manual.materialsAmount} onChange={(value) => setManual({ ...manual, materialsAmount: value })} />
                  <MoneyInput label="Preparação" value={manual.preparationAmount} onChange={(value) => setManual({ ...manual, preparationAmount: value })} />
                  <MoneyInput label="Adicionais" value={manual.addOnsAmount} onChange={(value) => setManual({ ...manual, addOnsAmount: value })} />
                </Box>
                <MoneyInput label="Preço da pintura" value={manual.finalPrice} onChange={(value) => setManual({ ...manual, finalPrice: value })} helperText="Substitui o preço sugerido, sem aplicar mínimo nem arredondamento." />
              </Stack>
            ) : null}
          </Stack>
        </PageSection>

        <PageSection title="Serviços de preparação" subtitle="Marque o que a peça vai precisar.">
          <Stack spacing={1}>
            {activePreparations.length === 0 ? <Typography color="text.secondary">Nenhum serviço ativo.</Typography> : null}
            {activePreparations.map((service) => {
              const selection = preparations[service.id];
              return (
                <Box key={service.id} sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 160px' }, alignItems: 'center' }}>
                  <FormControlLabel
                    control={<Checkbox checked={Boolean(selection)} onChange={() => togglePreparation(service.id, service.estimatedHours)} />}
                    label={(
                      <Stack>
                        <Typography>{service.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{preparationChargeLabels[service.chargeType]}</Typography>
                      </Stack>
                    )}
                  />
                  {selection && service.chargeType === 'Manual' ? (
                    <MoneyInput label="Valor" value={selection.manualAmount} onChange={(value) => setPreparations({ ...preparations, [service.id]: { ...selection, manualAmount: value } })} placeholder={formatNumber(service.value)} />
                  ) : null}
                  {selection && service.chargeType === 'Hourly' ? (
                    <TextField label="Horas" type="number" size="small" value={selection.hours} onChange={(event) => setPreparations({ ...preparations, [service.id]: { ...selection, hours: event.target.value } })} InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }} inputProps={{ min: 0, step: 0.25 }} />
                  ) : null}
                </Box>
              );
            })}
          </Stack>
        </PageSection>

        <PageSection title="Adicionais" subtitle="Técnicas e efeitos especiais.">
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            {activeAddOns.length === 0 ? <Typography color="text.secondary">Nenhum adicional ativo.</Typography> : null}
            {activeAddOns.map((addOn) => {
              const selection = addOns[addOn.id];
              return (
                <Stack key={addOn.id} spacing={0.5}>
                  <FormControlLabel
                    control={<Checkbox checked={Boolean(selection)} onChange={() => toggleAddOn(addOn.id)} />}
                    label={(
                      <Stack>
                        <Typography>{addOn.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{addOnChargeLabels[addOn.chargeType]}</Typography>
                      </Stack>
                    )}
                  />
                  {selection && addOn.chargeType === 'Manual' ? (
                    <MoneyInput label={`Valor · ${addOn.name}`} value={selection.manualAmount} onChange={(value) => setAddOns({ ...addOns, [addOn.id]: { ...selection, manualAmount: value } })} placeholder={formatNumber(addOn.value)} />
                  ) : null}
                </Stack>
              );
            })}
          </Box>
        </PageSection>
      </Box>

      {error ? <Alert severity="warning">{getErrorMessage(error, 'Não foi possível calcular a pintura com os dados informados.')}</Alert> : null}
      {!canCalculate ? <Alert severity="info">Informe a altura, o nível e a complexidade para calcular.</Alert> : null}
      {result ? <CalculationMemory result={result} /> : null}
    </Stack>
  );
}

function ResultStrip({ result, isFetching }: { result?: PaintingPricingResult; isFetching: boolean }) {
  const items = [
    { label: 'Horas consideradas', value: result ? formatHours(result.totalHours) : '—' },
    { label: 'Custo total de pintura', value: result ? formatCurrency(result.costAmount) : '—' },
    { label: result?.finalPriceOverridden ? 'Preço informado' : 'Preço sugerido', value: result ? formatCurrency(result.finalPrice) : '—', highlight: true }
  ];

  return (
    <Paper sx={{ p: { xs: 2, md: 2.5 }, position: 'relative', overflow: 'hidden' }}>
      {isFetching ? <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} /> : null}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } }}>
        {items.map((item) => (
          <Box key={item.label} sx={{ gridColumn: item.highlight ? { xs: '1 / -1', md: 'auto' } : undefined }}>
            <Typography variant="body2" color="text.secondary" fontWeight={700}>{item.label}</Typography>
            <Typography variant={item.highlight ? 'h4' : 'h5'} color={item.highlight ? 'primary.dark' : 'text.primary'}>{item.value}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

function MemoryRow({ label, value, detail, strong }: { label: string; value: string; detail?: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2} sx={{ py: 0.75 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={strong ? 700 : 500}>{label}</Typography>
        {detail ? <Typography variant="caption" color="text.secondary">{detail}</Typography> : null}
      </Box>
      <Typography fontWeight={strong ? 800 : 600} sx={{ whiteSpace: 'nowrap' }}>{value}</Typography>
    </Stack>
  );
}

function chargeLines(lines: PaintingChargeLine[], labels: Record<string, string>) {
  return lines.map((line) => (
    <MemoryRow
      key={line.id}
      label={`· ${line.name}`}
      value={formatCurrency(line.amount)}
      detail={line.hours > 0 ? `${labels[line.chargeType] ?? line.chargeType} · ${formatHours(line.hours)}` : labels[line.chargeType] ?? line.chargeType}
    />
  ));
}

function CalculationMemory({ result }: { result: PaintingPricingResult }) {
  const rangeLabel = result.sizeRange ? result.sizeRange.name : 'sem faixa';

  return (
    <PageSection title="Memória de cálculo" subtitle={`Parâmetros usados em ${new Date(result.calculatedAtUtc).toLocaleString('pt-BR')}.`}>
      <Stack spacing={2}>
        {result.warnings.map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
        <Box sx={{ display: 'grid', gap: { xs: 0, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
          <Stack divider={<Divider flexItem />}>
            <MemoryRow label="Altura" value={`${formatNumber(result.heightCm)} cm`} detail={`Faixa: ${rangeLabel}`} />
            <MemoryRow label="Nível" value={result.level.name} />
            <MemoryRow label="Complexidade" value={result.complexity.name} />
            <MemoryRow label="Horas base" value={formatHours(result.baseHours)} />
            <MemoryRow label="Multiplicador" value={`${formatNumber(result.complexityMultiplier)}×`} />
            <MemoryRow label="Horas estimadas automaticamente" value={formatHours(result.estimatedHours)} />
            {result.hoursOverridden ? <MemoryRow label="Horas estimadas substituídas" value="Manual" detail="As horas informadas no ajuste manual foram usadas." /> : null}
            {result.addOnHours > 0 ? <MemoryRow label="Horas de adicionais" value={`+ ${formatHours(result.addOnHours)}`} /> : null}
            <MemoryRow label="Horas consideradas" value={formatHours(result.totalHours)} strong />
            <MemoryRow label="Valor/hora" value={formatCurrency(result.hourlyRate)} detail={hourlyRateSourceLabels[result.hourlyRateSource]} />
          </Stack>
          <Stack divider={<Divider flexItem />}>
            <MemoryRow label="Mão de obra" value={formatCurrency(result.laborAmount)} detail={`${formatHours(result.totalHours)} × ${formatCurrency(result.hourlyRate)}`} />
            <MemoryRow
              label="Materiais"
              value={formatCurrency(result.materialsAmount)}
              detail={result.materialsOverridden
                ? 'Informado manualmente'
                : result.materialsMinimumApplied
                  ? `Mínimo de ${formatCurrency(result.minimumMaterialsAmount)} aplicado (${formatPercent(result.materialsPercentage)} ficaria abaixo)`
                  : `${formatPercent(result.materialsPercentage)} da mão de obra`}
            />
            <MemoryRow label="Preparação" value={formatCurrency(result.preparationAmount)} detail={result.preparationOverridden ? 'Informado manualmente' : undefined} />
            {!result.preparationOverridden ? chargeLines(result.preparations, preparationChargeLabels) : null}
            <MemoryRow label="Adicionais" value={formatCurrency(result.addOnsAmount)} detail={result.addOnsOverridden ? 'Informado manualmente' : undefined} />
            {!result.addOnsOverridden ? chargeLines(result.addOns, addOnChargeLabels) : null}
            <MemoryRow label="Custo total de pintura" value={formatCurrency(result.costAmount)} strong />
            {result.marginPercentage > 0 ? <MemoryRow label={`Margem adicional (${formatPercent(result.marginPercentage)})`} value={formatCurrency(result.marginAmount)} /> : null}
            <MemoryRow label="Valor calculado" value={formatCurrency(result.calculatedAmount)} detail={result.minimumPriceApplied ? `Abaixo do mínimo de ${formatCurrency(result.minimumPaintingPrice)}` : undefined} />
            <MemoryRow label="Preço sugerido" value={formatCurrency(result.suggestedPrice)} detail={`Arredondamento: ${roundingLabels[result.rounding]}`} strong />
            {result.finalPriceOverridden ? (
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                <Chip label="Preço informado manualmente" color="warning" size="small" />
                <Typography fontWeight={800}>{formatCurrency(result.finalPrice)}</Typography>
              </Stack>
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </PageSection>
  );
}
