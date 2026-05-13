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
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CurrencyField } from '../components/CurrencyField';
import { SearchSelectField } from '../components/SearchSelectField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { operationalListsApi, productsApi, projectsApi } from '../services/api';
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
  commissionPercentage: 20,
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
  const projectId = !id ? searchParams.get('projeto') : null;
  const todoItemId = !id ? searchParams.get('todoItemId') : null;
  const todoName = !id ? searchParams.get('todoName') : null;
  const isProjectDraftMode = Boolean(projectId);
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm, isBudget: isBudgetMode });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [duration, setDuration] = useState(() => minutesToDurationParts(emptyForm.estimatedPrintTimeMinutes));
  const [projectDraftBaseAdditionalCost, setProjectDraftBaseAdditionalCost] = useState<number | null>(null);
  const [projectDraftFailureCost, setProjectDraftFailureCost] = useState(0);
  const [includeProjectFailures, setIncludeProjectFailures] = useState(false);

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
  const { data: projectDraft } = useQuery({
    queryKey: ['project-product-draft', projectId],
    queryFn: () => projectsApi.getProductDraft(projectId!),
    enabled: Boolean(projectId) && !isEditing && !cloneFromId
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
    if (!projectDraft) {
      return;
    }

    setProjectDraftBaseAdditionalCost(projectDraft.additionalCost);
    setProjectDraftFailureCost(projectDraft.failureAdditionalCost);
    setIncludeProjectFailures(false);
    setForm({
      name: projectDraft.name,
      sku: projectDraft.sku,
      description: projectDraft.description,
      categoryId: projectDraft.categoryId ?? '',
      supplierId: projectDraft.supplierId ?? '',
      generateProductionExpenseOnStockEntry: projectDraft.generateProductionExpenseOnStockEntry,
      currentStock: projectDraft.currentStock,
      minimumStock: projectDraft.minimumStock,
      itemsPerPlate: projectDraft.itemsPerPlate,
      estimatedPrintTimeMinutes: projectDraft.estimatedPrintTimeMinutes,
      heightCentimeters: projectDraft.heightCentimeters,
      lengthMetersUsed: projectDraft.lengthMetersUsed,
      tariffPerKwh: projectDraft.tariffPerKwh,
      finishingPercentage: projectDraft.finishingPercentage,
      commissionPercentage: projectDraft.commissionPercentage,
      additionalCost: projectDraft.additionalCost,
      printerProfileId: projectDraft.printerProfileId ?? '',
      filaments: projectDraft.filaments.map((item: { filamentProfileId: string; weightGrams: number }) => ({ filamentProfileId: item.filamentProfileId, weightGrams: item.weightGrams })),
      marketplaceFeeId: projectDraft.marketplaceFeeId ?? '',
      desiredMarkup: projectDraft.desiredMarkup,
      salePrice: projectDraft.salePrice ? String(projectDraft.salePrice) : '',
      isBudget: false
    });
    setDuration(minutesToDurationParts(projectDraft.estimatedPrintTimeMinutes));
    setDirty(true);
  }, [projectDraft]);

  useEffect(() => {
    if (!isEditing && !cloneFromId) {
      setForm((current) => ({ ...current, isBudget: isBudgetMode }));
    }
  }, [cloneFromId, isBudgetMode, isEditing]);

  useEffect(() => {
    if (isEditing || cloneFromId || projectId || !todoName || form.name.trim().length > 0) {
      return;
    }

    setForm((current) => ({ ...current, name: capitalizeFirstLetter(todoName) }));
    setDirty(true);
  }, [cloneFromId, form.name, isEditing, projectId, todoName]);

  useEffect(() => {
    if (!isProjectDraftMode || projectDraftBaseAdditionalCost === null) {
      return;
    }

    const nextAdditionalCost = projectDraftBaseAdditionalCost + (includeProjectFailures ? projectDraftFailureCost : 0);
    setForm((current) => current.additionalCost === nextAdditionalCost ? current : { ...current, additionalCost: nextAdditionalCost });
  }, [includeProjectFailures, isProjectDraftMode, projectDraftBaseAdditionalCost, projectDraftFailureCost]);

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
        isBudget: isBudgetMode || form.isBudget,
        salePrice: form.salePrice === '' ? null : Number(form.salePrice)
      };

      return isEditing
        ? productsApi.update(id!, payload)
        : isProjectDraftMode
          ? projectsApi.concludeWithProduct(projectId!, payload)
          : productsApi.create(payload);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });

      if (!isEditing && todoItemId) {
        try {
          await operationalListsApi.removeTodoItem(todoItemId);
        }
        catch {
          // Keep flow resilient even if todo removal fails.
        }
        await queryClient.invalidateQueries({ queryKey: ['operational-todo'] });
      }

      if (isProjectDraftMode) {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        navigate(`/projetos/${projectId}`, { state: { preserveState: true } });
        return;
      }

      navigate(form.isBudget ? '/orcamentos' : '/produtos', { state: { preserveState: true } });
    },
    onError: () => {
      setFeedback(isProjectDraftMode
        ? 'Nao foi possivel concluir o projeto com o produto informado.'
        : 'Nao foi possivel salvar o produto com os dados informados.');
    }
  });

  const effectiveSalePrice = form.salePrice === ''
    ? (product?.salePrice ?? 0)
    : Number(form.salePrice);
  const effectiveCommissionPercentage = Number(form.commissionPercentage);
  const effectiveCommissionedSalePrice = (() => {
    const rate = effectiveCommissionPercentage <= 0 ? 0 : effectiveCommissionPercentage / 100;
    if (effectiveSalePrice <= 0) {
      return 0;
    }

    if (rate <= 0) {
      return effectiveSalePrice;
    }

    if (rate >= 1) {
      return 0;
    }

    return Number((effectiveSalePrice / (1 - rate)).toFixed(2));
  })();

  const liveCost = pricing?.totalCost ?? product?.costPrice ?? 0;
  const estimatedProfit = effectiveSalePrice - liveCost;
  const minimumAllowedSalePrice = liveCost * 2;
  const hasMarkupBelowMinimum = Number(form.desiredMarkup) < 2;
  const hasMissingCategory = form.categoryId === '';
  const hasManualPriceBelowMinimum = form.salePrice !== '' && Number(form.salePrice) < minimumAllowedSalePrice;
  const hasMissingPrinterWithFilaments = form.filaments.filter(f => f.filamentProfileId).length > 0 && form.printerProfileId === '';

  function updateForm(field: keyof typeof emptyForm, value: string | number | boolean) {
    setDirty(true);
    if (field === 'additionalCost' && isProjectDraftMode) {
      setProjectDraftBaseAdditionalCost(Number(value) - (includeProjectFailures ? projectDraftFailureCost : 0));
    }
    setForm((current) => ({ ...current, [field]: value }));
  }

  const backTarget = isProjectDraftMode
    ? `/projetos/${projectId}`
    : (isBudgetMode ? '/orcamentos' : '/produtos');

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
          <Typography variant="h4">{isProjectDraftMode ? 'Pré-cadastro do produto do projeto' : isEditing ? (form.isBudget ? 'Editar orçamento' : 'Editar produto') : (isBudgetMode ? 'Novo orçamento' : 'Novo produto')}</Typography>
          <Typography color="text.secondary">{isProjectDraftMode ? 'Revise os dados consolidados do projeto antes de concluir e vincular o produto.' : 'Cadastro em tela separada, com cálculo de preço atualizado durante a digitação.'}</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(backTarget, { state: { preserveState: true } })}>
          Voltar para listagem
        </Button>
      </Stack>

      {feedback ? <Alert severity="warning">{feedback}</Alert> : null}
      {hasMissingCategory ? <Alert severity="warning">Selecione uma categoria para calcular e salvar o produto.</Alert> : null}
      {hasMarkupBelowMinimum ? <Alert severity="warning">O markup desejado nao pode ser menor do que 2.</Alert> : null}
      {hasManualPriceBelowMinimum ? <Alert severity="warning">O preco final nao pode ser menor do que {formatCurrency(minimumAllowedSalePrice)}.</Alert> : null}

      {isProjectDraftMode && projectDraft ? (
        <PageSection title="Resumo do projeto" subtitle="Dados consolidados das mesas concluídas para preencher o produto final.">
          <Stack spacing={2}>
            <Typography color="text.secondary">Projeto: {projectDraft.projectName}{projectDraft.existingProductId ? ' • atualizará o produto já vinculado' : ' • criará um novo produto ao concluir'}</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Impressoras consolidadas</Typography>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {projectDraft.printerUsages.map((item: { printerName: string; timeRealMinutes: number }) => (
                    <Typography key={item.printerName}>{item.printerName}: {item.timeRealMinutes.toFixed(0)} min reais</Typography>
                  ))}
                  {projectDraft.printerUsages.length === 0 ? <Typography color="text.secondary">Sem impressoras consolidadas.</Typography> : null}
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Materiais consolidados</Typography>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {projectDraft.materialUsages.map((item: { filamentProfileId: string; filamentName: string; weightGrams: number; weightPercentage: number }) => (
                    <Typography key={item.filamentProfileId}>{item.filamentName}: {item.weightGrams.toFixed(0)} g ({item.weightPercentage.toFixed(1)}%)</Typography>
                  ))}
                  {projectDraft.materialUsages.length === 0 ? <Typography color="text.secondary">Sem materiais consolidados.</Typography> : null}
                </Stack>
              </Paper>
            </Stack>
            <FormControlLabel
              control={<Checkbox checked={includeProjectFailures} onChange={(event) => setIncludeProjectFailures(event.target.checked)} />}
              label={`Incluir custos de falhas no custo adicional (${formatCurrency(projectDraftFailureCost)})`}
            />
          </Stack>
        </PageSection>
      ) : null}

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
                      control={<Checkbox checked={isBudgetMode ? true : form.isBudget} onChange={(event) => updateForm('isBudget', event.target.checked)} disabled={isBudgetMode || isProjectDraftMode} />}
                      label={isProjectDraftMode ? 'Produto final sempre salvo como produto disponível ao concluir o projeto' : isBudgetMode ? 'Cadastro fixo como orçamento nesta tela' : 'Salvar como orçamento'}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}><TextField label="Acabamento (%)" type="number" value={form.finishingPercentage} onChange={(event) => updateForm('finishingPercentage', Number(event.target.value))} fullWidth /></Grid>
                  <Grid item xs={12} md={4}><TextField label="Comissão (%)" type="number" value={form.commissionPercentage} onChange={(event) => updateForm('commissionPercentage', Number(event.target.value))} fullWidth /></Grid>
                  <Grid item xs={12} md={4}><CurrencyField label="Custo adicional" value={form.additionalCost} onValueChange={(value) => updateForm('additionalCost', value)} fullWidth /></Grid>
                  <Grid item xs={12} md={4}><TextField label="Markup desejado" type="number" value={form.desiredMarkup} onChange={(event) => updateForm('desiredMarkup', Number(event.target.value))} helperText="Minimo de 2 (200%)." fullWidth /></Grid>
                  <Grid item xs={12} md={4}><CurrencyField label="Preço final de venda" value={form.salePrice === '' ? 0 : Number(form.salePrice)} onValueChange={(value) => updateForm('salePrice', String(value))} helperText={`Minimo: ${formatCurrency(minimumAllowedSalePrice)}`} fullWidth /></Grid>
                  <Grid item xs={12} md={4}><CurrencyField label="Preço para venda comissionada" value={effectiveCommissionedSalePrice} onValueChange={() => undefined} helperText="Calculado automaticamente a partir do preço final e comissão." fullWidth disabled /></Grid>
                  <Grid item xs={12} md={4}><CurrencyField label="Lucro estimado" value={estimatedProfit} onValueChange={() => undefined} helperText="Preco final informado menos custo calculado." fullWidth disabled /></Grid>
                </Grid>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading || hasMissingCategory || hasMarkupBelowMinimum || hasManualPriceBelowMinimum || hasMissingPrinterWithFilaments} title={hasMissingPrinterWithFilaments ? 'Selecione uma impressora quando há filamentos' : undefined}>
                  {saveMutation.isLoading ? 'Salvando...' : isProjectDraftMode ? 'Concluir projeto e salvar produto' : isEditing ? 'Atualizar produto' : 'Cadastrar produto'}
                </Button>
                <Button variant="outlined" onClick={() => navigate(backTarget, { state: { preserveState: true } })}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </PageSection>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <PageSection title="Preview de precificação" subtitle={dirty ? 'Calculado com os dados atuais do formulário.' : 'Calculado com os dados salvos. Edite o formulário para recalcular.'}>
              {pricing ? (
                <Stack spacing={1.2}>
                  {form.printerProfileId === '' && form.filaments.length > 0 ? (
                    <Alert severity="warning">
                      <strong>Aviso:</strong> Nenhuma impressora selecionada. Custo calculado apenas com material (filamento). Quando uma impressora for selecionada, serão inclusos custos de energia, manutenção e falhas.
                    </Alert>
                  ) : null}
                  {isEditing && product && pricing.totalCost !== product.costPrice ? (
                    <Alert severity="info">
                      <strong>Divergência de custo:</strong> Persistido {formatCurrency(product.costPrice)} → Recalculado {formatCurrency(pricing.totalCost)}{form.printerProfileId === '' && product.printerProfileId ? ' (impressora foi adicionada após criação)' : ''}
                      {!dirty ? ' • Clique em "Salvar" para atualizar.' : ''}
                    </Alert>
                  ) : null}
                  {isEditing && product ? (
                    <Typography fontWeight={600}>Custo persistido: {formatCurrency(product.costPrice)}</Typography>
                  ) : null}
                  <Typography fontWeight={600}>Custo calculado: {formatCurrency(pricing.totalCost)}</Typography>
                  <Typography fontWeight={600}>Preço sugerido: {formatCurrency(pricing.suggestedPrice)}</Typography>
                  {Number(form.commissionPercentage) > 0 ? (
                    <Typography fontWeight={600}>Sugerido + comissão ({Number(form.commissionPercentage).toFixed(0)}%): {formatCurrency(pricing.suggestedPriceWithCommission)}</Typography>
                  ) : null}
                  <Divider />
                  <Typography variant="body2" color="text.secondary">Material: {formatCurrency(pricing.materialCost)}</Typography>
                  <Typography variant="body2" color="text.secondary">Energia: {formatCurrency(pricing.energyCost)}</Typography>
                  <Typography variant="body2" color="text.secondary">Manutenção: {formatCurrency(pricing.maintenanceCost)}</Typography>
                  <Typography variant="body2" color="text.secondary">Falhas: {formatCurrency(pricing.failureCost)}</Typography>
                  <Typography variant="body2" color="text.secondary">Acabamento: {formatCurrency(pricing.finishingCost)}</Typography>
                  {pricing.additionalCosts > 0 ? <Typography variant="body2" color="text.secondary">Custo adicional: {formatCurrency(pricing.additionalCosts)}</Typography> : null}
                  {pricing.laborCost > 0 ? <Typography variant="body2" color="text.secondary">Mão de obra: {formatCurrency(pricing.laborCost)}</Typography> : null}
                  {pricing.marketplaceAdjustedPrice > pricing.suggestedPrice ? (
                    <Typography variant="body2" color="text.secondary">Com marketplace: {formatCurrency(pricing.marketplaceAdjustedPrice)}</Typography>
                  ) : null}
                </Stack>
              ) : (
                <Typography color="text.secondary">Selecione uma categoria para visualizar o preview.</Typography>
              )}
            </PageSection>

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