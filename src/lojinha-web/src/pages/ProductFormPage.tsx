import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Slider,
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
import { bottonSizesApi, operationalListsApi, paintingPricingApi, productsApi, projectsApi } from '../services/api';
import type { ProductPaintingRecalculation, ProductPaintingRequest, ProductType } from '../services/types';
import { getErrorMessage } from './paintingPricing/paintingPricingShared';
import { PaintingRecalculationDialog } from './productForm/PaintingRecalculationDialog';
import { ProductCostSummarySection } from './productForm/ProductCostSummarySection';
import { ProductFormActionBar } from './productForm/ProductFormActionBar';
import { applicationNotes, ProductPaintingSection } from './productForm/ProductPaintingSection';
import { ProductProjectionSection } from './productForm/ProductProjectionSection';
import { durationPartsToMinutes, minutesToDurationParts } from '../services/product';

const emptyForm = {
  productType: 'Impressao3D' as ProductType,
  name: '',
  sku: '',
  description: '',
  categoryId: '',
  supplierId: '',
  pingenteSupplyId: '',
  pingenteCost: 0,
  bottonSizeId: '',
  bottonSizeQuantity: 1,
  generateProductionExpenseOnStockEntry: false,
  currentStock: 0,
  itemsPerPlate: 1,
  estimatedPrintTimeMinutes: 60,
  heightCentimeters: 0,
  lengthMetersUsed: 5,
  tariffPerKwh: 0.95,
  finishingPercentage: 2,
  commissionPercentage: 20,
  additionalCost: 0,
  laborCost: 0.5,
  printerProfileId: '',
  filaments: [{ filamentProfileId: '', weightGrams: 0 }] as { filamentProfileId: string; weightGrams: number }[],
  marketplaceFeeId: '',
  desiredMarkup: 2.7,
  salePrice: '',
  isBudget: false
};

