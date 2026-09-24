import { Alert, Box, Chip, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { CurrencyField } from '../../components/CurrencyField';
import type {
  PaintingAddOn,
  PaintingAddOnChargeType,
  PaintingComplexity,
  PaintingLevel,
  PaintingMaterial,
  PaintingMaterialCategory,
  PaintingPreparationChargeType,
  PaintingPreparationService,
  PaintingSettings,
  PaintingSizeRange
} from '../../services/types';
import { PaintingCrudTab, type PaintingCrudColumn } from './PaintingCrudTab';
import {
  addOnChargeLabels,
  formatCurrency,
  formatHeightRange,
  formatHours,
  formatNumber,
  formatPercent,
  materialCategoryLabels,
  preparationChargeLabels,
  toOptionalNumber
} from './paintingPricingShared';

interface TabProps {
  canEdit: boolean;
}

function ActiveSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <FormControlLabel control={<Switch checked={checked} onChange={(event) => onChange(event.target.checked)} />} label={checked ? 'Ativo' : 'Inativo'} />;
}

function nextOrder(items: { order: number }[]) {
  return String(items.reduce((max, item) => Math.max(max, item.order), 0) + 1);
}

function orderError(value: string) {
  const order = Number(value);
  return !Number.isInteger(order) || order < 0 ? 'Informe uma ordem válida (número inteiro maior ou igual a zero).' : null;
}

interface LevelForm {
  name: string;
  description: string;
  useDefaultRate: boolean;
  hourlyRate: number;
  order: string;
  isActive: boolean;
}

export function PaintingLevelsTab({ canEdit, levels, settings }: TabProps & { levels: PaintingLevel[]; settings: PaintingSettings }) {
  const columns: PaintingCrudColumn<PaintingLevel>[] = [
    { label: 'Nível', render: (item) => <Typography fontWeight={700}>{item.name}</Typography>, sortValue: (item) => item.name },
    { label: 'Descrição', render: (item) => <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>{item.description || '—'}</Typography> },
    { label: 'Valor-hora', render: (item) => item.hourlyRate === null || item.hourlyRate === undefined ? `${formatCurrency(item.effectiveHourlyRate)} (padrão)` : formatCurrency(item.hourlyRate), sortValue: (item) => item.effectiveHourlyRate },
    { label: 'Ordem', render: (item) => item.order, sortValue: (item) => item.order }
  ];

  return (
    <PaintingCrudTab<PaintingLevel, LevelForm>
      title="Níveis de pintura"
      subtitle="Definem o valor-hora e a coluna de horas base usada nas faixas de tamanho."
      resource="levels"
      itemLabel="Nível"
      newLabel="Novo nível"
      items={levels}
      columns={columns}
      searchText={(item) => `${item.name} ${item.description}`}
      emptyForm={{ name: '', description: '', useDefaultRate: false, hourlyRate: settings.defaultHourlyRate, order: nextOrder(levels), isActive: true }}
      toForm={(item) => ({
        name: item.name,
        description: item.description,
        useDefaultRate: item.hourlyRate === null || item.hourlyRate === undefined,
        hourlyRate: item.hourlyRate ?? settings.defaultHourlyRate,
        order: String(item.order),
        isActive: item.isActive
      })}
      toPayload={(form) => ({
        name: form.name,
        description: form.description,
        hourlyRate: form.useDefaultRate ? null : form.hourlyRate,
        order: Number(form.order),
        isActive: form.isActive
      })}
      validate={(form) => (!form.name.trim() ? 'Informe o nome do nível.' : orderError(form.order))}
      canEdit={canEdit}
      renderForm={(form, setForm) => (
        <>
          <TextField label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextField label="Descrição" multiline minRows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <FormControlLabel
            control={<Switch checked={form.useDefaultRate} onChange={(event) => setForm({ ...form, useDefaultRate: event.target.checked })} />}
            label={`Usar o valor-hora padrão (${formatCurrency(settings.defaultHourlyRate)})`}
          />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            <CurrencyField label="Valor-hora do nível" value={form.hourlyRate} onValueChange={(value) => setForm({ ...form, hourlyRate: value })} disabled={form.useDefaultRate} fullWidth />
            <TextField label="Ordem" type="number" value={form.order} onChange={(event) => setForm({ ...form, order: event.target.value })} fullWidth />
          </Box>
          <ActiveSwitch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        </>
      )}
    />
  );
}

