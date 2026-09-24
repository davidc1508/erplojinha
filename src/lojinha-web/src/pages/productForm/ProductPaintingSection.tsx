import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { CurrencyField } from '../../components/CurrencyField';
import { PageSection } from '../../components/PageSection';
import type {
  PaintingAddOn,
  PaintingBaseMode,
  PaintingPreparationService,
  PaintingPriceApplication,
  PaintingPricingMode,
  PaintingPricingOverview,
  ProductPaintingCalculation,
  ProductPaintingRequest
} from '../../services/types';
import {
  formatCurrency,
  formatHours,
  formatNumber,
  formatPercent,
  hourlyRateSourceLabels,
  roundingLabels
} from '../paintingPricing/paintingPricingShared';

export type PaintingOverrideKey = 'hoursOverride' | 'hourlyRateOverride' | 'materialsAmountOverride' | 'preparationAmountOverride' | 'addOnsAmountOverride' | 'marginPercentageOverride' | 'finalPriceOverride';

const overrideKeys: PaintingOverrideKey[] = ['hoursOverride', 'hourlyRateOverride', 'materialsAmountOverride', 'preparationAmountOverride', 'addOnsAmountOverride', 'marginPercentageOverride', 'finalPriceOverride'];

const modeOptions: { value: PaintingPricingMode; label: string; description: string }[] = [
  { value: 'Automatic', label: 'Automática', description: 'Usa integralmente os parâmetros do módulo de pintura.' },
  { value: 'SemiAutomatic', label: 'Semiautomática', description: 'Calcula pelo módulo e deixa ajustar horas, valor-hora, materiais, preparação, adicionais e margem.' },
  { value: 'Manual', label: 'Manual', description: 'Você informa custo e preço. Nível, complexidade e observações ficam no histórico.' }
];

const applicationOptions: { value: PaintingPriceApplication; label: string; description: string }[] = [
  { value: 'IncorporateCost', label: 'Incorporar ao custo', description: 'O custo da pintura entra no custo do produto e passa pelo markup geral.' },
  { value: 'IncorporatePrice', label: 'Incorporar ao preço', description: 'O preço de venda da pintura é somado direto ao preço final.' },
  { value: 'ReferenceOnly', label: 'Somente referência', description: 'Calcula e mostra, mas não altera custo nem preço do produto.' },
  { value: 'ManualAmount', label: 'Valor manual', description: 'Você informa quanto da pintura entra no custo do produto.' }
];

const baseModeOptions: { value: PaintingBaseMode; label: string }[] = [
  { value: 'SameLevel', label: 'Mesmo nível' },
  { value: 'OtherLevel', label: 'Outro nível' },
  { value: 'ManualAmount', label: 'Valor manual' },
  { value: 'AddOn', label: 'Adicional cadastrado' }
];

export const applicationNotes: Record<PaintingPriceApplication, string> = {
  IncorporateCost: 'Custo da pintura somado ao custo do produto',
  IncorporatePrice: 'Preço da pintura somado ao preço final',
  ReferenceOnly: 'Só referência: não altera o produto',
  ManualAmount: 'Valor manual incorporado ao custo'
};

function preparationRule(service: PaintingPreparationService) {
  switch (service.chargeType) {
    case 'Hourly':
      return `${formatHours(service.estimatedHours)} × ${service.value > 0 ? formatCurrency(service.value) : 'valor-hora'}`;
    case 'Percentage':
      return `${formatPercent(service.value)} da mão de obra`;
    case 'Manual':
      return 'valor manual';
    default:
      return formatCurrency(service.value);
  }
}

function addOnRule(addOn: PaintingAddOn) {
  switch (addOn.chargeType) {
    case 'Percentage':
      return `${formatPercent(addOn.percentage)} da mão de obra`;
    case 'AdditionalHours':
      return `+ ${formatHours(addOn.additionalHours)}`;
    case 'Manual':
      return 'valor manual';
    default:
      return formatCurrency(addOn.value);
  }
}

function toNumber(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function CustomChip() {
  return <Chip label="Personalizado" size="small" color="primary" sx={{ height: 22, fontWeight: 800 }} />;
}

function OptionCard({ selected, label, description, onClick }: { selected: boolean; label: string; description: string; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        display: 'block',
        textAlign: 'left',
        borderRadius: 4,
        p: 1.5,
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'rgba(71,51,40,0.18)',
        bgcolor: selected ? 'rgba(217,107,135,0.08)' : 'background.paper'
      }}
    >
      <Typography fontWeight={800}>{label}</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
    </ButtonBase>
  );
}

function CalcCard({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.7)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
        <Typography fontWeight={700}>{title}</Typography>
        {aside}
      </Stack>
      <Box sx={{ mt: 1 }}>{children}</Box>
    </Paper>
  );
}

