import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CurrencyField } from '../components/CurrencyField';
import { SearchSelectField } from '../components/SearchSelectField';
import { PageSection } from '../components/PageSection';
import { outsourcedProductionsApi, productsApi } from '../services/api';
import { durationPartsToMinutes, minutesToDurationParts } from '../services/product';

const emptyForm = {
  name: '',
  description: '',
  categoryId: '',
  producerSupplierId: '',
  ownerSupplierId: '',
  itemsPerPlate: 1,
  estimatedPrintTimeMinutes: 60,
  heightCentimeters: 0,
  lengthMetersUsed: 5,
  tariffPerKwh: 0.95,
  finishingPercentage: 2,
  additionalCost: 0,
  printerProfileId: '',
  filaments: [{ filamentProfileId: '', weightGrams: 0 }] as { filamentProfileId: string; weightGrams: number }[],
  marketplaceFeeId: '',
  desiredMarkup: 2.7,
  productionFeePercentage: 50
};

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function OutsourcedProductionFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [duration, setDuration] = useState(() => minutesToDurationParts(emptyForm.estimatedPrintTimeMinutes));

  const { data: metadata } = useQuery({ queryKey: ['products-metadata'], queryFn: productsApi.getMetadata });
  const { data: production } = useQuery({
    queryKey: ['outsourced-production', id],
    queryFn: () => outsourcedProductionsApi.getById(id!),
    enabled: isEditing
  });

  const defaultFilamentId = useMemo(() => {
    const pla120 = (metadata?.filaments ?? []).find((item) => item.name.trim().toLowerCase() === 'pla - 120');
    return pla120?.id ?? '';
  }, [metadata?.filaments]);

  useEffect(() => {
    if (!production) return;
    setForm({
      name: production.name,
      description: production.description,
      categoryId: production.categoryId ?? '',
      producerSupplierId: production.producerSupplierId,
      ownerSupplierId: production.ownerSupplierId,
      itemsPerPlate: production.itemsPerPlate,
      estimatedPrintTimeMinutes: production.estimatedPrintTimeMinutes,
      heightCentimeters: production.heightCentimeters,
      lengthMetersUsed: production.lengthMetersUsed,
      tariffPerKwh: production.tariffPerKwh,
      finishingPercentage: production.finishingPercentage,
      additionalCost: production.additionalCost,
      printerProfileId: production.printerProfileId ?? '',
      filaments: production.filaments.length > 0
        ? production.filaments.map((f) => ({ filamentProfileId: f.filamentProfileId, weightGrams: f.weightGrams }))
        : [{ filamentProfileId: '', weightGrams: 0 }],
      marketplaceFeeId: production.marketplaceFeeId ?? '',
      desiredMarkup: production.desiredMarkup,
      productionFeePercentage: production.productionFeePercentage
    });
    setDuration(minutesToDurationParts(production.estimatedPrintTimeMinutes));
  }, [production]);

  useEffect(() => {
    if (!isEditing && !production && defaultFilamentId) {
      setForm((c) => ({
        ...c,
        filaments: c.filaments[0].filamentProfileId ? c.filaments : [{ filamentProfileId: defaultFilamentId, weightGrams: 0 }]
      }));
    }
  }, [defaultFilamentId, isEditing, production]);

  const pricingPayload = useMemo(() => ({
    ...form,
    categoryId: form.categoryId || null,
    printerProfileId: form.printerProfileId || null,
    filaments: form.filaments.filter((f) => f.filamentProfileId),
    marketplaceFeeId: form.marketplaceFeeId || null,
    producerSupplierId: form.producerSupplierId || '00000000-0000-0000-0000-000000000000',
    ownerSupplierId: form.ownerSupplierId || '00000000-0000-0000-0000-000000000000'
  }), [form]);

  const { data: pricing } = useQuery({
    queryKey: ['outsourced-production-pricing-preview', pricingPayload],
    queryFn: () => outsourcedProductionsApi.previewPricing(pricingPayload),
    enabled: true
  });

  const supplierCost = useMemo(() => {
    if (!pricing) return 0;
    return pricing.totalCost * (1 + form.productionFeePercentage / 100);
  }, [pricing, form.productionFeePercentage]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        printerProfileId: form.printerProfileId || null,
        filaments: form.filaments.filter((f) => f.filamentProfileId),
        marketplaceFeeId: form.marketplaceFeeId || null,
        desiredMarkup: Number(form.desiredMarkup)
      };
      if (isEditing) {
        return outsourcedProductionsApi.update(id!, payload);
      }
      return outsourcedProductionsApi.create(payload);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outsourced-productions'] });
      navigate(`/producao-terceirizada/${result.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFeedback(msg ?? 'Erro ao salvar a produção terceirizada.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.producerSupplierId || !form.ownerSupplierId) {
      setFeedback('Selecione o fornecedor produtor e o destinatário.');
      return;
    }
    saveMutation.mutate();
  };

  const setField = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm((c) => ({ ...c, [key]: value }));

  const updateFilament = (index: number, field: string, value: string | number) => {
    setForm((c) => {
      const filaments = c.filaments.map((f, i) => i === index ? { ...f, [field]: value } : f);
      return { ...c, filaments };
    });
  };

  const addFilament = () => setForm((c) => ({ ...c, filaments: [...c.filaments, { filamentProfileId: '', weightGrams: 0 }] }));
  const removeFilament = (index: number) => setForm((c) => ({ ...c, filaments: c.filaments.filter((_, i) => i !== index) }));

  const title = isEditing ? 'Editar Produção Terceirizada' : 'Nova Produção Terceirizada';

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/producao-terceirizada')}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700}>{title}</Typography>
          <Typography color="text.secondary" fontSize={14}>
            Os custos são calculados automaticamente com base nos parâmetros de produção
          </Typography>
        </Box>
      </Stack>

      {feedback && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFeedback(null)}>{feedback}</Alert>}

      <Stack spacing={3}>
        {/* Identificação */}
        <PageSection title="Identificação">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Nome do Produto"
                fullWidth
                required
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Categoria"
                fullWidth
                value={form.categoryId}
                onChange={(e) => setField('categoryId', e.target.value)}
              >
                <MenuItem value="">— Nenhuma —</MenuItem>
                {(metadata?.categories ?? []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Descrição"
                fullWidth
                multiline
                rows={2}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </Grid>
          </Grid>
        </PageSection>

        {/* Produtor e Destinatário */}
        <PageSection title="Produtor e Destinatário">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <SearchSelectField
                label="Produtor (quem fabrica)"
                options={(metadata?.suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))}
                value={form.producerSupplierId}
                onChange={(v) => setField('producerSupplierId', v)}
                minQueryLength={0}
                placeholder="Selecione o produtor"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <SearchSelectField
                label="Destinatário (quem vai vender)"
                options={(metadata?.suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))}
                value={form.ownerSupplierId}
                onChange={(v) => setField('ownerSupplierId', v)}
                minQueryLength={0}
                placeholder="Selecione o destinatário"
              />
            </Grid>
          </Grid>
        </PageSection>

        {/* Parâmetros de Produção */}
        <PageSection title="Parâmetros de Produção">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Impressora"
                fullWidth
                value={form.printerProfileId}
                onChange={(e) => setField('printerProfileId', e.target.value)}
              >
                <MenuItem value="">— Nenhuma —</MenuItem>
                {(metadata?.printers ?? []).map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Marketplace"
                fullWidth
                value={form.marketplaceFeeId}
                onChange={(e) => setField('marketplaceFeeId', e.target.value)}
              >
                <MenuItem value="">— Nenhum —</MenuItem>
                {(metadata?.marketplaces ?? []).map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={6} sm={3}>
              <TextField
                label="Tempo Impressão (h)"
                type="number"
                fullWidth
                value={duration.hours}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  const next = { ...duration, hours: h };
                  setDuration(next);
                  setField('estimatedPrintTimeMinutes', durationPartsToMinutes(next.hours, next.minutes, next.seconds));
                }}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Minutos"
                type="number"
                fullWidth
                value={duration.minutes}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  const next = { ...duration, minutes: m };
                  setDuration(next);
                  setField('estimatedPrintTimeMinutes', durationPartsToMinutes(next.hours, next.minutes, next.seconds));
                }}
                inputProps={{ min: 0, max: 59 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Itens por Placa"
                type="number"
                fullWidth
                value={form.itemsPerPlate}
                onChange={(e) => setField('itemsPerPlate', Number(e.target.value))}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Tarifa kWh (R$)"
                type="number"
                fullWidth
                value={form.tariffPerKwh}
                onChange={(e) => setField('tariffPerKwh', Number(e.target.value))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>

            <Grid item xs={6} sm={4}>
              <TextField
                label="Acabamento (%)"
                type="number"
                fullWidth
                value={form.finishingPercentage}
                onChange={(e) => setField('finishingPercentage', Number(e.target.value))}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Altura (cm)"
                type="number"
                fullWidth
                value={form.heightCentimeters}
                onChange={(e) => setField('heightCentimeters', Number(e.target.value))}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Comprimento metro (m)"
                type="number"
                fullWidth
                value={form.lengthMetersUsed}
                onChange={(e) => setField('lengthMetersUsed', Number(e.target.value))}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Grid>
          </Grid>
        </PageSection>

        {/* Filamentos */}
        <PageSection title="Filamentos">
          <Stack spacing={1.5}>
            {form.filaments.map((f, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField
                  select
                  label="Filamento"
                  value={f.filamentProfileId}
                  onChange={(e) => updateFilament(i, 'filamentProfileId', e.target.value)}
                  sx={{ flex: 2 }}
                >
                  <MenuItem value="">— Selecione —</MenuItem>
                  {(metadata?.filaments ?? []).map((fl) => (
                    <MenuItem key={fl.id} value={fl.id}>{fl.name}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Peso (g)"
                  type="number"
                  value={f.weightGrams}
                  onChange={(e) => updateFilament(i, 'weightGrams', Number(e.target.value))}
                  sx={{ flex: 1 }}
                  inputProps={{ min: 0, step: 0.1 }}
                />
                <IconButton onClick={() => removeFilament(i)} color="error" disabled={form.filaments.length === 1}>
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </Stack>
            ))}
            <Button startIcon={<AddRoundedIcon />} onClick={addFilament} sx={{ alignSelf: 'flex-start' }}>
              Adicionar filamento
            </Button>
          </Stack>
        </PageSection>

        {/* Markup e Custos Adicionais */}
        <PageSection title="Markup e Custos">
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Markup desejado"
                type="number"
                fullWidth
                value={form.desiredMarkup}
                onChange={(e) => setField('desiredMarkup', Number(e.target.value))}
                inputProps={{ min: 1, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <CurrencyField
                label="Custo adicional (R$)"
                value={form.additionalCost}
                onValueChange={(v) => setField('additionalCost', v)}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Taxa de Produção (%)"
                type="number"
                fullWidth
                value={form.productionFeePercentage}
                onChange={(e) => setField('productionFeePercentage', Number(e.target.value))}
                inputProps={{ min: 0, step: 1 }}
                helperText="Percentual sobre o custo de produção cobrado do fornecedor"
              />
            </Grid>
          </Grid>
        </PageSection>

        {/* Resumo de Custos */}
        {pricing && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1.5}>Resumo de Custos</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6} sm={3}>
                <Typography fontSize={12} color="text.secondary">Material</Typography>
                <Typography fontWeight={600}>{formatCurrency(pricing.materialCost)}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography fontSize={12} color="text.secondary">Energia</Typography>
                <Typography fontWeight={600}>{formatCurrency(pricing.energyCost)}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography fontSize={12} color="text.secondary">Acabamento</Typography>
                <Typography fontWeight={600}>{formatCurrency(pricing.finishingCost)}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography fontSize={12} color="text.secondary">Manutenção</Typography>
                <Typography fontWeight={600}>{formatCurrency(pricing.maintenanceCost)}</Typography>
              </Grid>
            </Grid>
            <Divider sx={{ my: 1.5 }} />
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography fontSize={13} color="text.secondary">Custo de Produção</Typography>
                <Typography variant="h6" fontWeight={700}>{formatCurrency(pricing.totalCost)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography fontSize={13} color="text.secondary">
                  Custo para o Fornecedor ({form.productionFeePercentage}%)
                </Typography>
                <Typography variant="h6" fontWeight={700} color="primary.main">
                  {formatCurrency(supplierCost)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button variant="outlined" onClick={() => navigate('/producao-terceirizada')}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveRoundedIcon />}
            disabled={saveMutation.isLoading}
          >
            {saveMutation.isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