interface ComplexityForm {
  name: string;
  description: string;
  multiplier: string;
  order: string;
  isActive: boolean;
}

export function PaintingComplexitiesTab({ canEdit, complexities }: TabProps & { complexities: PaintingComplexity[] }) {
  const columns: PaintingCrudColumn<PaintingComplexity>[] = [
    { label: 'Complexidade', render: (item) => <Typography fontWeight={700}>{item.name}</Typography>, sortValue: (item) => item.name },
    { label: 'Características', render: (item) => <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>{item.description || '—'}</Typography> },
    { label: 'Multiplicador', render: (item) => `${formatNumber(item.multiplier)}×`, sortValue: (item) => item.multiplier },
    { label: 'Ordem', render: (item) => item.order, sortValue: (item) => item.order }
  ];

  return (
    <PaintingCrudTab<PaintingComplexity, ComplexityForm>
      title="Complexidades"
      subtitle="O multiplicador é aplicado sobre as horas base da faixa de tamanho."
      resource="complexities"
      itemLabel="Complexidade"
      newLabel="Nova complexidade"
      items={complexities}
      columns={columns}
      searchText={(item) => `${item.name} ${item.description}`}
      emptyForm={{ name: '', description: '', multiplier: '1', order: nextOrder(complexities), isActive: true }}
      toForm={(item) => ({ name: item.name, description: item.description, multiplier: String(item.multiplier), order: String(item.order), isActive: item.isActive })}
      toPayload={(form) => ({ name: form.name, description: form.description, multiplier: toOptionalNumber(form.multiplier) ?? 0, order: Number(form.order), isActive: form.isActive })}
      validate={(form) => {
        if (!form.name.trim()) {
          return 'Informe o nome da complexidade.';
        }

        return (toOptionalNumber(form.multiplier) ?? 0) <= 0 ? 'O multiplicador deve ser maior que zero.' : orderError(form.order);
      }}
      canEdit={canEdit}
      renderForm={(form, setForm) => (
        <>
          <TextField label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextField label="Características" multiline minRows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            <TextField label="Multiplicador" type="number" inputProps={{ step: 0.05, min: 0 }} value={form.multiplier} onChange={(event) => setForm({ ...form, multiplier: event.target.value })} helperText="Ex.: 1,25 = 25% a mais de horas." fullWidth />
            <TextField label="Ordem" type="number" value={form.order} onChange={(event) => setForm({ ...form, order: event.target.value })} fullWidth />
          </Box>
          <ActiveSwitch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        </>
      )}
    />
  );
}

interface SizeRangeForm {
  name: string;
  minHeightCm: string;
  maxHeightCm: string;
  requiresManualReview: boolean;
  order: string;
  isActive: boolean;
  hours: Record<string, string>;
}