function MemoryRow({ label, value, detail, strong, custom }: { label: string; value: string; detail?: string; strong?: boolean; custom?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2} sx={{ py: 0.75, borderBottom: '1px solid rgba(71,51,40,0.08)' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{label}</Typography>
        {detail ? <Typography variant="caption" color="text.secondary">{detail}</Typography> : null}
      </Box>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
        {custom ? <CustomChip /> : null}
        <Typography variant="body2" fontWeight={strong ? 800 : 600}>{value}</Typography>
      </Stack>
    </Stack>
  );
}

interface ProductPaintingSectionProps {
  painting: ProductPaintingRequest;
  onChange: (patch: Partial<ProductPaintingRequest>, affectsCalculation?: boolean) => void;
  overview?: PaintingPricingOverview;
  productHeightCm: number;
  suppliers: { id: string; name: string }[];
  calculation?: ProductPaintingCalculation | null;
  isCalculating: boolean;
  calculationError?: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  showOutdatedBanner: boolean;
  showKeptNote: boolean;
  storedAtLabel?: string;
  onKeepStored: () => void;
  onOpenRecalculation: () => void;
  disabled?: boolean;
}

export function ProductPaintingSection({
  painting,
  onChange,
  overview,
  productHeightCm,
  suppliers,
  calculation,
  isCalculating,
  calculationError,
  expanded,
  onToggleExpanded,
  showOutdatedBanner,
  showKeptNote,
  storedAtLabel,
  onKeepStored,
  onOpenRecalculation,
  disabled
}: ProductPaintingSectionProps) {
  const levels = overview?.levels ?? [];
  const complexities = overview?.complexities ?? [];
  const activeLevels = levels.filter((level) => level.isActive || level.id === painting.levelId || level.id === painting.baseLevelId);
  const activeComplexities = complexities.filter((complexity) => complexity.isActive || complexity.id === painting.complexityId);
  const preparationServices = (overview?.preparationServices ?? []).filter((service) => service.isActive || painting.preparations.some((selection) => selection.id === service.id));
  const addOns = (overview?.addOns ?? []).filter((addOn) => addOn.isActive || painting.addOns.some((selection) => selection.id === addOn.id));
  const selectedComplexity = complexities.find((complexity) => complexity.id === painting.complexityId);
  const details = calculation?.details ?? null;
  const isSemi = painting.mode === 'SemiAutomatic';
  const isManual = painting.mode === 'Manual';
  const isOutsourced = painting.execution === 'Outsourced';
  const hasOverrides = isSemi && overrideKeys.some((key) => painting[key] !== null && painting[key] !== undefined);
  const summary = details ? `${details.level.name} • ${details.complexity.name} • ${formatNumber(details.totalHours)}h` : null;

  function toggleOverride(key: PaintingOverrideKey, currentValue: number) {
    onChange({ [key]: painting[key] === null || painting[key] === undefined ? currentValue : null } as Partial<ProductPaintingRequest>);
  }

  function togglePreparation(service: PaintingPreparationService) {
    const selected = painting.preparations.some((selection) => selection.id === service.id);
    onChange({
      preparations: selected
        ? painting.preparations.filter((selection) => selection.id !== service.id)
        : [...painting.preparations, { id: service.id, manualAmount: service.chargeType === 'Manual' ? service.value : null, hours: service.chargeType === 'Hourly' ? service.estimatedHours : null }]
    });
  }

  function toggleAddOn(addOn: PaintingAddOn) {
    const selected = painting.addOns.some((selection) => selection.id === addOn.id);
    onChange({
      addOns: selected
        ? painting.addOns.filter((selection) => selection.id !== addOn.id)
        : [...painting.addOns, { id: addOn.id, manualAmount: addOn.chargeType === 'Manual' ? addOn.value : null, hours: null }]
    });
  }

  const overrideSwitch = (key: PaintingOverrideKey, label: string, currentValue: number) => (
    <FormControlLabel
      sx={{ mt: 1 }}
      control={<Switch size="small" checked={painting[key] !== null && painting[key] !== undefined} onChange={() => toggleOverride(key, currentValue)} disabled={disabled} />}
      label={<Typography variant="body2">{label}</Typography>}
    />
  );

  return (
    <PageSection
      title="3 · Pintura"
      subtitle="Opcional. Usa os parâmetros de Precificação > Pintura."
      action={(
        <FormControlLabel
          control={<Switch checked={painting.enabled} onChange={(event) => onChange({ enabled: event.target.checked }, true)} disabled={disabled} />}
          label={<Typography fontWeight={700}>Produto possui pintura</Typography>}
          sx={{ mr: 0 }}
        />
      )}
    >
      {!painting.enabled ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(125,101,88,0.07)' }}>
          Sem pintura: nenhum cálculo é feito e nenhum custo de pintura entra no produto.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {showOutdatedBanner ? (
            <Alert
              severity="warning"
              icon={<WarningAmberRoundedIcon />}
              action={(
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button color="inherit" size="small" onClick={onKeepStored}>Manter valores atuais</Button>
                  <Button color="warning" variant="contained" size="small" onClick={onOpenRecalculation}>Recalcular com valores atuais</Button>
                </Stack>
              )}
            >
              <strong>Existem parâmetros de pintura mais recentes disponíveis.</strong> Este produto usa o cálculo salvo{storedAtLabel ? ` em ${storedAtLabel}` : ''}. Nada muda sem sua ação.
            </Alert>
          ) : null}
          {showKeptNote ? <Typography variant="body2" color="text.secondary">Mantendo os valores salvos{storedAtLabel ? ` em ${storedAtLabel}` : ''}. Use “Recalcular pintura” quando quiser comparar.</Typography> : null}
          {painting.needsReview ? (
            <Alert severity="error" variant="outlined" action={<Button color="inherit" size="small" onClick={() => onChange({ needsReview: false }, false)}>Marcar como revisada</Button>}>
              <strong>Necessita revisão:</strong> pintura copiada de outro produto. Confira altura, nível e adicionais antes de salvar.
            </Alert>
          ) : null}

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
            <TextField
              label="Altura para cálculo"
              type="number"
              value={painting.heightCm || ''}
              onChange={(event) => onChange({ heightCm: toNumber(event.target.value), heightOverridden: true })}
              InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }}
              helperText={painting.heightOverridden
                ? <>Sobrescrita. <ButtonBase onClick={() => onChange({ heightCm: productHeightCm, heightOverridden: false })} sx={{ color: 'primary.dark', fontWeight: 700, fontSize: 'inherit', textDecoration: 'underline', verticalAlign: 'baseline' }}>Usar a do produto ({formatNumber(productHeightCm)} cm)</ButtonBase></>
                : 'Da altura do produto.'}
              disabled={disabled}
              fullWidth
            />
            <TextField select label="Nível de pintura" value={painting.levelId ?? ''} onChange={(event) => onChange({ levelId: event.target.value || null })} helperText={details?.sizeRange ? `Faixa ${details.sizeRange.name}` : ' '} disabled={disabled} fullWidth>
              {activeLevels.map((level) => <MenuItem key={level.id} value={level.id} disabled={!level.isActive}>{level.name}{level.isActive ? '' : ' (inativo)'}</MenuItem>)}
            </TextField>
            <TextField select label="Complexidade" value={painting.complexityId ?? ''} onChange={(event) => onChange({ complexityId: event.target.value || null })} helperText={selectedComplexity ? `Multiplicador: ${formatNumber(selectedComplexity.multiplier)}×` : ' '} disabled={disabled} fullWidth>
              {activeComplexities.map((complexity) => <MenuItem key={complexity.id} value={complexity.id} disabled={!complexity.isActive}>{complexity.name}{complexity.isActive ? '' : ' (inativa)'}</MenuItem>)}
            </TextField>
            <TextField
              label="Horas"
              value={details ? formatHours(details.totalHours) : '—'}
              helperText={details ? `Estimativa: ${formatHours(details.estimatedHours)}` : ' '}
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(71,51,40,0.05)' } }}
              fullWidth
            />
          </Box>

          {details?.sizeRange?.requiresManualReview ? <Alert severity="warning">Recomendada avaliação manual para esta faixa de tamanho.</Alert> : null}
          {details?.warnings.filter((warning) => warning !== 'Recomendada avaliação manual.').map((warning) => <Alert key={warning} severity="info">{warning}</Alert>)}
          {calculationError ? <Alert severity="warning">{calculationError}</Alert> : null}

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, position: 'relative', overflow: 'hidden', borderColor: 'rgba(217,107,135,0.3)' }}>
            {isCalculating ? <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} /> : null}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={700}>Pintura estimada (custo)</Typography>
                <Typography variant="h5">{calculation ? formatCurrency(calculation.costAmount) : '—'}</Typography>
                <Typography variant="caption" color="text.secondary">{summary ?? (isManual ? 'Valores informados manualmente' : 'Informe altura, nível e complexidade')}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={700}>Preço de venda da pintura</Typography>
                <Typography variant="h6" color="primary.dark">{calculation ? formatCurrency(calculation.priceUsed) : '—'}</Typography>
                <Typography variant="caption" color="text.secondary">{applicationNotes[painting.application]}</Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <Button variant="outlined" onClick={onOpenRecalculation} disabled={disabled || isManual} sx={{ flex: { xs: 1, md: 'none' } }}>Recalcular pintura</Button>
                <Button variant="contained" onClick={onToggleExpanded} sx={{ flex: { xs: 1, md: 'none' } }}>{expanded ? 'Ocultar detalhes' : 'Detalhar cálculo'}</Button>
              </Stack>
            </Stack>
          </Paper>

          <Collapse in={expanded} unmountOnExit>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <div>
                <Typography fontWeight={800} sx={{ mb: 1 }}>Forma de precificação da pintura</Typography>
                <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' } }}>
                  {modeOptions.map((option) => (
                    <OptionCard key={option.value} selected={painting.mode === option.value} label={option.label} description={option.description} onClick={() => !disabled && onChange({ mode: option.value })} />
                  ))}
                </Box>
              </div>

              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'end' }}>
                <div>
                  <Typography fontWeight={800} sx={{ mb: 1 }}>Execução da pintura</Typography>
                  <ToggleButtonGroup exclusive fullWidth value={painting.execution} onChange={(_, value) => value && onChange({ execution: value })} disabled={disabled} size="small">
                    <ToggleButton value="Internal" sx={{ fontWeight: 700 }}>Interna</ToggleButton>
                    <ToggleButton value="Outsourced" sx={{ fontWeight: 700 }}>Terceirizada</ToggleButton>
                  </ToggleButtonGroup>
                </div>
                <TextField
                  label="Personagens / elementos principais"
                  type="number"
                  value={painting.characterCount}
                  onChange={(event) => onChange({ characterCount: Math.max(1, Math.round(toNumber(event.target.value)) || 1) }, false)}
                  helperText={painting.characterCount > 1 ? 'Com mais de um personagem, marque o adicional correspondente em Técnicas / adicionais.' : 'Informativo. Não aplica fórmula por personagem.'}
                  disabled={disabled}
                  fullWidth
                />
              </Box>

              {painting.mode === 'Automatic' ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(125,101,88,0.07)' }}>
                  Automática: horas, valor-hora, materiais e margem vêm do módulo. Para ajustar algum valor neste produto, escolha Semiautomática.
                </Typography>
              ) : null}

              {!isManual && !isOutsourced ? (
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={800}>Cálculo</Typography>
                    {hasOverrides ? (
                      <Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={() => onChange(Object.fromEntries(overrideKeys.map((key) => [key, null])) as Partial<ProductPaintingRequest>)}>Restaurar padrão</Button>
                    ) : null}
                  </Stack>
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
                    <CalcCard title="Horas" aside={<Typography variant="body2" color="text.secondary">Estimativa {details ? formatHours(details.estimatedHours) : '—'}</Typography>}>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="h6">{details ? formatHours(details.totalHours) : '—'}</Typography>
                        <Typography variant="body2" color="text.secondary">utilizado</Typography>
                        {isSemi && painting.hoursOverride != null ? <CustomChip /> : null}
                      </Stack>
                      {isSemi ? overrideSwitch('hoursOverride', 'Alterar horas manualmente', details?.estimatedHours ?? 0) : null}
                      {isSemi && painting.hoursOverride != null ? (
                        <TextField label="Horas neste produto" type="number" size="small" value={painting.hoursOverride} onChange={(event) => onChange({ hoursOverride: toNumber(event.target.value) })} inputProps={{ step: 0.25, min: 0 }} sx={{ mt: 1 }} disabled={disabled} fullWidth />
                      ) : null}
                    </CalcCard>

                    <CalcCard title="Valor-hora" aside={<Typography variant="body2" color="text.secondary">{details ? hourlyRateSourceLabels[details.hourlyRateSource] : ''}</Typography>}>
                      <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
                        {isSemi && painting.hourlyRateOverride != null && details ? (
                          <Typography variant="body2" color="text.disabled" sx={{ textDecoration: 'line-through' }}>
                            {formatCurrency(levels.find((level) => level.id === painting.levelId)?.effectiveHourlyRate ?? 0)} padrão
                          </Typography>
                        ) : null}
                        <Typography variant="h6">{details ? formatCurrency(details.hourlyRate) : '—'}</Typography>
                        {isSemi && painting.hourlyRateOverride != null ? <CustomChip /> : null}
                      </Stack>
                      {isSemi ? overrideSwitch('hourlyRateOverride', 'Usar outro valor neste produto', details?.hourlyRate ?? 0) : null}
                      {isSemi && painting.hourlyRateOverride != null ? (
                        <CurrencyField label="Valor-hora neste produto" size="small" value={painting.hourlyRateOverride} onValueChange={(value) => onChange({ hourlyRateOverride: value })} helperText="Não altera a configuração global." sx={{ mt: 1 }} disabled={disabled} fullWidth />
                      ) : null}
                    </CalcCard>

                    <CalcCard title="Materiais e consumíveis">
                      {details ? (
                        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                          <div><Typography variant="caption" color="text.secondary">Base</Typography><Typography fontWeight={800}>{formatCurrency(details.laborAmount)}</Typography></div>
                          <div><Typography variant="caption" color="text.secondary">{formatPercent(details.materialsPercentage)}</Typography><Typography fontWeight={800}>{formatCurrency(details.materialsByPercentageAmount)}</Typography></div>
                          <div><Typography variant="caption" color="text.secondary">Utilizado</Typography><Typography fontWeight={800}>{formatCurrency(details.materialsAmount)}</Typography></div>
                        </Box>
                      ) : <Typography color="text.secondary">—</Typography>}
                      {details?.materialsMinimumApplied ? <Typography variant="caption" color="warning.dark">Mínimo de {formatCurrency(details.minimumMaterialsAmount)} aplicado.</Typography> : null}
                      {isSemi && painting.materialsAmountOverride != null ? <Box sx={{ mt: 0.5 }}><CustomChip /></Box> : null}
                      {isSemi ? overrideSwitch('materialsAmountOverride', 'Informar material manualmente', details?.materialsAmount ?? 0) : null}
                      {isSemi && painting.materialsAmountOverride != null ? (
                        <CurrencyField label="Materiais neste produto" size="small" value={painting.materialsAmountOverride} onValueChange={(value) => onChange({ materialsAmountOverride: value })} sx={{ mt: 1 }} disabled={disabled} fullWidth />
                      ) : null}
                    </CalcCard>

                    <CalcCard title="Margem e preço">
                      <Typography variant="body2" color="text.secondary">
                        Margem {details ? formatPercent(details.marginPercentage) : '—'} · preço comercial {details ? formatCurrency(details.suggestedPrice) : '—'}
                        {details ? ` (${roundingLabels[details.rounding].toLowerCase()})` : ''}
                      </Typography>
                      {isSemi ? overrideSwitch('marginPercentageOverride', 'Usar outra margem', details?.marginPercentage ?? 0) : null}
                      {isSemi && painting.marginPercentageOverride != null ? (
                        <TextField label="Margem (%)" type="number" size="small" value={painting.marginPercentageOverride} onChange={(event) => onChange({ marginPercentageOverride: toNumber(event.target.value) })} sx={{ mt: 1 }} disabled={disabled} fullWidth />
                      ) : null}
                      {isSemi ? overrideSwitch('finalPriceOverride', 'Informar preço utilizado', calculation?.priceUsed ?? 0) : null}
                      {isSemi && painting.finalPriceOverride != null ? (
                        <CurrencyField label="Preço utilizado" size="small" value={painting.finalPriceOverride} onValueChange={(value) => onChange({ finalPriceOverride: value })} sx={{ mt: 1 }} disabled={disabled} fullWidth />
                      ) : null}
                    </CalcCard>
                  </Box>

                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
                    <CalcCard title="Preparação da peça" aside={<Typography fontWeight={800}>{details ? formatCurrency(details.preparationAmount) : '—'}</Typography>}>
                      <Stack divider={<Divider flexItem />}>
                        {preparationServices.map((service) => {
                          const selection = painting.preparations.find((item) => item.id === service.id);
                          const line = details?.preparations.find((item) => item.id === service.id);
                          return (
                            <Box key={service.id} sx={{ py: 0.25 }}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <FormControlLabel sx={{ flex: 1, mr: 0 }} control={<Checkbox checked={Boolean(selection)} onChange={() => togglePreparation(service)} disabled={disabled} />} label={<Typography variant="body2">{service.name}</Typography>} />
                                <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>{line ? formatCurrency(line.amount) : preparationRule(service)}</Typography>
                              </Stack>
                              {selection && service.chargeType === 'Manual' ? (
                                <CurrencyField label="Valor" size="small" value={selection.manualAmount ?? 0} onValueChange={(value) => onChange({ preparations: painting.preparations.map((item) => item.id === service.id ? { ...item, manualAmount: value } : item) })} sx={{ mb: 1 }} disabled={disabled} fullWidth />
                              ) : null}
                              {selection && service.chargeType === 'Hourly' ? (
                                <TextField label="Horas" type="number" size="small" value={selection.hours ?? service.estimatedHours} onChange={(event) => onChange({ preparations: painting.preparations.map((item) => item.id === service.id ? { ...item, hours: toNumber(event.target.value) } : item) })} inputProps={{ step: 0.25, min: 0 }} sx={{ mb: 1 }} disabled={disabled} fullWidth />
                              ) : null}
                            </Box>
                          );
                        })}
                      </Stack>
                      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'minmax(0, 1fr) 130px', mt: 1.5 }}>
                        <TextField label="Preparação adicional" size="small" placeholder="Descrição" value={painting.extraPreparationDescription ?? ''} onChange={(event) => onChange({ extraPreparationDescription: event.target.value })} disabled={disabled} />
                        <CurrencyField label="Valor" size="small" value={painting.extraPreparationAmount} onValueChange={(value) => onChange({ extraPreparationAmount: value })} disabled={disabled} />
                      </Box>
                      {isSemi ? overrideSwitch('preparationAmountOverride', 'Informar total de preparação', details?.preparationAmount ?? 0) : null}
                      {isSemi && painting.preparationAmountOverride != null ? (
                        <CurrencyField label="Total de preparação" size="small" value={painting.preparationAmountOverride} onValueChange={(value) => onChange({ preparationAmountOverride: value })} sx={{ mt: 1 }} disabled={disabled} fullWidth />
                      ) : null}
                    </CalcCard>

                    <CalcCard title="Técnicas / adicionais" aside={<Typography fontWeight={800}>{details ? formatCurrency(details.addOnsAmount) : '—'}</Typography>}>
                      <Box sx={{ display: 'grid', columnGap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                        {addOns.map((addOn) => {
                          const selection = painting.addOns.find((item) => item.id === addOn.id);
                          return (
                            <Box key={addOn.id} sx={{ borderBottom: '1px solid rgba(71,51,40,0.06)' }}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <FormControlLabel sx={{ flex: 1, mr: 0 }} control={<Checkbox checked={Boolean(selection)} onChange={() => toggleAddOn(addOn)} disabled={disabled} />} label={<Typography variant="body2">{addOn.name}</Typography>} />
                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{addOnRule(addOn)}</Typography>
                              </Stack>
                              {selection && addOn.chargeType === 'Manual' ? (
                                <CurrencyField label="Valor" size="small" value={selection.manualAmount ?? 0} onValueChange={(value) => onChange({ addOns: painting.addOns.map((item) => item.id === addOn.id ? { ...item, manualAmount: value } : item) })} sx={{ mb: 1 }} disabled={disabled} fullWidth />
                              ) : null}
                            </Box>
                          );
                        })}
                      </Box>
                      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'minmax(0, 1fr) 80px 120px', mt: 1.5 }}>
                        <TextField label="Adicional livre" size="small" placeholder="Descrição" value={painting.freeAddOnDescription ?? ''} onChange={(event) => onChange({ freeAddOnDescription: event.target.value })} disabled={disabled} />
                        <TextField label="Qtd." size="small" type="number" value={painting.freeAddOnQuantity} onChange={(event) => onChange({ freeAddOnQuantity: Math.max(1, toNumber(event.target.value)) })} disabled={disabled} />
                        <CurrencyField label="Valor" size="small" value={painting.freeAddOnUnitAmount} onValueChange={(value) => onChange({ freeAddOnUnitAmount: value })} disabled={disabled} />
                      </Box>
                      {isSemi ? overrideSwitch('addOnsAmountOverride', 'Informar total de adicionais', details?.addOnsAmount ?? 0) : null}
                      {isSemi && painting.addOnsAmountOverride != null ? (
                        <CurrencyField label="Total de adicionais" size="small" value={painting.addOnsAmountOverride} onValueChange={(value) => onChange({ addOnsAmountOverride: value })} sx={{ mt: 1 }} disabled={disabled} fullWidth />
                      ) : null}
                    </CalcCard>
                  </Box>

                  <CalcCard title="Base necessita pintura?" aside={(
                    <ToggleButtonGroup exclusive size="small" value={painting.baseNeedsPainting ? 'sim' : 'nao'} onChange={(_, value) => value && onChange({ baseNeedsPainting: value === 'sim' })} disabled={disabled}>
                      <ToggleButton value="nao" sx={{ px: 2, fontWeight: 700 }}>Não</ToggleButton>
                      <ToggleButton value="sim" sx={{ px: 2, fontWeight: 700 }}>Sim</ToggleButton>
                    </ToggleButtonGroup>
                  )}>
                    {painting.baseNeedsPainting ? (
                      <Stack spacing={1.5} sx={{ mt: 1 }}>
                        <ToggleButtonGroup exclusive size="small" value={painting.baseMode} onChange={(_, value) => value && onChange({ baseMode: value })} disabled={disabled} sx={{ flexWrap: 'wrap' }}>
                          {baseModeOptions.map((option) => <ToggleButton key={option.value} value={option.value} sx={{ fontWeight: 700 }}>{option.label}</ToggleButton>)}
                        </ToggleButtonGroup>
                        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, alignItems: 'center' }}>
                          {painting.baseMode === 'SameLevel' || painting.baseMode === 'OtherLevel' ? (
                            <TextField label="Horas da base" type="number" size="small" value={painting.baseHours} onChange={(event) => onChange({ baseHours: toNumber(event.target.value) })} inputProps={{ step: 0.25, min: 0 }} disabled={disabled} />
                          ) : null}
                          {painting.baseMode === 'OtherLevel' ? (
                            <TextField select label="Nível da base" size="small" value={painting.baseLevelId ?? ''} onChange={(event) => onChange({ baseLevelId: event.target.value || null })} disabled={disabled}>
                              {activeLevels.map((level) => <MenuItem key={level.id} value={level.id} disabled={!level.isActive}>{level.name}</MenuItem>)}
                            </TextField>
                          ) : null}
                          {painting.baseMode === 'ManualAmount' ? (
                            <CurrencyField label="Valor da base" size="small" value={painting.baseManualAmount} onValueChange={(value) => onChange({ baseManualAmount: value })} disabled={disabled} />
                          ) : null}
                          {painting.baseMode === 'AddOn' ? (
                            <TextField select label="Adicional da base" size="small" value={painting.baseAddOnId ?? ''} onChange={(event) => onChange({ baseAddOnId: event.target.value || null })} disabled={disabled}>
                              {addOns.map((addOn) => <MenuItem key={addOn.id} value={addOn.id}>{addOn.name}</MenuItem>)}
                            </TextField>
                          ) : null}
                          <Typography variant="body2">Base: <strong>{details ? formatCurrency(details.baseAmount) : '—'}</strong></Typography>
                        </Box>
                      </Stack>
                    ) : null}
                  </CalcCard>
                </Stack>
              ) : null}

              {!isManual && isOutsourced ? (
                <CalcCard title="Pintura terceirizada">
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Fornecedor do cadastro de Fornecedores. Horas e valor-hora não se aplicam.</Typography>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' } }}>
                    <TextField select label="Fornecedor" value={painting.outsourcedSupplierId ?? ''} onChange={(event) => onChange({ outsourcedSupplierId: event.target.value || null }, false)} disabled={disabled} fullWidth>
                      <MenuItem value="">— Não informado —</MenuItem>
                      {suppliers.map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>)}
                    </TextField>
                    <CurrencyField label="Custo cobrado" value={painting.outsourcedChargedAmount} onValueChange={(value) => onChange({ outsourcedChargedAmount: value })} disabled={disabled} fullWidth />
                    <CurrencyField label="Frete" value={painting.outsourcedFreightAmount} onValueChange={(value) => onChange({ outsourcedFreightAmount: value })} disabled={disabled} fullWidth />
                    <CurrencyField label="Outros custos" value={painting.outsourcedOtherCosts} onValueChange={(value) => onChange({ outsourcedOtherCosts: value })} disabled={disabled} fullWidth />
                    <CurrencyField label="Preço incorporado ao produto" value={painting.outsourcedIncorporatedPrice ?? 0} onValueChange={(value) => onChange({ outsourcedIncorporatedPrice: value > 0 ? value : null })} helperText="Vazio usa o preço sugerido pelo módulo." disabled={disabled} fullWidth />
                  </Box>
                </CalcCard>
              ) : null}

              {isManual ? (
                <CalcCard title="Valores informados">
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Sem cálculo automático. Nível, complexidade e observações ficam registrados para histórico.</Typography>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
                    <CurrencyField label="Custo da pintura" value={painting.manualCost} onValueChange={(value) => onChange({ manualCost: value })} disabled={disabled} fullWidth />
                    <CurrencyField label="Preço de venda da pintura" value={painting.manualPrice} onValueChange={(value) => onChange({ manualPrice: value })} disabled={disabled} fullWidth />
                  </Box>
                </CalcCard>
              ) : null}

              {details ? (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, bgcolor: 'rgba(251,243,239,0.9)', borderColor: 'transparent' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5} sx={{ mb: 1 }}>
                    <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>Memória de cálculo</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {calculation?.fromStoredSnapshot ? `Valores salvos em ${new Date(calculation.calculatedAtUtc).toLocaleString('pt-BR')}` : 'Estes valores são salvos junto com o produto'}
                    </Typography>
                  </Stack>
                  <Box sx={{ display: 'grid', columnGap: 4, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
                    {details.isOutsourced ? (
                      <div>
                        <MemoryRow label="Execução" value="Terceirizada" />
                        <MemoryRow label="Custos do terceiro" value={formatCurrency(details.outsourcedAmount)} detail="Custo cobrado + frete + outros" />
                      </div>
                    ) : (
                      <div>
                        <MemoryRow label="Altura utilizada" value={`${formatNumber(details.heightCm)} cm`} detail={painting.heightOverridden ? `Sobrescrita (produto: ${formatNumber(productHeightCm)} cm)` : 'Altura do produto'} />
                        <MemoryRow label="Faixa" value={details.sizeRange?.name ?? 'sem faixa'} />
                        <MemoryRow label="Nível" value={details.level.name} />
                        <MemoryRow label="Complexidade" value={`${details.complexity.name} — ${formatNumber(details.complexityMultiplier)}×`} />
                        <MemoryRow label="Horas base" value={formatHours(details.baseHours)} />
                        <MemoryRow label="Horas calculadas" value={formatHours(details.estimatedHours)} />
                        <MemoryRow label="Horas utilizadas" value={formatHours(details.totalHours)} detail={details.addOnHours > 0 ? `inclui ${formatHours(details.addOnHours)} de adicionais` : undefined} strong custom={details.hoursOverridden} />
                        <MemoryRow label="Valor/hora" value={formatCurrency(details.hourlyRate)} detail={hourlyRateSourceLabels[details.hourlyRateSource]} custom={details.hourlyRateSource === 'Override'} />
                      </div>
                    )}
                    <div>
                      {!details.isOutsourced ? (
                        <>
                          <MemoryRow label="Mão de obra" value={formatCurrency(details.laborAmount)} detail={`${formatHours(details.totalHours)} × ${formatCurrency(details.hourlyRate)}`} />
                          <MemoryRow label="Materiais" value={formatCurrency(details.materialsAmount)} detail={details.materialsOverridden ? 'informado neste produto' : details.materialsMinimumApplied ? `mínimo de ${formatCurrency(details.minimumMaterialsAmount)} aplicado` : `${formatPercent(details.materialsPercentage)} da mão de obra`} custom={details.materialsOverridden} />
                          <MemoryRow label="Preparação" value={formatCurrency(details.preparationAmount)} detail={details.preparations.map((line) => line.name).join(' · ') || undefined} custom={details.preparationOverridden} />
                          <MemoryRow label="Adicionais" value={formatCurrency(details.addOnsAmount)} detail={details.addOns.map((line) => line.name).join(' · ') || undefined} custom={details.addOnsOverridden} />
                          {details.baseAmount > 0 ? <MemoryRow label="Base da peça" value={formatCurrency(details.baseAmount)} /> : null}
                        </>
                      ) : null}
                      <MemoryRow label="Custo da pintura" value={formatCurrency(details.costAmount)} strong />
                      <MemoryRow label="Margem" value={formatPercent(details.marginPercentage)} />
                      <MemoryRow label="Preço sugerido da pintura" value={formatCurrency(details.calculatedAmount)} detail={details.minimumPriceApplied ? `mínimo de pintura ${formatCurrency(details.minimumPaintingPrice)} aplicado` : undefined} />
                      <MemoryRow label="Preço comercial sugerido" value={formatCurrency(details.suggestedPrice)} detail={`arredondamento: ${roundingLabels[details.rounding].toLowerCase()}`} strong />
                      <MemoryRow label="Preço utilizado" value={formatCurrency(details.finalPrice)} strong custom={details.finalPriceOverridden} />
                    </div>
                  </Box>
                </Paper>
              ) : null}

              <div>
                <Typography fontWeight={800} sx={{ mb: 1 }}>Aplicar pintura ao preço do produto</Typography>
                <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
                  {applicationOptions.map((option) => (
                    <OptionCard key={option.value} selected={painting.application === option.value} label={option.label} description={option.description} onClick={() => !disabled && onChange({ application: option.value }, false)} />
                  ))}
                </Box>
                {painting.application === 'ManualAmount' ? (
                  <CurrencyField label="Valor incorporado ao custo" value={painting.manualIncorporatedAmount} onValueChange={(value) => onChange({ manualIncorporatedAmount: value }, false)} sx={{ mt: 2, maxWidth: 320 }} disabled={disabled} fullWidth />
                ) : null}
              </div>

              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
                <TextField label="Observações da pintura" multiline minRows={3} value={painting.notes ?? ''} onChange={(event) => onChange({ notes: event.target.value }, false)} placeholder="Ex.: acabamento fosco, armadura metálica, olhos brilhantes, base com efeito pedra" helperText="Não altera cálculos." disabled={disabled} fullWidth />
                <TextField label="Referências de cores" multiline minRows={3} value={painting.colorReferences ?? ''} onChange={(event) => onChange({ colorReferences: event.target.value }, false)} placeholder="Códigos de cor, marcas de tinta, links de referência" helperText="Opcional." disabled={disabled} fullWidth />
              </Box>
            </Stack>
          </Collapse>
        </Stack>
      )}
    </PageSection>
  );
}

export function PaintedBadge({ detail, size = 'medium' }: { detail?: string | null; size?: 'small' | 'medium' }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Chip icon={<BrushRoundedIcon sx={{ fontSize: 16 }} />} label="Pintado" size="small" sx={{ bgcolor: '#efebf7', color: '#4d3f75', fontWeight: 800, '& .MuiChip-icon': { color: '#4d3f75' }, height: size === 'small' ? 22 : 26 }} />
      {detail ? <Typography variant="caption" color="text.secondary" noWrap>{detail}</Typography> : null}
    </Stack>
  );
}
