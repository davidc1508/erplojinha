import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Grid,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CurrencyField } from '../components/CurrencyField';
import { SearchSelectField } from '../components/SearchSelectField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { productsApi } from '../services/api';
import { durationPartsToMinutes, minutesToDurationParts } from '../services/product';

const emptyForm = {
  name: '',
  sku: '',
  description: '',
  categoryId: '',
  supplierId: '',
  generateProductionExpenseOnStockEntry: false,
  currentStock: 0,
  minimumStock: 2,
  itemsPerPlate: 1,
  estimatedPrintTimeMinutes: 60,
  heightCentimeters: 0,
  lengthMetersUsed: 5,
  tariffPerKwh: 0.95,
  finishingPercentage: 2,
  commissionPercentage: 0,
  additionalCost: 0,
  printerProfileId: '',
  filaments: [{ filamentProfileId: '', weightGrams: 0 }] as { filamentProfileId: string; weightGrams: number }[],
  marketplaceFeeId: '',
  desiredMarkup: 2.7,
  salePrice: '',
  isBudget: false
};

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function capitalizeFirstLetter(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ProductFormPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isBudgetMode = location.pathname.startsWith('/orcamentos');
  const cloneFromId = !id ? searchParams.get('clonar') : null;
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm, isBudget: isBudgetMode });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [duration, setDuration] = useState(() => minutesToDurationParts(emptyForm.estimatedPrintTimeMinutes));

  const { data: metadata } = useQuery({ queryKey: ['products-metadata'], queryFn: productsApi.getMetadata });
  const { data: product } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getById(id!),
    enabled: isEditing
  });
  const { data: cloneSource } = useQuery({
    queryKey: ['product', cloneFromId],
    queryFn: () => productsApi.getById(cloneFromId!),
    enabled: Boolean(cloneFromId)
  });
  const { data: priceHistory = [] } = useQuery({
    queryKey: ['product-price-history', id],
    queryFn: () => productsApi.getPriceHistory(id!),
    enabled: isEditing
  });

  useEffect(() => {
    if (!product) {
      return;
    }

    setForm({
      name: product.name,
      sku: product.sku,
      description: product.description,
      categoryId: product.categoryId,
      supplierId: product.supplierId ?? '',
      generateProductionExpenseOnStockEntry: product.generateProductionExpenseOnStockEntry,
      currentStock: product.currentStock,
      minimumStock: product.minimumStock,
      itemsPerPlate: product.itemsPerPlate,
      estimatedPrintTimeMinutes: product.estimatedPrintTimeMinutes,
      heightCentimeters: product.heightCentimeters,
      lengthMetersUsed: product.lengthMetersUsed,
      tariffPerKwh: product.tariffPerKwh,
      finishingPercentage: product.finishingPercentage,
      commissionPercentage: product.commissionPercentage,
      additionalCost: product.additionalCost,
      printerProfileId: product.printerProfileId ?? '',
        filaments: (product.filaments ?? []).map((f) => ({ filamentProfileId: f.filamentProfileId, weightGrams: f.weightGrams })),
      marketplaceFeeId: product.marketplaceFeeId ?? '',
      desiredMarkup: product.desiredMarkup,
      salePrice: String(product.salePrice),
      isBudget: product.lifecycleStatus === 'Orcamento'
    });
    setDuration(minutesToDurationParts(product.estimatedPrintTimeMinutes));
    setDirty(false);
  }, [product]);

  useEffect(() => {
    if (!cloneSource) {
      return;
    }

    setForm({
      name: `${cloneSource.name} (cópia)`,
      sku: '',
      description: cloneSource.description,
      categoryId: cloneSource.categoryId,
      supplierId: cloneSource.supplierId ?? '',
      generateProductionExpenseOnStockEntry: cloneSource.generateProductionExpenseOnStockEntry,
      currentStock: 0,
      minimumStock: cloneSource.minimumStock,
      itemsPerPlate: cloneSource.itemsPerPlate,
      estimatedPrintTimeMinutes: cloneSource.estimatedPrintTimeMinutes,
      heightCentimeters: cloneSource.heightCentimeters,
      lengthMetersUsed: cloneSource.lengthMetersUsed,
      tariffPerKwh: cloneSource.tariffPerKwh,
      finishingPercentage: cloneSource.finishingPercentage,
      commissionPercentage: cloneSource.commissionPercentage,
      additionalCost: cloneSource.additionalCost,
      printerProfileId: cloneSource.printerProfileId ?? '',
        filaments: (cloneSource.filaments ?? []).map((f) => ({ filamentProfileId: f.filamentProfileId, weightGrams: f.weightGrams })),
      marketplaceFeeId: cloneSource.marketplaceFeeId ?? '',
      desiredMarkup: cloneSource.desiredMarkup,
      salePrice: String(cloneSource.salePrice),
      isBudget: cloneSource.lifecycleStatus === 'Orcamento' || isBudgetMode
    });
    setDuration(minutesToDurationParts(cloneSource.estimatedPrintTimeMinutes));
    setDirty(true);
  }, [cloneSource, isBudgetMode]);

  useEffect(() => {
    if (!isEditing && !cloneFromId) {
      setForm((current) => ({ ...current, isBudget: isBudgetMode }));
    }
  }, [cloneFromId, isBudgetMode, isEditing]);

  useEffect(() => {
    if (!isEditing && isSupplier && session?.supplierId && form.supplierId !== session.supplierId) {
      setForm((current) => ({ ...current, supplierId: session.supplierId ?? '' }));
    }
  }, [form.supplierId, isEditing, isSupplier, session?.supplierId]);

  const pricingPayload = useMemo(() => ({
    ...form,
    categoryId: form.categoryId || null,
    supplierId: (isSupplier ? session?.supplierId : form.supplierId) || null,
    printerProfileId: form.printerProfileId || null,
      filaments: form.filaments.filter((f) => f.filamentProfileId),
    marketplaceFeeId: form.marketplaceFeeId || null,
    costPrice: null,
    commissionPercentage: Number(form.commissionPercentage),
    salePrice: form.salePrice === '' ? null : Number(form.salePrice)
  }), [form, isSupplier, session?.supplierId]);

  const { data: pricing } = useQuery({
    queryKey: ['product-pricing-preview', pricingPayload],
    queryFn: () => productsApi.previewPricing(pricingPayload),
    enabled: Boolean((pricingPayload.categoryId ?? '').length > 0 && (!isEditing || product))
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        categoryId: form.categoryId,
        supplierId: (isSupplier ? session?.supplierId : form.supplierId) || null,
        printerProfileId: form.printerProfileId || null,
          filaments: form.filaments.filter((f) => f.filamentProfileId),
        marketplaceFeeId: form.marketplaceFeeId || null,
        commissionPercentage: Number(form.commissionPercentage),
        desiredMarkup: Number(form.desiredMarkup),
        costPrice: null,
        isBudget: form.isBudget,
        salePrice: form.salePrice === '' ? null : Number(form.salePrice)
      };

      return isEditing
        ? productsApi.update(id!, payload)
        : productsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      navigate(form.isBudget ? '/orcamentos' : '/produtos', { state: { preserveState: true } });
    },
    onError: () => {
      setFeedback('Nao foi possivel salvar o produto com os dados informados.');
    }
  });

  const effectiveSalePrice = form.salePrice === ''
    ? (product?.salePrice ?? 0)
    : Number(form.salePrice);

  const displayedSuggestedPrice = dirty
    ? (pricing?.suggestedPrice ?? product?.suggestedPrice ?? 0)
    : (product?.suggestedPrice ?? pricing?.suggestedPrice ?? 0);
  const displayedCalculatedCost = dirty
    ? (pricing?.totalCost ?? product?.costPrice ?? 0)
    : (product?.costPrice ?? pricing?.totalCost ?? 0);
  const displayedFinalPriceWithoutCommission = effectiveSalePrice;
  const displayedFinalPriceWithCommission = dirty
    ? (pricing?.finalPriceWithCommission
      ?? (displayedFinalPriceWithoutCommission * (1 + Number(form.commissionPercentage || 0) / 100)))
    : (displayedFinalPriceWithoutCommission * (1 + Number(form.commissionPercentage || 0) / 100));
  const estimatedProfit = displayedFinalPriceWithoutCommission - displayedCalculatedCost;
  const minimumAllowedSalePrice = displayedCalculatedCost * 2;
  const hasMarkupBelowMinimum = Number(form.desiredMarkup) < 2;
  const hasMissingCategory = form.categoryId === '';
  const hasManualPriceBelowMinimum = form.salePrice !== '' && Number(form.salePrice) < minimumAllowedSalePrice;

  function updateForm(field: keyof typeof emptyForm, value: string | number | boolean) {
    setDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateDurationPart(field: keyof typeof duration, value: number) {
    const nextDuration = {
      ...duration,
      [field]: Math.max(0, Math.floor(value))
    };

    setDuration(nextDuration);
    updateForm('estimatedPrintTimeMinutes', durationPartsToMinutes(nextDuration.hours, nextDuration.minutes, nextDuration.seconds));
  }

    function addFilament() {
      setDirty(true);
      setForm((current) => ({ ...current, filaments: [...current.filaments, { filamentProfileId: '', weightGrams: 0 }] }));
    }

    function removeFilament(index: number) {
      setDirty(true);
      setForm((current) => ({ ...current, filaments: current.filaments.filter((_, i) => i !== index) }));
    }

    function updateFilament(index: number, field: 'filamentProfileId' | 'weightGrams', value: string | number) {
      setDirty(true);
      setForm((current) => ({
        ...current,
        filaments: current.filaments.map((f, i) => i === index ? { ...f, [field]: value } : f)
      }));
    }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h4">{isEditing ? (form.isBudget ? 'Editar orçamento' : 'Editar produto') : (isBudgetMode ? 'Novo orçamento' : 'Novo produto')}</Typography>
          <Typography color="text.secondary">Cadastro em tela separada, com cálculo de preço atualizado durante a digitação.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(isBudgetMode ? '/orcamentos' : '/produtos', { state: { preserveState: true } })}>
          Voltar para listagem
        </Button>
      </Stack>

      {feedback ? <Alert severity="warning">{feedback}</Alert> : null}
      {hasMissingCategory ? <Alert severity="warning">Selecione uma categoria para calcular e salvar o produto.</Alert> : null}
      {hasMarkupBelowMinimum ? <Alert severity="warning">O markup desejado nao pode ser menor do que 2.</Alert> : null}
      {hasManualPriceBelowMinimum ? <Alert severity="warning">O preco final nao pode ser menor do que {formatCurrency(minimumAllowedSalePrice)}.</Alert> : null}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title="Dados do produto" subtitle="Informações gerais, produção e configuração de preço.">
            <Stack spacing={2}>
              <Stack spacing={2.5}>
                <Stack spacing={0.75}>
                  <Typography fontWeight={700}>Identificação</Typography>
                  <Divider />
                </Stack>
                <TextField label="Nome" value={form.name} onChange={(event) => updateForm('name', capitalizeFirstLetter(event.target.value))} />
                <TextField
                  label="SKU"
                  value={form.sku}
                  onChange={(event) => {
                    updateForm('sku', event.target.value.toUpperCase());
                  }}
                  helperText="Se ficar vazio, será gerado automaticamente no padrão 00001-00000001."
                />
                <TextField label="Descrição" multiline minRows={3} value={form.description} onChange={(event) => updateForm('description', event.target.value)} />

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <SearchSelectField
                      label="Categoria"
                      value={form.categoryId}
                      options={(metadata?.categories ?? []).map((item) => ({ id: item.id, name: item.name }))}
                      onChange={(value) => updateForm('categoryId', value)}
                      helperText="Busque e selecione a categoria. Nenhuma vem preenchida por padrão."
                      placeholder="Digite o nome da categoria"
                      minQueryLength={0}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField select label="Fornecedor" value={isSupplier ? (session?.supplierId ?? '') : form.supplierId} onChange={(event) => updateForm('supplierId', event.target.value)} fullWidth disabled={isSupplier} helperText={isSupplier ? 'Vinculado automaticamente ao fornecedor logado.' : undefined}>
                      {!isSupplier ? <MenuItem value="">Lojinha Sem Nome</MenuItem> : null}
                      {(metadata?.suppliers ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField select label="Marketplace" value={form.marketplaceFeeId} onChange={(event) => updateForm('marketplaceFeeId', event.target.value)} fullWidth>
                      <MenuItem value="">Sem marketplace</MenuItem>
                      {(metadata?.marketplaces ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>

                <Stack spacing={0.75}>
                  <Typography fontWeight={700}>Equipamentos e produção</Typography>
                  <Divider />
                </Stack>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField select label="Impressora" value={form.printerProfileId} onChange={(event) => updateForm('printerProfileId', event.target.value)} fullWidth>
                      <MenuItem value="">Sem impressora</MenuItem>
                      {(metadata?.printers ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}><TextField label="Itens por placa" type="number" value={form.itemsPerPlate} onChange={(event) => updateForm('itemsPerPlate', Number(event.target.value))} helperText="Use 1 quando o custo ja for unitario." fullWidth /></Grid>
                  <Grid item xs={12} md={4}><CurrencyField label="Tarifa kWh" value={form.tariffPerKwh} onValueChange={(value) => updateForm('tariffPerKwh', value)} fullWidth /></Grid>
                  <Grid item xs={12}>
                    <Stack spacing={1.25}>
                      <Typography variant="body2" fontWeight={600}>Filamentos</Typography>
                      {form.filaments.map((item, index) => (
                        <Grid key={index} container spacing={1} alignItems="center">
                          <Grid item xs={12} md={8}>
                            <SearchSelectField
                              label="Filamento"
                              value={item.filamentProfileId}
                              options={(metadata?.filaments ?? []).map((f) => ({ id: f.id, name: f.name }))}
                              onChange={(value) => updateFilament(index, 'filamentProfileId', value)}
                              placeholder="Digite o nome do filamento"
                              minQueryLength={0}
                              helperText={undefined}
                            />
                          </Grid>
                          <Grid item xs={10} sm={4} md={3}>
                            <TextField
                              label="Peso (g)"
                              type="number"
                              value={item.weightGrams}
                              onChange={(event) => updateFilament(index, 'weightGrams', Number(event.target.value))}
                              fullWidth
                            />
                          </Grid>
                          <Grid item xs={2} sm={2} md={1} sx={{ display: 'flex', justifyContent: 'center' }}>
                            {index > 0 && (
                              <IconButton onClick={() => removeFilament(index)} color="error" aria-label="Remover filamento">
                                <DeleteOutlineRoundedIcon />
                              </IconButton>
                            )}
                          </Grid>
                        </Grid>
                      ))}
                      <Button size="small" startIcon={<AddRoundedIcon />} onClick={addFilament} sx={{ alignSelf: 'flex-start' }}>
                        Adicionar filamento
                      </Button>
                      {form.filaments.length > 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          Peso total: {form.filaments.reduce((sum, f) => sum + (Number(f.weightGrams) || 0), 0).toFixed(0)} g
                        </Typography>
                      ) : null}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Grid container spacing={2}>
                      <Grid item xs={4}><TextField label="Duração (h)" type="number" value={duration.hours} onChange={(event) => updateDurationPart('hours', Number(event.target.value))} fullWidth /></Grid>
                      <Grid item xs={4}><TextField label="Min" type="number" value={duration.minutes} onChange={(event) => updateDurationPart('minutes', Number(event.target.value))} fullWidth /></Grid>
                      <Grid item xs={4}><TextField label="Seg" type="number" value={duration.seconds} onChange={(event) => updateDurationPart('seconds', Number(event.target.value))} fullWidth /></Grid>
                    </Grid>
                  </Grid>
                  <Grid item xs={12} md={3}><TextField label="Altura (cm)" type="number" value={form.heightCentimeters} onChange={(event) => updateForm('heightCentimeters', Number(event.target.value))} fullWidth /></Grid>
                  <Grid item xs={12} md={3}><TextField label="Comprimento (m)" type="number" value={form.lengthMetersUsed} onChange={(event) => updateForm('lengthMetersUsed', Number(event.target.value))} fullWidth /></Grid>
                </Grid>

                <Stack spacing={0.75}>
                  <Typography fontWeight={700}>Precificação e estoque</Typography>
                  <Divider />
                </Stack>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}><TextField label="Estoque" type="number" value={form.currentStock} onChange={(event) => updateForm('currentStock', Number(event.target.value))} fullWidth /></Grid>
                  <Grid item xs={12} md={4}><TextField label="Estoque mínimo" type="number" value={form.minimumStock} onChange={(event) => updateForm('minimumStock', Number(event.target.value))} fullWidth /></Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Checkbox checked={form.generateProductionExpenseOnStockEntry} onChange={(event) => updateForm('generateProductionExpenseOnStockEntry', event.target.checked)} />}
                      label="Gerar despesa de produção quando o produto entrar em estoque"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Checkbox checked={form.isBudget} onChange={(event) => updateForm('isBudget', event.target.checked)} />}
                      label="Salvar como orçamento"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}><TextField label="Acabamento (%)" type="number" value={form.finishingPercentage} onChange={(event) => updateForm('finishingPercentage', Number(event.target.value))} fullWidth /></Grid>
                  <Grid item xs={12} md={4}><TextField label="Comissão (%)" type="number" value={form.commissionPercentage} onChange={(event) => updateForm('commissionPercentage', Number(event.target.value))} fullWidth /></Grid>
                  <Grid item xs={12} md={4}><CurrencyField label="Custo adicional" value={form.additionalCost} onValueChange={(value) => updateForm('additionalCost', value)} fullWidth /></Grid>
                  <Grid item xs={12} md={4}><TextField label="Markup desejado" type="number" value={form.desiredMarkup} onChange={(event) => updateForm('desiredMarkup', Number(event.target.value))} helperText="Minimo de 2 (200%)." fullWidth /></Grid>
                  <Grid item xs={12} md={4}><CurrencyField label="Preço final de venda" value={form.salePrice === '' ? 0 : Number(form.salePrice)} onValueChange={(value) => updateForm('salePrice', String(value))} helperText={`Minimo: ${formatCurrency(minimumAllowedSalePrice)}`} fullWidth /></Grid>
                  <Grid item xs={12} md={4}><CurrencyField label="Lucro estimado" value={estimatedProfit} onValueChange={() => undefined} helperText="Preco final informado menos custo calculado." fullWidth disabled /></Grid>
                </Grid>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading || hasMissingCategory || hasMarkupBelowMinimum || hasManualPriceBelowMinimum}>
                  {saveMutation.isLoading ? 'Salvando...' : isEditing ? 'Atualizar produto' : 'Cadastrar produto'}
                </Button>
                <Button variant="outlined" onClick={() => navigate(form.isBudget ? '/orcamentos' : '/produtos', { state: { preserveState: true } })}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </PageSection>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <PageSection title="Resumo de preço" subtitle={dirty ? 'Preview recalculado com os dados atuais do formulário.' : 'Valores salvos do produto. O preview detalhado fica disponível abaixo para conferência.'}>
              <Stack spacing={1.2}>
                <Typography>Custo unitário calculado: {formatCurrency(displayedCalculatedCost)}</Typography>
                <Typography>Custo total da placa: {formatCurrency(displayedCalculatedCost * Number(form.itemsPerPlate || 1))}</Typography>
                <Typography>Preço sugerido unitário: {formatCurrency(displayedSuggestedPrice)}</Typography>
                <Typography>Preço sugerido com comissão: {formatCurrency(pricing?.suggestedPriceWithCommission ?? displayedSuggestedPrice)}</Typography>
                <Typography>Preço final sem comissão: {formatCurrency(displayedFinalPriceWithoutCommission)}</Typography>
                <Typography>Lucro estimado: {formatCurrency(estimatedProfit)}</Typography>
                <Typography>Preço final com comissão: {formatCurrency(displayedFinalPriceWithCommission)}</Typography>
                <Typography>Comissão aplicada: {formatCurrency(pricing?.commissionAmount ?? 0)}</Typography>
                <Typography>Custo adicional: {formatCurrency(Number(form.additionalCost || 0))}</Typography>
                <Typography>Itens por placa: {Number(form.itemsPerPlate || 1)}</Typography>
                <Typography>Acabamento informado: {Number(form.finishingPercentage).toFixed(2)}%</Typography>
                <Typography>Comissão variável: {Number(form.commissionPercentage).toFixed(2)}%</Typography>
                <Typography>Markup desejado: {Number(form.desiredMarkup).toFixed(2)}x</Typography>
              </Stack>
            </PageSection>

            {pricing ? (
              <PageSection title="Detalhamento do preview" subtitle="Cálculo sugerido sem taxa de marketplace no preço sugerido.">
                <Stack spacing={1.2}>
                  <Typography>Material: {formatCurrency(pricing?.materialCost ?? 0)}</Typography>
                  <Typography>Energia: {formatCurrency(pricing?.energyCost ?? 0)}</Typography>
                  <Typography>Manutenção: {formatCurrency(pricing?.maintenanceCost ?? 0)}</Typography>
                  <Typography>Falhas: {formatCurrency(pricing?.failureCost ?? 0)}</Typography>
                  <Typography>Acabamento: {formatCurrency(pricing?.finishingCost ?? 0)}</Typography>
                  <Typography>Custo adicional: {formatCurrency(pricing?.additionalCosts ?? 0)}</Typography>
                  <Typography>Preço base final unitário: {formatCurrency(pricing?.finalPriceWithoutCommission ?? 0)}</Typography>
                  <Typography>Preço final com comissão: {formatCurrency(pricing?.finalPriceWithCommission ?? 0)}</Typography>
                  <Typography>Preço com marketplace: {formatCurrency(pricing?.marketplaceAdjustedPrice ?? 0)}</Typography>
                </Stack>
              </PageSection>
            ) : null}

            {isEditing ? (
              <PageSection title="Histórico de custo e preço" subtitle="Linha do tempo das alterações salvas para este produto.">
                <Stack spacing={1.2}>
                  {priceHistory.map((item, index) => (
                    <Stack key={`${item.changedAtUtc}-${item.action}-${index}`} spacing={0.35} sx={{ p: 1.4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.62)' }}>
                      <Typography fontWeight={700}>{new Date(item.changedAtUtc).toLocaleString('pt-BR')} • {item.action}</Typography>
                      <Typography color="text.secondary">Por: {item.changedBy}</Typography>
                      <Typography color="text.secondary">Custo: {formatCurrency(item.costPrice ?? 0)}</Typography>
                      <Typography color="text.secondary">Preço: {formatCurrency(item.salePrice ?? 0)}</Typography>
                      <Typography color="text.secondary">Estoque no momento: {item.currentStock ?? 0}</Typography>
                    </Stack>
                  ))}
                  {priceHistory.length === 0 ? <Typography color="text.secondary">Sem histórico de alteração para este produto.</Typography> : null}
                </Stack>
              </PageSection>
            ) : null}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}