export function PaintingSizeRangesTab({ canEdit, sizeRanges, levels }: TabProps & { sizeRanges: PaintingSizeRange[]; levels: PaintingLevel[] }) {
  const activeLevels = levels.filter((level) => level.isActive);
  const hoursFor = (range: PaintingSizeRange, levelId: string) => range.hours.find((item) => item.levelId === levelId)?.hours;

  const columns: PaintingCrudColumn<PaintingSizeRange>[] = [
    {
      label: 'Faixa',
      render: (item) => (
        <Stack spacing={0.25}>
          <Typography fontWeight={700}>{item.name}</Typography>
          {item.requiresManualReview ? <Chip size="small" color="warning" label="Avaliação manual" sx={{ alignSelf: 'flex-start' }} /> : null}
        </Stack>
      ),
      sortValue: (item) => item.minHeightCm
    },
    { label: 'Altura', render: (item) => formatHeightRange(item.minHeightCm, item.maxHeightCm), sortValue: (item) => item.minHeightCm },
    ...activeLevels.map((level): PaintingCrudColumn<PaintingSizeRange> => ({
      label: level.name,
      align: 'right',
      render: (item) => {
        const hours = hoursFor(item, level.id);
        return hours === undefined ? '—' : formatHours(hours);
      },
      sortValue: (item) => hoursFor(item, level.id) ?? 0
    }))
  ];

  return (
    <PaintingCrudTab<PaintingSizeRange, SizeRangeForm>
      title="Faixas de tamanho"
      subtitle="Horas base estimadas por faixa de altura e nível de pintura."
      resource="size-ranges"
      itemLabel="Faixa"
      newLabel="Nova faixa"
      items={sizeRanges}
      columns={columns}
      searchText={(item) => item.name}
      headerNote={<Alert severity="info">Cada faixa cobre alturas <strong>acima</strong> da mínima <strong>até</strong> a máxima (inclusive). Deixe a máxima vazia para a última faixa, sem limite.</Alert>}
      emptyForm={{ name: '', minHeightCm: '', maxHeightCm: '', requiresManualReview: false, order: String(sizeRanges.reduce((max, item) => Math.max(max, item.order), 0) + 1), isActive: true, hours: {} }}
      toForm={(item) => ({
        name: item.name,
        minHeightCm: String(item.minHeightCm),
        maxHeightCm: item.maxHeightCm === null || item.maxHeightCm === undefined ? '' : String(item.maxHeightCm),
        requiresManualReview: item.requiresManualReview,
        order: String(item.order),
        isActive: item.isActive,
        hours: Object.fromEntries(item.hours.map((hours) => [hours.levelId, String(hours.hours)]))
      })}
      toPayload={(form) => ({
        name: form.name,
        minHeightCm: toOptionalNumber(form.minHeightCm) ?? 0,
        maxHeightCm: toOptionalNumber(form.maxHeightCm),
        requiresManualReview: form.requiresManualReview,
        order: Number(form.order),
        isActive: form.isActive,
        hours: levels
          .filter((level) => toOptionalNumber(form.hours[level.id] ?? '') !== null)
          .map((level) => ({ levelId: level.id, hours: toOptionalNumber(form.hours[level.id]) }))
      })}
      validate={(form) => {
        if (!form.name.trim()) {
          return 'Informe o nome da faixa.';
        }

        const min = toOptionalNumber(form.minHeightCm) ?? 0;
        const max = toOptionalNumber(form.maxHeightCm);
        if (min < 0) {
          return 'A altura mínima não pode ser negativa.';
        }

        if (max !== null && min >= max) {
          return 'A altura mínima não pode superar a altura máxima.';
        }

        if (Object.values(form.hours).some((value) => (toOptionalNumber(value) ?? 0) < 0)) {
          return 'A quantidade de horas não pode ser negativa.';
        }

        return orderError(form.order);
      }}
      canEdit={canEdit}
      renderForm={(form, setForm) => (
        <>
          <TextField label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} helperText="Ex.: 16 a 20 cm" />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' } }}>
            <TextField label="Acima de (cm)" type="number" value={form.minHeightCm} onChange={(event) => setForm({ ...form, minHeightCm: event.target.value })} fullWidth />
            <TextField label="Até (cm)" type="number" value={form.maxHeightCm} onChange={(event) => setForm({ ...form, maxHeightCm: event.target.value })} helperText="Vazio = sem limite" fullWidth />
            <TextField label="Ordem" type="number" value={form.order} onChange={(event) => setForm({ ...form, order: event.target.value })} fullWidth />
          </Box>
          <Typography fontWeight={700}>Horas base por nível</Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            {levels.map((level) => (
              <TextField
                key={level.id}
                label={level.isActive ? level.name : `${level.name} (inativo)`}
                type="number"
                inputProps={{ step: 0.25, min: 0 }}
                value={form.hours[level.id] ?? ''}
                onChange={(event) => setForm({ ...form, hours: { ...form.hours, [level.id]: event.target.value } })}
                InputProps={{ endAdornment: <Typography color="text.secondary">h</Typography> }}
                fullWidth
              />
            ))}
          </Box>
          <FormControlLabel
            control={<Switch checked={form.requiresManualReview} onChange={(event) => setForm({ ...form, requiresManualReview: event.target.checked })} />}
            label='Sinalizar "Recomendada avaliação manual"'
          />
          <ActiveSwitch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        </>
      )}
    />
  );
}