const emptyPainting: ProductPaintingRequest = {
  enabled: false,
  mode: 'Automatic',
  execution: 'Internal',
  application: 'IncorporatePrice',
  heightCm: 0,
  heightOverridden: false,
  levelId: null,
  complexityId: null,
  characterCount: 1,
  hoursOverride: null,
  hourlyRateOverride: null,
  materialsAmountOverride: null,
  preparationAmountOverride: null,
  addOnsAmountOverride: null,
  marginPercentageOverride: null,
  finalPriceOverride: null,
  preparations: [],
  addOns: [],
  extraPreparationDescription: '',
  extraPreparationAmount: 0,
  freeAddOnDescription: '',
  freeAddOnQuantity: 1,
  freeAddOnUnitAmount: 0,
  baseNeedsPainting: false,
  baseMode: 'SameLevel',
  baseLevelId: null,
  baseHours: 1,
  baseManualAmount: 0,
  baseAddOnId: null,
  outsourcedSupplierId: null,
  outsourcedChargedAmount: 0,
  outsourcedFreightAmount: 0,
  outsourcedOtherCosts: 0,
  outsourcedIncorporatedPrice: null,
  manualCost: 0,
  manualPrice: 0,
  manualIncorporatedAmount: 0,
  notes: '',
  colorReferences: '',
  needsReview: false,
  keepStoredSnapshot: false,
  sourceProductId: null
};

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

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
  const projectId = searchParams.get('projeto');
  const todoItemId = !id ? searchParams.get('todoItemId') : null;
  const todoName = !id ? searchParams.get('todoName') : null;
  const isProjectDraftMode = Boolean(projectId);
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm, isBudget: isBudgetMode });
  const [painting, setPainting] = useState<ProductPaintingRequest>(emptyPainting);
  const [paintingExpanded, setPaintingExpanded] = useState(false);
  const [paintingBannerDismissed, setPaintingBannerDismissed] = useState(false);
  const [recalculationOpen, setRecalculationOpen] = useState(false);
  const [recalculation, setRecalculation] = useState<ProductPaintingRecalculation | null>(null);
  const [recalculationLoading, setRecalculationLoading] = useState(false);
  const [recalculationError, setRecalculationError] = useState<string | null>(null);
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
  const isFromOutsourcedProduction = Boolean(isEditing && product?.outsourcedProductionId);
  const { data: cloneSource } = useQuery({
    queryKey: ['product', cloneFromId],
    queryFn: () => productsApi.getById(cloneFromId!),
    enabled: Boolean(cloneFromId)
  });
  const { data: projectDraft } = useQuery({
    queryKey: ['project-product-draft', projectId],
    queryFn: () => projectsApi.getProductDraft(projectId!),
    enabled: Boolean(projectId) && !cloneFromId
  });
  const { data: priceHistory = [] } = useQuery({
    queryKey: ['product-price-history', id],
    queryFn: () => productsApi.getPriceHistory(id!),
    enabled: isEditing
  });
  const { data: bottonSizes = [] } = useQuery({ queryKey: ['botton-sizes'], queryFn: bottonSizesApi.getAll });
  const { data: paintingOverview } = useQuery({ queryKey: ['painting-pricing'], queryFn: paintingPricingApi.getOverview });
  const selectedBottonSize = bottonSizes.find((size) => size.id === form.bottonSizeId);
  const isEarring = form.productType === 'Brinco';
  const isBotton = form.productType === 'Botton';
  const isPrint3D = form.productType === 'Impressao3D';

  const defaultFilamentId = useMemo(() => {
    const pla120 = (metadata?.filaments ?? []).find((item) => item.name.trim().toLowerCase() === 'pla - 120');
    return pla120?.id ?? '';
  }, [metadata?.filaments]);

  const noneMarketplaceId = useMemo(() => {
    const none = (metadata?.marketplaces ?? []).find((item) => item.name.trim().toLowerCase() === 'nenhum');
    return none?.id ?? '';
  }, [metadata?.marketplaces]);

  useEffect(() => {
    if (!product) {
      return;
    }

    setForm({
      productType: product.productType ?? 'Impressao3D',
      name: product.name,
      sku: product.sku,
      description: product.description,
      categoryId: product.categoryId,
      supplierId: product.supplierId ?? '',
      pingenteSupplyId: product.pingenteSupplyId ?? '',
      pingenteCost: product.pingenteCost ?? 0,
      bottonSizeId: product.bottonSizeId ?? '',
      bottonSizeQuantity: product.bottonSizeQuantity ?? 1,
      generateProductionExpenseOnStockEntry: product.generateProductionExpenseOnStockEntry,
      currentStock: product.currentStock,
      itemsPerPlate: product.itemsPerPlate,
      estimatedPrintTimeMinutes: product.estimatedPrintTimeMinutes,
      heightCentimeters: product.heightCentimeters,
      lengthMetersUsed: product.lengthMetersUsed,
      tariffPerKwh: product.tariffPerKwh,
      finishingPercentage: product.finishingPercentage,
      commissionPercentage: product.commissionPercentage,
      additionalCost: product.additionalCost,
      laborCost: product.laborCost ?? 0.5,
      printerProfileId: product.printerProfileId ?? '',
      filaments: (product.filaments ?? []).map((f) => ({ filamentProfileId: f.filamentProfileId, weightGrams: f.weightGrams })),
      marketplaceFeeId: product.marketplaceFeeId ?? '',
      desiredMarkup: product.desiredMarkup,
      salePrice: String(product.salePrice),
      isBudget: product.lifecycleStatus === 'Orcamento'
    });
    setDuration(minutesToDurationParts(product.estimatedPrintTimeMinutes));
    setPainting(product.painting
      ? { ...emptyPainting, ...product.painting.configuration, keepStoredSnapshot: Boolean(product.painting.snapshot), sourceProductId: product.id }
      : { ...emptyPainting, heightCm: product.heightCentimeters, sourceProductId: product.id });
    setPaintingBannerDismissed(false);
    setDirty(false);
  }, [product]);

  useEffect(() => {
    if (!cloneSource) {
      return;
    }

    setForm({
      productType: cloneSource.productType ?? 'Impressao3D',
      name: `${cloneSource.name} (cópia)`,
      sku: '',
      description: cloneSource.description,
      categoryId: cloneSource.categoryId,
      supplierId: cloneSource.supplierId ?? '',
      pingenteSupplyId: cloneSource.pingenteSupplyId ?? '',
      pingenteCost: cloneSource.pingenteCost ?? 0,
      bottonSizeId: cloneSource.bottonSizeId ?? '',
      bottonSizeQuantity: cloneSource.bottonSizeQuantity ?? 1,
      generateProductionExpenseOnStockEntry: cloneSource.generateProductionExpenseOnStockEntry,
      currentStock: 0,
      itemsPerPlate: cloneSource.itemsPerPlate,
      estimatedPrintTimeMinutes: cloneSource.estimatedPrintTimeMinutes,
      heightCentimeters: cloneSource.heightCentimeters,
      lengthMetersUsed: cloneSource.lengthMetersUsed,
      tariffPerKwh: cloneSource.tariffPerKwh,
      finishingPercentage: cloneSource.finishingPercentage,
      commissionPercentage: cloneSource.commissionPercentage,
      additionalCost: cloneSource.additionalCost,
      laborCost: cloneSource.laborCost ?? 0.5,
      printerProfileId: cloneSource.printerProfileId ?? '',
      filaments: (cloneSource.filaments ?? []).map((f) => ({ filamentProfileId: f.filamentProfileId, weightGrams: f.weightGrams })),
      marketplaceFeeId: cloneSource.marketplaceFeeId ?? '',
      desiredMarkup: cloneSource.desiredMarkup,
      salePrice: String(cloneSource.salePrice),
      isBudget: cloneSource.lifecycleStatus === 'Orcamento' || isBudgetMode
    });
    setDuration(minutesToDurationParts(cloneSource.estimatedPrintTimeMinutes));
    setPainting(cloneSource.painting?.configuration.enabled
      ? { ...emptyPainting, ...cloneSource.painting.configuration, needsReview: true, keepStoredSnapshot: false, sourceProductId: null }
      : { ...emptyPainting, heightCm: cloneSource.heightCentimeters });
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
      productType: 'Impressao3D',
      name: projectDraft.name,
      sku: projectDraft.sku,
      description: projectDraft.description,
      categoryId: projectDraft.categoryId ?? '',
      supplierId: projectDraft.supplierId ?? '',
      pingenteSupplyId: '',
      pingenteCost: 0,
      bottonSizeId: '',
      bottonSizeQuantity: 1,
      generateProductionExpenseOnStockEntry: projectDraft.generateProductionExpenseOnStockEntry,
      currentStock: projectDraft.currentStock,
      itemsPerPlate: projectDraft.itemsPerPlate,
      estimatedPrintTimeMinutes: projectDraft.estimatedPrintTimeMinutes,
      heightCentimeters: projectDraft.heightCentimeters,
      lengthMetersUsed: projectDraft.lengthMetersUsed,
      tariffPerKwh: projectDraft.tariffPerKwh,
      finishingPercentage: projectDraft.finishingPercentage,
      commissionPercentage: projectDraft.commissionPercentage,
      additionalCost: projectDraft.additionalCost,
      laborCost: 0.5,
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
    if (isEditing || cloneFromId || isProjectDraftMode || !defaultFilamentId) {
      return;
    }

    setForm((current) => {
      if (current.filaments.length === 0) {
        return { ...current, filaments: [{ filamentProfileId: defaultFilamentId, weightGrams: 0 }] };
      }

      if (current.filaments[0].filamentProfileId) {
        return current;
      }

      return {
        ...current,
        filaments: current.filaments.map((item, index) => index === 0 ? { ...item, filamentProfileId: defaultFilamentId } : item)
      };
    });
  }, [cloneFromId, defaultFilamentId, isEditing, isProjectDraftMode]);

  useEffect(() => {
    if (isEditing || cloneFromId || isProjectDraftMode || !noneMarketplaceId) {
      return;
    }

    setForm((current) => current.marketplaceFeeId ? current : { ...current, marketplaceFeeId: noneMarketplaceId });
  }, [cloneFromId, isEditing, isProjectDraftMode, noneMarketplaceId]);

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

  const productHeightCm = Number(form.heightCentimeters) || 0;
  const paintingPayload = useMemo<ProductPaintingRequest>(() => ({
    ...painting,
    heightCm: painting.heightOverridden ? painting.heightCm : productHeightCm,
    sourceProductId: isEditing ? id ?? null : null
  }), [id, isEditing, painting, productHeightCm]);
  const debouncedPaintingPayload = useDebouncedValue(paintingPayload, 350);

  useEffect(() => {
    setPainting((current) => current.enabled && current.keepStoredSnapshot && !current.heightOverridden && current.heightCm !== productHeightCm
      ? { ...current, heightCm: productHeightCm, keepStoredSnapshot: false }
      : current);
  }, [productHeightCm]);

  const { data: paintingCalculation, isFetching: isPaintingCalculating, error: paintingError } = useQuery({
    queryKey: ['product-painting-preview', debouncedPaintingPayload],
    queryFn: () => paintingPricingApi.previewProduct(debouncedPaintingPayload),
    enabled: debouncedPaintingPayload.enabled && Boolean(paintingOverview) && (!isEditing || Boolean(product)),
    keepPreviousData: true,
    retry: false
  });

  function updatePainting(patch: Partial<ProductPaintingRequest>, affectsCalculation = true) {
    setDirty(true);
    setPainting((current) => {
      const next = { ...current, ...patch, keepStoredSnapshot: affectsCalculation ? false : current.keepStoredSnapshot };
      if (patch.enabled && !current.levelId && paintingOverview) {
        next.levelId = paintingOverview.levels.find((level) => level.isActive)?.id ?? null;
        next.complexityId = paintingOverview.complexities.find((complexity) => complexity.isActive)?.id ?? null;
        next.heightCm = productHeightCm;
      }
      return next;
    });
  }

  async function openRecalculation() {
    setRecalculationOpen(true);
    setRecalculation(null);
    setRecalculationError(null);
    if (!isEditing || !painting.keepStoredSnapshot || !product?.painting?.snapshot) {
      return;
    }

    setRecalculationLoading(true);
    try {
      setRecalculation(await productsApi.recalculatePainting(id!));
    }
    catch (error) {
      setRecalculationError(getErrorMessage(error, 'Não foi possível recalcular a pintura com os parâmetros atuais.'));
    }
    finally {
      setRecalculationLoading(false);
    }
  }

  function applyRecalculation() {
    setRecalculationOpen(false);
    setPaintingBannerDismissed(true);
    updatePainting({}, true);
  }

  const pricingPayload = useMemo(() => ({
    ...form,
    categoryId: form.categoryId || null,
    supplierId: (isSupplier ? session?.supplierId : form.supplierId) || null,
    printerProfileId: isPrint3D ? (form.printerProfileId || null) : null,
    filaments: isPrint3D ? form.filaments.filter((f) => f.filamentProfileId) : [],
    marketplaceFeeId: form.marketplaceFeeId || null,
    pingenteSupplyId: isEarring ? (form.pingenteSupplyId || null) : null,
    pingenteCost: isEarring ? Number(form.pingenteCost) : 0,
    bottonSizeId: isBotton ? (form.bottonSizeId || null) : null,
    bottonSizeQuantity: isBotton ? Number(form.bottonSizeQuantity) : 1,
    costPrice: null,
    commissionPercentage: Number(form.commissionPercentage),
    salePrice: form.salePrice === '' ? null : Number(form.salePrice),
    painting: debouncedPaintingPayload
  }), [form, isSupplier, session?.supplierId, isPrint3D, isEarring, isBotton, debouncedPaintingPayload]);

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
        printerProfileId: isPrint3D ? (form.printerProfileId || null) : null,
        filaments: isPrint3D ? form.filaments.filter((f) => f.filamentProfileId) : [],
        marketplaceFeeId: form.marketplaceFeeId || null,
        pingenteSupplyId: isEarring ? (form.pingenteSupplyId || null) : null,
        pingenteCost: isEarring ? Number(form.pingenteCost) : 0,
        bottonSizeId: isBotton ? (form.bottonSizeId || null) : null,
        bottonSizeQuantity: isBotton ? Number(form.bottonSizeQuantity) : 1,
        commissionPercentage: Number(form.commissionPercentage),
        desiredMarkup: Number(form.desiredMarkup),
        costPrice: null,
        isBudget: isBudgetMode || form.isBudget,
        salePrice: form.salePrice === '' ? null : Number(form.salePrice),
        painting: paintingPayload
      };

      return isProjectDraftMode
        ? projectsApi.concludeWithProduct(projectId!, payload)
        : isEditing
          ? productsApi.update(id!, payload)
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
    onError: (error) => {
      setFeedback(getErrorMessage(error, isProjectDraftMode
        ? 'Nao foi possivel concluir o projeto com o produto informado.'
        : 'Nao foi possivel salvar o produto com os dados informados.'));
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
  const hasMissingPrinterWithFilaments = isPrint3D && form.filaments.filter(f => f.filamentProfileId).length > 0 && form.printerProfileId === '';
  const hasMissingPingente = isEarring && !form.pingenteSupplyId;
  const hasMissingBottonSize = isBotton && !form.bottonSizeId;

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
      setForm((current) => ({
        ...current,
        filaments: [...current.filaments, { filamentProfileId: defaultFilamentId, weightGrams: 0 }]
      }));
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

  const pageTitle = isProjectDraftMode ? 'Pré-cadastro do produto do projeto' : isEditing ? (form.isBudget ? 'Editar orçamento' : 'Editar produto') : (isBudgetMode ? 'Novo orçamento' : 'Novo produto');
  const saveLabel = saveMutation.isLoading ? 'Salvando...' : isProjectDraftMode ? 'Concluir projeto e salvar produto' : isEditing ? 'Salvar alterações' : (isBudgetMode || form.isBudget ? 'Cadastrar orçamento' : 'Cadastrar produto');
  const saveDisabled = hasMissingCategory || hasMarkupBelowMinimum || hasManualPriceBelowMinimum || hasMissingPrinterWithFilaments || hasMissingPingente || hasMissingBottonSize;
  const unitMargin = effectiveSalePrice > 0 ? (estimatedProfit / effectiveSalePrice) * 100 : 0;
  const paintingDetails = paintingCalculation?.details ?? null;
  const paintedDetail = paintingDetails
    ? `${paintingDetails.level.name} • ${paintingDetails.complexity.name} • ${paintingDetails.totalHours.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h`
    : product?.painting?.levelName ? `${product.painting.levelName} • ${product.painting.complexityName ?? ''}` : null;
  const storedAtLabel = product?.painting?.snapshot ? new Date(product.painting.snapshot.calculatedAtUtc).toLocaleDateString('pt-BR') : undefined;
  const showOutdatedBanner = painting.enabled && painting.keepStoredSnapshot && Boolean(product?.painting?.hasNewerParameters) && !paintingBannerDismissed;
  const showKeptNote = painting.enabled && painting.keepStoredSnapshot && Boolean(product?.painting?.hasNewerParameters) && paintingBannerDismissed;
  const paintingApplicationNote = painting.enabled
    ? (painting.application === 'ReferenceOnly'
      ? applicationNotes.ReferenceOnly
      : `Pintura somada ao preço sugerido: + ${formatCurrency(pricing?.paintingPrice ?? 0)} (não entra no custo nem no preço mínimo).`)
    : null;
  const materialLabel = `Material${isEarring ? ' (pingente)' : isBotton ? ' (tamanho de botton)' : ''}`;

  return (
    <Stack spacing={3}>
      <ProductFormActionBar
        title={pageTitle}
        dirty={dirty}
        unitCost={formatCurrency(liveCost)}
        salePrice={formatCurrency(effectiveSalePrice)}
        unitProfit={formatCurrency(estimatedProfit)}
        margin={`${unitMargin.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
        profitPositive={estimatedProfit >= 0}
        saveLabel={saveLabel}
        mobileSaveLabel={isEditing ? 'Salvar' : 'Cadastrar'}
        isSaving={saveMutation.isLoading}
        saveDisabled={saveDisabled}
        saveTitle={hasMissingPrinterWithFilaments ? 'Selecione uma impressora quando há filamentos' : undefined}
        showPainted={painting.enabled}
        paintedDetail={paintedDetail}
        onBack={() => navigate(backTarget, { state: { preserveState: true } })}
        onSave={() => saveMutation.mutate()}
      />

      {isProjectDraftMode ? <Typography color="text.secondary">Revise os dados consolidados do projeto antes de concluir e vincular o produto.</Typography> : null}
      {feedback ? <Alert severity="warning">{feedback}</Alert> : null}
      {isFromOutsourcedProduction ? (
        <Alert severity="info">
          Este produto foi criado a partir de uma produção terceirizada. Os campos de custo estão bloqueados.
          Apenas <strong>Acabamento, Comissão, Markup</strong> e <strong>Preço de Venda</strong> podem ser alterados.
        </Alert>
      ) : null}
      {hasMissingCategory ? <Alert severity="warning">Selecione uma categoria para calcular e salvar o produto.</Alert> : null}
      {hasMarkupBelowMinimum ? <Alert severity="warning">O markup desejado nao pode ser menor do que 2.</Alert> : null}
      {hasManualPriceBelowMinimum ? <Alert severity="warning">O preco final nao pode ser menor do que {formatCurrency(minimumAllowedSalePrice)}.</Alert> : null}
      {hasMissingPingente ? <Alert severity="warning">Selecione o pingente utilizado no brinco.</Alert> : null}
      {hasMissingBottonSize ? <Alert severity="warning">Selecione o tamanho de botton utilizado.</Alert> : null}

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

      <PageSection title="1 · Identificação" subtitle="O que é o produto e onde ele é vendido.">
        <Stack spacing={2}>
            <TextField
              select
              fullWidth
              label="Tipo de produto"
              value={form.productType}
              onChange={(event) => updateForm('productType', event.target.value)}
              helperText="Define quais campos de produção aparecem abaixo. Impressão 3D mantém impressora e filamentos."
              disabled={isFromOutsourcedProduction}
            >
              <MenuItem value="Impressao3D">Impressão 3D</MenuItem>
              <MenuItem value="Brinco">Brinco</MenuItem>
              <MenuItem value="Botton">Botton</MenuItem>
            </TextField>
            <TextField fullWidth label="Nome" value={form.name} onChange={(event) => updateForm('name', capitalizeFirstLetter(event.target.value))} disabled={isFromOutsourcedProduction} />
            <TextField
              fullWidth
              label="SKU"
              value={form.sku}
              onChange={(event) => {
                updateForm('sku', event.target.value.toUpperCase());
              }}
              helperText="Se ficar vazio, será gerado automaticamente no padrão 00001-00000001."
              disabled={isFromOutsourcedProduction}
            />
            <TextField fullWidth label="Descrição" multiline minRows={3} value={form.description} onChange={(event) => updateForm('description', event.target.value)} disabled={isFromOutsourcedProduction} />

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              <SearchSelectField
                label="Categoria"
                value={form.categoryId}
                options={(metadata?.categories ?? []).map((item) => ({ id: item.id, name: item.name }))}
                onChange={(value) => updateForm('categoryId', value)}
                helperText="Busque e selecione a categoria. Nenhuma vem preenchida por padrão."
                placeholder="Digite o nome da categoria"
                minQueryLength={0}
                disabled={isFromOutsourcedProduction}
              />
              <TextField select label="Fornecedor" value={isSupplier ? (session?.supplierId ?? '') : form.supplierId} onChange={(event) => updateForm('supplierId', event.target.value)} fullWidth disabled={isSupplier || isFromOutsourcedProduction} helperText={isSupplier ? 'Vinculado automaticamente ao fornecedor logado.' : undefined}>
                {!isSupplier ? <MenuItem value="">Lojinha Sem Nome</MenuItem> : null}
                {(metadata?.suppliers ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
              </TextField>
              <TextField select label="Marketplace" value={form.marketplaceFeeId} onChange={(event) => updateForm('marketplaceFeeId', event.target.value)} fullWidth disabled={isFromOutsourcedProduction} helperText="Vem pré-selecionado como Nenhum.">
                {form.marketplaceFeeId === '' ? <MenuItem value="">— Sem marketplace —</MenuItem> : null}
                {(metadata?.marketplaces ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
              </TextField>
            </Box>
        </Stack>
      </PageSection>

      <PageSection title="2 · Produção e insumo" subtitle="Como o produto é feito — muda conforme o tipo escolhido.">
        <Stack spacing={2}>
            {isEarring ? (
              <>
                <Stack spacing={0.75}>
                  <Typography fontWeight={700}>Insumo do brinco</Typography>
                  <Divider />
                </Stack>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '2fr 1fr' } }}>
                  <SearchSelectField
                    label="Pingente"
                    value={form.pingenteSupplyId}
                    options={(metadata?.supplies ?? []).map((item) => ({ id: item.id, name: item.name }))}
                    onChange={(value) => updateForm('pingenteSupplyId', value)}
                    helperText="Buscado no cadastro de Insumos."
                    placeholder="Digite o nome do pingente"
                    minQueryLength={0}
                  />
                  <CurrencyField
                    label="Custo do pingente"
                    value={Number(form.pingenteCost)}
                    onValueChange={(value) => updateForm('pingenteCost', value)}
                    helperText="Pode variar por compra. Não baixa estoque."
                    fullWidth
                  />
                </Box>
              </>
            ) : null}

            {isBotton ? (
              <>
                <Stack spacing={0.75}>
                  <Typography fontWeight={700}>Insumo do botton</Typography>
                  <Divider />
                </Stack>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                  <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                    <SearchSelectField
                      label="Tamanho de botton"
                      value={form.bottonSizeId}
                      options={(metadata?.bottonSizes ?? []).map((item) => ({ id: item.id, name: item.name }))}
                      onChange={(value) => updateForm('bottonSizeId', value)}
                      helperText="Cadastro próprio em Tam. de Botton."
                      placeholder="Digite o nome do tamanho"
                      minQueryLength={0}
                    />
                  </Box>
                  <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                    <TextField
                      label="Qtd. consumida por unidade"
                      type="number"
                      value={form.bottonSizeQuantity}
                      onChange={(event) => updateForm('bottonSizeQuantity', Number(event.target.value))}
                      helperText="Quantas peças cada botton usa."
                      fullWidth
                    />
                  </Box>
                  <CurrencyField label="Custo do tamanho" value={selectedBottonSize?.costPerUnit ?? 0} onValueChange={() => undefined} helperText="Do cadastro de Tam. de Botton." fullWidth disabled />
                  <TextField label="Estoque atual do tamanho" value={selectedBottonSize ? `${selectedBottonSize.stockQuantity}` : '—'} helperText="Somente leitura." fullWidth disabled />
                  <Alert severity="info" sx={{ gridColumn: '1 / -1' }}>
                    A cada entrada em estoque deste botton, o estoque do tamanho selecionado é baixado na mesma proporção (qtd. por unidade × entrada), limitado a zero — nunca fica negativo.
                  </Alert>
                </Box>
              </>
            ) : null}

            {isPrint3D ? (
            <>
            <Stack spacing={0.75}>
              <Typography fontWeight={700}>Equipamentos e produção</Typography>
              <Divider />
            </Stack>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' } }}>
              <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                <TextField select label="Impressora" value={form.printerProfileId} onChange={(event) => updateForm('printerProfileId', event.target.value)} fullWidth disabled={isFromOutsourcedProduction}>
                  <MenuItem value="">Sem impressora</MenuItem>
                  {(metadata?.printers ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                </TextField>
              </Box>
              <TextField label="Itens por placa" type="number" value={form.itemsPerPlate} onChange={(event) => updateForm('itemsPerPlate', Number(event.target.value))} helperText="1 quando o custo já for unitário." fullWidth disabled={isFromOutsourcedProduction} />
              <CurrencyField label="Tarifa kWh" value={form.tariffPerKwh} onValueChange={(value) => updateForm('tariffPerKwh', value)} fullWidth disabled={isFromOutsourcedProduction} />
            </Box>

            <Stack spacing={1.25}>
              <Typography variant="body2" fontWeight={600}>Filamentos</Typography>
              {form.filaments.map((item, index) => (
                <Box key={index} sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 96px', sm: 'minmax(0, 1fr) 110px 44px' }, alignItems: 'start' }}>
                  <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                    <SearchSelectField
                      label="Filamento"
                      value={item.filamentProfileId}
                      options={(metadata?.filaments ?? []).map((f) => ({ id: f.id, name: f.name }))}
                      onChange={(value) => updateFilament(index, 'filamentProfileId', value)}
                      placeholder="Digite o nome do filamento"
                      minQueryLength={0}
                      helperText={undefined}
                      disabled={isFromOutsourcedProduction}
                    />
                  </Box>
                  <TextField
                    label="Peso (g)"
                    type="number"
                    value={item.weightGrams}
                    onChange={(event) => updateFilament(index, 'weightGrams', Number(event.target.value))}
                    fullWidth
                    disabled={isFromOutsourcedProduction}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 56 }}>
                    {index > 0 && !isFromOutsourcedProduction ? (
                      <IconButton onClick={() => removeFilament(index)} color="error" aria-label="Remover filamento">
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    ) : null}
                  </Box>
                </Box>
              ))}
              {!isFromOutsourcedProduction ? (
                <Button size="small" startIcon={<AddRoundedIcon />} onClick={addFilament} sx={{ alignSelf: 'flex-start' }}>
                  Adicionar filamento
                </Button>
              ) : null}
              {form.filaments.length > 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Peso total: {form.filaments.reduce((sum, f) => sum + (Number(f.weightGrams) || 0), 0).toFixed(0)} g
                </Typography>
              ) : null}
            </Stack>

            <div>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Tempo de impressão</Typography>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <TextField label="Horas" type="number" value={duration.hours} onChange={(event) => updateDurationPart('hours', Number(event.target.value))} fullWidth disabled={isFromOutsourcedProduction} />
                <TextField label="Min" type="number" value={duration.minutes} onChange={(event) => updateDurationPart('minutes', Number(event.target.value))} fullWidth disabled={isFromOutsourcedProduction} />
                <TextField label="Seg" type="number" value={duration.seconds} onChange={(event) => updateDurationPart('seconds', Number(event.target.value))} fullWidth disabled={isFromOutsourcedProduction} />
              </Box>
            </div>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <TextField label="Altura (cm)" type="number" value={form.heightCentimeters} onChange={(event) => updateForm('heightCentimeters', Number(event.target.value))} fullWidth disabled={isFromOutsourcedProduction} />
              <TextField label="Comprimento (m)" type="number" value={form.lengthMetersUsed} onChange={(event) => updateForm('lengthMetersUsed', Number(event.target.value))} fullWidth disabled={isFromOutsourcedProduction} />
            </Box>
            </>
            ) : null}
        </Stack>
      </PageSection>

      <ProductPaintingSection
        painting={{ ...painting, heightCm: painting.heightOverridden ? painting.heightCm : productHeightCm }}
        onChange={updatePainting}
        overview={paintingOverview}
        productHeightCm={productHeightCm}
        suppliers={metadata?.suppliers ?? []}
        calculation={painting.enabled ? paintingCalculation : null}
        isCalculating={isPaintingCalculating}
        calculationError={painting.enabled && paintingError ? getErrorMessage(paintingError, 'Não foi possível calcular a pintura com os dados informados.') : null}
        expanded={paintingExpanded}
        onToggleExpanded={() => setPaintingExpanded((current) => !current)}
        showOutdatedBanner={showOutdatedBanner}
        showKeptNote={showKeptNote}
        storedAtLabel={storedAtLabel}
        onKeepStored={() => setPaintingBannerDismissed(true)}
        onOpenRecalculation={openRecalculation}
      />

      <PageSection title="4 · Precificação" subtitle="Margens e preço final de venda.">
        <Stack spacing={2}>
            <Stack spacing={0.5}>
              <FormControlLabel
                control={<Checkbox checked={form.generateProductionExpenseOnStockEntry} onChange={(event) => updateForm('generateProductionExpenseOnStockEntry', event.target.checked)} disabled={isFromOutsourcedProduction} />}
                label="Gerar despesa de produção quando o produto entrar em estoque"
              />
              <FormControlLabel
                control={<Checkbox checked={isBudgetMode ? true : form.isBudget} onChange={(event) => updateForm('isBudget', event.target.checked)} disabled={isBudgetMode || isProjectDraftMode} />}
                label={isProjectDraftMode ? 'Produto final sempre salvo como produto disponível ao concluir o projeto' : isBudgetMode ? 'Cadastro fixo como orçamento nesta tela' : 'Salvar como orçamento'}
              />
            </Stack>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' } }}>
              <TextField label="Acabamento (%)" type="number" value={form.finishingPercentage} onChange={(event) => updateForm('finishingPercentage', Number(event.target.value))} fullWidth />
              <TextField label="Comissão (%)" type="number" value={form.commissionPercentage} onChange={(event) => updateForm('commissionPercentage', Number(event.target.value))} fullWidth />
              <CurrencyField label="Custo adicional" value={form.additionalCost} onValueChange={(value) => updateForm('additionalCost', value)} fullWidth disabled={isFromOutsourcedProduction} />
              <CurrencyField label="Mão de obra" value={form.laborCost} onValueChange={(value) => updateForm('laborCost', value)} helperText="Somado ao custo." fullWidth disabled={isFromOutsourcedProduction} />
              <TextField label="Markup desejado" type="number" value={form.desiredMarkup} onChange={(event) => updateForm('desiredMarkup', Number(event.target.value))} helperText="Mínimo 2 (200%)." fullWidth />
              <CurrencyField label="Preço final de venda" value={form.salePrice === '' ? 0 : Number(form.salePrice)} onValueChange={(value) => updateForm('salePrice', String(value))} helperText={`Mín: ${formatCurrency(minimumAllowedSalePrice)}`} fullWidth />
              <CurrencyField label="Preço p/ venda comissionada" value={effectiveCommissionedSalePrice} onValueChange={() => undefined} helperText="A partir do preço final + comissão." fullWidth disabled sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(71,51,40,0.06)' } }} />
              <CurrencyField label="Lucro estimado" value={estimatedProfit} onValueChange={() => undefined} helperText="Preço final menos custo." fullWidth InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-root': { bgcolor: estimatedProfit >= 0 ? '#eaf4e3' : 'rgba(211,47,47,0.08)', fontWeight: 700, color: estimatedProfit >= 0 ? '#3f6a2c' : 'error.main' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: estimatedProfit >= 0 ? 'rgba(79,122,58,0.35)' : undefined } }} />
            </Box>

        </Stack>
      </PageSection>

      <ProductCostSummarySection
        pricing={pricing}
        itemsPerPlate={Number(form.itemsPerPlate) || 1}
        commissionPercentage={Number(form.commissionPercentage)}
        desiredMarkup={Number(form.desiredMarkup)}
        materialLabel={materialLabel}
        isPrint3D={isPrint3D}
        persistedCost={isEditing && product ? product.costPrice : undefined}
        showDivergence={Boolean(isEditing && product && pricing && pricing.totalCost !== product.costPrice)}
        missingPrinterWarning={isPrint3D && form.printerProfileId === '' && form.filaments.length > 0}
        paintingApplicationNote={paintingApplicationNote}
        dirty={dirty}
      />

      <ProductProjectionSection
        pricing={pricing}
        unitCost={pricing?.totalCost ?? 0}
        salePrice={effectiveSalePrice}
        commissionPercentage={Number(form.commissionPercentage)}
        itemsPerPlate={Number(form.itemsPerPlate) || 1}
        isPrint3D={isPrint3D}
        isEarring={isEarring}
        isBotton={isBotton}
        filamentGramsPerPlate={form.filaments.reduce((sum, item) => sum + (Number(item.weightGrams) || 0), 0)}
        printMinutesPerPlate={Number(form.estimatedPrintTimeMinutes) || 0}
        bottonQuantityPerUnit={Number(form.bottonSizeQuantity || 1)}
        bottonStock={selectedBottonSize?.stockQuantity}
        onApplyPrice={(price) => updateForm('salePrice', String(price))}
      />

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

      <PaintingRecalculationDialog
        open={recalculationOpen}
        isLoading={recalculationLoading}
        error={recalculationError}
        data={recalculation}
        onCancel={() => setRecalculationOpen(false)}
        onApply={applyRecalculation}
      />
    </Stack>
  );
}