interface PreparationForm {
  name: string;
  description: string;
  chargeType: PaintingPreparationChargeType;
  value: number;
  percentage: string;
  estimatedHours: string;
  isActive: boolean;
}

function preparationValueLabel(item: PaintingPreparationService) {
  switch (item.chargeType) {
    case 'Percentage':
      return `${formatPercent(item.value)} da mão de obra`;
    case 'Hourly':
      return `${formatHours(item.estimatedHours)} × ${item.value > 0 ? formatCurrency(item.value) : 'valor-hora do cálculo'}`;
    case 'Manual':
      return item.value > 0 ? `Sugestão ${formatCurrency(item.value)}` : 'Informado na simulação';
    default:
      return formatCurrency(item.value);
  }
}

export function PaintingPreparationServicesTab({ canEdit, services }: TabProps & { services: PaintingPreparationService[] }) {
  const columns: PaintingCrudColumn<PaintingPreparationService>[] = [
    { label: 'Serviço', render: (item) => <Typography fontWeight={700}>{item.name}</Typography>, sortValue: (item) => item.name },
    { label: 'Descrição', render: (item) => <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>{item.description || '—'}</Typography> },
    { label: 'Cobrança', render: (item) => preparationChargeLabels[item.chargeType], sortValue: (item) => preparationChargeLabels[item.chargeType] },
    { label: 'Valor', render: (item) => preparationValueLabel(item), sortValue: (item) => item.value }
  ];

  return (
    <PaintingCrudTab<PaintingPreparationService, PreparationForm>
      title="Serviços de preparação"
      subtitle="Limpeza, lixamento, montagem e demais etapas antes da pintura."
      resource="preparation-services"
      itemLabel="Serviço"
      newLabel="Novo serviço"
      items={services}
      columns={columns}
      searchText={(item) => `${item.name} ${item.description}`}
      emptyForm={{ name: '', description: '', chargeType: 'FixedAmount', value: 0, percentage: '0', estimatedHours: '0', isActive: true }}
      toForm={(item) => ({
        name: item.name,
        description: item.description,
        chargeType: item.chargeType,
        value: item.chargeType === 'Percentage' ? 0 : item.value,
        percentage: item.chargeType === 'Percentage' ? String(item.value) : '0',
        estimatedHours: String(item.estimatedHours),
        isActive: item.isActive
      })}
      toPayload={(form) => ({
        name: form.name,
        description: form.description,
        chargeType: form.chargeType,
        value: form.chargeType === 'Percentage' ? toOptionalNumber(form.percentage) ?? 0 : form.value,
        estimatedHours: toOptionalNumber(form.estimatedHours) ?? 0,
        isActive: form.isActive
      })}
      validate={(form) => {
        if (!form.name.trim()) {
          return 'Informe o nome do serviço.';
        }

        return (toOptionalNumber(form.percentage) ?? 0) < 0 || (toOptionalNumber(form.estimatedHours) ?? 0) < 0 ? 'Valores e horas não podem ser negativos.' : null;
      }}
      canEdit={canEdit}
      renderForm={(form, setForm) => (
        <>
          <TextField label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextField label="Descrição" multiline minRows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <TextField select label="Tipo de cobrança" value={form.chargeType} onChange={(event) => setForm({ ...form, chargeType: event.target.value as PaintingPreparationChargeType })}>
            {(Object.keys(preparationChargeLabels) as PaintingPreparationChargeType[]).map((type) => <MenuItem key={type} value={type}>{preparationChargeLabels[type]}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            {form.chargeType === 'Percentage' ? (
              <TextField label="Percentual sobre a mão de obra" type="number" value={form.percentage} onChange={(event) => setForm({ ...form, percentage: event.target.value })} InputProps={{ endAdornment: <Typography color="text.secondary">%</Typography> }} fullWidth />
            ) : (
              <CurrencyField
                label={form.chargeType === 'Hourly' ? 'Valor-hora do serviço' : form.chargeType === 'Manual' ? 'Valor sugerido' : 'Valor'}
                value={form.value}
                onValueChange={(value) => setForm({ ...form, value })}
                helperText={form.chargeType === 'Hourly' ? 'R$ 0,00 usa o valor-hora do cálculo.' : form.chargeType === 'Manual' ? 'Pode ser alterado em cada simulação.' : undefined}
                fullWidth
              />
            )}
            {form.chargeType === 'Hourly' ? (
              <TextField label="Horas estimadas" type="number" inputProps={{ step: 0.25, min: 0 }} value={form.estimatedHours} onChange={(event) => setForm({ ...form, estimatedHours: event.target.value })} fullWidth />
            ) : null}
          </Box>
          <ActiveSwitch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        </>
      )}
    />
  );
}

interface MaterialForm {
  name: string;
  category: PaintingMaterialCategory;
  unit: string;
  unitCost: number;
  defaultQuantity: string;
  isActive: boolean;
}

export function PaintingMaterialsTab({ canEdit, materials }: TabProps & { materials: PaintingMaterial[] }) {
  const columns: PaintingCrudColumn<PaintingMaterial>[] = [
    { label: 'Material', render: (item) => <Typography fontWeight={700}>{item.name}</Typography>, sortValue: (item) => item.name },
    { label: 'Categoria', render: (item) => materialCategoryLabels[item.category], sortValue: (item) => materialCategoryLabels[item.category] },
    { label: 'Unidade', render: (item) => item.unit || '—' },
    { label: 'Valor unitário', align: 'right', render: (item) => formatCurrency(item.unitCost), sortValue: (item) => item.unitCost },
    { label: 'Qtd. padrão', align: 'right', render: (item) => formatNumber(item.defaultQuantity), sortValue: (item) => item.defaultQuantity }
  ];

  return (
    <PaintingCrudTab<PaintingMaterial, MaterialForm>
      title="Materiais e consumíveis"
      subtitle="Cadastro opcional para custo real no futuro."
      resource="materials"
      itemLabel="Material"
      newLabel="Novo material"
      items={materials}
      columns={columns}
      searchText={(item) => `${item.name} ${materialCategoryLabels[item.category]} ${item.unit}`}
      headerNote={<Alert severity="info">Nesta versão o cálculo usa o percentual de materiais das configurações gerais. Este cadastro não altera o preço da simulação.</Alert>}
      emptyForm={{ name: '', category: 'Tinta', unit: '', unitCost: 0, defaultQuantity: '1', isActive: true }}
      toForm={(item) => ({ name: item.name, category: item.category, unit: item.unit, unitCost: item.unitCost, defaultQuantity: String(item.defaultQuantity), isActive: item.isActive })}
      toPayload={(form) => ({ name: form.name, category: form.category, unit: form.unit, unitCost: form.unitCost, defaultQuantity: toOptionalNumber(form.defaultQuantity) ?? 0, isActive: form.isActive })}
      validate={(form) => (!form.name.trim() ? 'Informe o nome do material.' : (toOptionalNumber(form.defaultQuantity) ?? 0) < 0 ? 'A quantidade padrão não pode ser negativa.' : null)}
      canEdit={canEdit}
      renderForm={(form, setForm) => (
        <>
          <TextField label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            <TextField select label="Categoria" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as PaintingMaterialCategory })} fullWidth>
              {(Object.keys(materialCategoryLabels) as PaintingMaterialCategory[]).map((category) => <MenuItem key={category} value={category}>{materialCategoryLabels[category]}</MenuItem>)}
            </TextField>
            <TextField label="Unidade" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} helperText="Ex.: ml, un, g" fullWidth />
            <CurrencyField label="Valor unitário" value={form.unitCost} onValueChange={(value) => setForm({ ...form, unitCost: value })} fullWidth />
            <TextField label="Quantidade padrão" type="number" value={form.defaultQuantity} onChange={(event) => setForm({ ...form, defaultQuantity: event.target.value })} fullWidth />
          </Box>
          <ActiveSwitch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        </>
      )}
    />
  );
}

interface AddOnForm {
  name: string;
  description: string;
  chargeType: PaintingAddOnChargeType;
  value: number;
  percentage: string;
  additionalHours: string;
  isActive: boolean;
}

function addOnValueLabel(item: PaintingAddOn) {
  switch (item.chargeType) {
    case 'Percentage':
      return `${formatPercent(item.percentage)} da mão de obra`;
    case 'AdditionalHours':
      return `+ ${formatHours(item.additionalHours)}`;
    case 'Manual':
      return item.value > 0 ? `Sugestão ${formatCurrency(item.value)}` : 'Informado na simulação';
    default:
      return formatCurrency(item.value);
  }
}

export function PaintingAddOnsTab({ canEdit, addOns }: TabProps & { addOns: PaintingAddOn[] }) {
  const columns: PaintingCrudColumn<PaintingAddOn>[] = [
    { label: 'Adicional', render: (item) => <Typography fontWeight={700}>{item.name}</Typography>, sortValue: (item) => item.name },
    { label: 'Descrição', render: (item) => <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>{item.description || '—'}</Typography> },
    { label: 'Cobrança', render: (item) => addOnChargeLabels[item.chargeType], sortValue: (item) => addOnChargeLabels[item.chargeType] },
    { label: 'Valor', render: (item) => addOnValueLabel(item) }
  ];

  return (
    <PaintingCrudTab<PaintingAddOn, AddOnForm>
      title="Adicionais de pintura"
      subtitle="Técnicas e efeitos que somam valor fixo, percentual ou horas ao cálculo."
      resource="add-ons"
      itemLabel="Adicional"
      newLabel="Novo adicional"
      items={addOns}
      columns={columns}
      searchText={(item) => `${item.name} ${item.description}`}
      emptyForm={{ name: '', description: '', chargeType: 'FixedAmount', value: 0, percentage: '0', additionalHours: '0', isActive: true }}
      toForm={(item) => ({
        name: item.name,
        description: item.description,
        chargeType: item.chargeType,
        value: item.value,
        percentage: String(item.percentage),
        additionalHours: String(item.additionalHours),
        isActive: item.isActive
      })}
      toPayload={(form) => ({
        name: form.name,
        description: form.description,
        chargeType: form.chargeType,
        value: form.value,
        percentage: toOptionalNumber(form.percentage) ?? 0,
        additionalHours: toOptionalNumber(form.additionalHours) ?? 0,
        isActive: form.isActive
      })}
      validate={(form) => {
        if (!form.name.trim()) {
          return 'Informe o nome do adicional.';
        }

        return (toOptionalNumber(form.percentage) ?? 0) < 0 || (toOptionalNumber(form.additionalHours) ?? 0) < 0 ? 'Valores e horas não podem ser negativos.' : null;
      }}
      canEdit={canEdit}
      renderForm={(form, setForm) => (
        <>
          <TextField label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextField label="Descrição" multiline minRows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <TextField select label="Tipo de cobrança" value={form.chargeType} onChange={(event) => setForm({ ...form, chargeType: event.target.value as PaintingAddOnChargeType })}>
            {(Object.keys(addOnChargeLabels) as PaintingAddOnChargeType[]).map((type) => <MenuItem key={type} value={type}>{addOnChargeLabels[type]}</MenuItem>)}
          </TextField>
          {form.chargeType === 'Percentage' ? (
            <TextField label="Percentual sobre a mão de obra" type="number" value={form.percentage} onChange={(event) => setForm({ ...form, percentage: event.target.value })} InputProps={{ endAdornment: <Typography color="text.secondary">%</Typography> }} />
          ) : null}
          {form.chargeType === 'AdditionalHours' ? (
            <TextField label="Horas adicionais" type="number" inputProps={{ step: 0.25, min: 0 }} value={form.additionalHours} onChange={(event) => setForm({ ...form, additionalHours: event.target.value })} helperText="Somadas às horas estimadas e cobradas pelo valor-hora." />
          ) : null}
          {form.chargeType === 'FixedAmount' || form.chargeType === 'Manual' ? (
            <CurrencyField
              label={form.chargeType === 'Manual' ? 'Valor sugerido' : 'Valor'}
              value={form.value}
              onValueChange={(value) => setForm({ ...form, value })}
              helperText={form.chargeType === 'Manual' ? 'Pode ser alterado em cada simulação.' : undefined}
            />
          ) : null}
          <ActiveSwitch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        </>
      )}
    />
  );
}
