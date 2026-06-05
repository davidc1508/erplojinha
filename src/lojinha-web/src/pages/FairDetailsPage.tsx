import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Tab,
  Tabs,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CurrencyField } from '../components/CurrencyField';
import { ProductLookupField } from '../components/ProductLookupField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { fairsApi, productsApi, salesApi } from '../services/api';
import { formatUtcDate, formatUtcDateRange, getTodayDateInputValue, isUtcDateTodayOrPast, toUtcDateOnlyIso } from '../services/date';
import { fairStatusLabel, formatCurrency, paymentMethodLabel } from '../services/labels';
import type { Sale } from '../services/types';

type FairSaleSortField = 'soldAtUtc' | 'totalAmount' | 'profitAmount';

export function FairDetailsPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [salesSearch, setSalesSearch] = useState('');
  const [salesPaymentFilter, setSalesPaymentFilter] = useState('all');
  const [salesStartDate, setSalesStartDate] = useState('');
  const [salesEndDate, setSalesEndDate] = useState('');
  const [salesSortField, setSalesSortField] = useState<FairSaleSortField>('soldAtUtc');
  const [salesSortDirection, setSalesSortDirection] = useState<'asc' | 'desc'>('desc');
  const [salesPage, setSalesPage] = useState(0);
  const [salesRowsPerPage, setSalesRowsPerPage] = useState(10);
  const [salesDayTab, setSalesDayTab] = useState('');
  const [saleForm, setSaleForm] = useState({
    paymentMethod: 'Pix',
    soldAtUtc: getTodayDateInputValue(),
    notes: '',
    createTodoForProducedItems: false,
    items: [{
      productId: '',
      supplierId: '',
      quantity: 1,
      unitPrice: '',
      lojinhaGainPercentage: '',
      isCommissionedSale: false,
      commissionSellerSupplierId: isSupplier ? (session?.supplierId ?? '') : '',
      commissionAmount: ''
    }]
  });
  const { data: fair } = useQuery({
    queryKey: ['fair', id],
    queryFn: () => fairsApi.getById(id!),
    enabled: Boolean(id)
  });
  const { data: report } = useQuery({
    queryKey: ['fair-report', id],
    queryFn: () => fairsApi.getReport(id!),
    enabled: Boolean(id)
  });
  const { data: products = [] } = useQuery({ queryKey: ['products-sales-catalog'], queryFn: productsApi.getSalesCatalog });

  function resolveDefaultSupplierId(productId: string) {
    const selectedProduct = products.find((product) => product.id === productId);
    if (!selectedProduct?.supplierId) {
      return '';
    }

    return fair?.suppliers.some((supplier) => supplier.supplierId === selectedProduct.supplierId)
      ? selectedProduct.supplierId
      : '';
  }

  const finalizeMutation = useMutation({
    mutationFn: async () => fairsApi.finalize(id!),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Feira finalizada. Novas vendas foram bloqueadas.' });
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['fair', id] });
      await queryClient.invalidateQueries({ queryKey: ['fair-report', id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => {
      setFeedback({ severity: 'error', message: 'Nao foi possivel finalizar a feira selecionada.' });
    }
  });

  const reopenMutation = useMutation({
    mutationFn: async () => fairsApi.reopen(id!),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Feira reaberta. Novas vendas foram liberadas.' });
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['fair', id] });
      await queryClient.invalidateQueries({ queryKey: ['fair-report', id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => {
      setFeedback({ severity: 'error', message: 'Nao foi possivel reabrir a feira selecionada.' });
    }
  });

  const startMutation = useMutation({
    mutationFn: async () => fairsApi.start(id!),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Feira iniciada. Novas vendas foram liberadas.' });
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['fair', id] });
      await queryClient.invalidateQueries({ queryKey: ['fair-report', id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => {
      setFeedback({ severity: 'error', message: 'Nao foi possivel iniciar a feira selecionada.' });
    }
  });

  const saleMutation = useMutation({
    mutationFn: async ({ keepOpen }: { keepOpen: boolean }) => {
      await fairsApi.registerSale(id!, {
        paymentMethod: saleForm.paymentMethod,
        soldAtUtc: toUtcDateOnlyIso(saleForm.soldAtUtc),
        notes: saleForm.notes,
        createTodoForProducedItems: saleForm.createTodoForProducedItems,
        items: saleForm.items.map((item) => ({
          productId: item.productId,
          supplierId: item.supplierId === '' ? null : item.supplierId,
          quantity: Number(item.quantity),
          unitPrice: item.unitPrice === '' ? null : Number(item.unitPrice),
          lojinhaGainPercentage: item.lojinhaGainPercentage === '' ? null : Number(item.lojinhaGainPercentage),
          isCommissionedSale: item.isCommissionedSale,
          commissionSellerSupplierId: item.isCommissionedSale
            ? (item.commissionSellerSupplierId === '' ? null : item.commissionSellerSupplierId)
            : null,
          commissionAmount: item.isCommissionedSale
            ? (item.commissionAmount === '' ? null : Number(item.commissionAmount))
            : null
        }))
      });
      return { keepOpen };
    },
    onSuccess: async ({ keepOpen }) => {
      setFeedback({ severity: 'success', message: 'Venda lançada na feira.' });
      setSaleForm({
        paymentMethod: 'Pix',
        soldAtUtc: getTodayDateInputValue(),
        notes: '',
        createTodoForProducedItems: false,
        items: [{
          productId: '',
          supplierId: '',
          quantity: 1,
          unitPrice: '',
          lojinhaGainPercentage: '',
          isCommissionedSale: false,
          commissionSellerSupplierId: isSupplier ? (session?.supplierId ?? '') : '',
          commissionAmount: ''
        }]
      });
      if (!keepOpen) {
        setIsSaleModalOpen(false);
      }
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['fair', id] });
      await queryClient.invalidateQueries({ queryKey: ['fair-report', id] });
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['products-sales-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['operational-restock'] });
    },
    onError: () => {
      setFeedback({ severity: 'error', message: 'Nao foi possivel registrar a venda para esta feira.' });
    }
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => salesApi.remove(saleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['fair', id] });
      await queryClient.invalidateQueries({ queryKey: ['fair-report', id] });
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['products-sales-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setFeedback({ severity: 'success', message: 'Venda removida da feira.' });
    },
    onError: () => {
      setFeedback({ severity: 'error', message: 'Nao foi possivel excluir a venda da feira.' });
    }
  });

  const deleteFairMutation = useMutation({
    mutationFn: async () => fairsApi.remove(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['products-sales-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      setIsDeleteDialogOpen(false);
      navigate('/feiras', { state: { preserveState: true } });
    },
    onError: () => {
      setFeedback({ severity: 'error', message: 'Nao foi possivel excluir a feira.' });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async () => fairsApi.cancel(id!),
    onSuccess: async () => {
      setIsCancelDialogOpen(false);
      setFeedback({ severity: 'success', message: 'Feira cancelada.' });
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['fair', id] });
      await queryClient.invalidateQueries({ queryKey: ['fair-report', id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      const message = typeof error === 'object' && error !== null && 'response' in error
        ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Nao foi possivel cancelar a feira selecionada.')
        : 'Nao foi possivel cancelar a feira selecionada.';
      setFeedback({ severity: 'error', message });
    }
  });

  function removeSaleItem(indexToRemove: number) {
    if (saleForm.items.length === 1) {
      return;
    }

    setSaleForm({
      ...saleForm,
      items: saleForm.items.filter((_, index) => index !== indexToRemove)
    });
  }

  function handleCloseSaleModal() {
    setIsSaleModalOpen(false);
  }

  async function handleExport() {
    if (!id) {
      return;
    }

    const blob = await fairsApi.exportReport(id);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feira-${id}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  const supplierItems = useMemo(() => report?.sales.flatMap((sale) => sale.items.filter((item) => item.supplierId)) ?? [], [report?.sales]);
  const supplierGrossRevenue = supplierItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const supplierCostAmount = supplierItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  const supplierLojinhaGain = supplierItems.reduce((sum, item) => sum + item.lojinhaGainAmount, 0);
  const supplierTransferAmount = supplierItems.reduce((sum, item) => sum + (item.totalPrice - (item.costPrice * item.quantity) - item.lojinhaGainAmount), 0);
  const ownSupplierItems = useMemo(() => report?.sales.flatMap((sale) => sale.items.filter((item) => item.supplierId === session?.supplierId)) ?? [], [report?.sales, session?.supplierId]);
  const ownSupplierGrossRevenue = ownSupplierItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const ownSupplierCostAmount = ownSupplierItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  const ownSupplierLojinhaGain = ownSupplierItems.reduce((sum, item) => sum + item.lojinhaGainAmount, 0);
  const ownSupplierTransferAmount = ownSupplierItems.reduce((sum, item) => sum + (item.totalPrice - (item.costPrice * item.quantity) - item.lojinhaGainAmount), 0);
  const supplierFeeShare = isSupplier && fair?.suppliers.some((supplier) => supplier.supplierId === session?.supplierId) && (fair?.suppliers.length ?? 0) > 0
    ? ((fair?.supplierRegistrationFee ?? 0) / (fair?.suppliers.length ?? 1))
    : 0;
  const ownSupplierResult = ownSupplierTransferAmount - supplierFeeShare;
  const suppliersSummary = Object.values(supplierItems.reduce<Record<string, { supplierId: string; supplierName: string; quantity: number; total: number; cost: number; gain: number }>>((acc, item) => {
    const key = item.supplierId ?? 'sem-fornecedor';
    if (!acc[key]) {
      acc[key] = { supplierId: item.supplierId ?? '', supplierName: item.supplierName ?? 'Lojinha Sem Nome', quantity: 0, total: 0, cost: 0, gain: 0 };
    }

    acc[key].quantity += item.quantity;
    acc[key].total += item.totalPrice;
    acc[key].cost += item.costPrice * item.quantity;
    acc[key].gain += item.lojinhaGainAmount;
    return acc;
  }, {})).sort((left, right) => right.total - left.total)
    .map((summary) => ({
      ...summary,
      transferAmount: summary.total - summary.cost - summary.gain
    }));
  const suppliersWithSales = (fair?.suppliers ?? []).map((supplier) => {
    const summary = suppliersSummary.find((item) => item.supplierId === supplier.supplierId);
    return summary ?? {
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      quantity: 0,
      total: 0,
      cost: 0,
      gain: 0,
      transferAmount: 0
    };
  });

  const canStartFair = !isSupplier && fair?.status === 'Awaiting' && Boolean(fair?.eventDateUtc) && isUtcDateTodayOrPast(fair.eventDateUtc);
  const canRegisterSale = fair?.status === 'Open';
  const canCancelFair = !isSupplier && (fair?.totalSales ?? 0) === 0 && (fair?.status === 'Awaiting' || fair?.status === 'Open');
  const supplierPool = report?.supplierRegistrationFee ?? 0;
  const supplierCount = report?.suppliers.length ?? 0;
  const averageQuotaPerSupplier = supplierCount > 0 ? supplierPool / supplierCount : 0;
  const isMultiDayFair = fair
    ? fair.eventDateUtc.slice(0, 10) !== fair.endDateUtc.slice(0, 10)
    : false;

  const sourceSales = report?.sales ?? [];
  const normalizedSalesSearch = salesSearch.trim().toLowerCase();
  const filteredSales = sourceSales.filter((sale) => {
    const soldAt = new Date(sale.soldAtUtc);
    const saleText = `${sale.items.map((item) => item.productName).join(' ')} ${sale.notes} ${paymentMethodLabel(sale.paymentMethod)}`.toLowerCase();
    const matchesSearch = normalizedSalesSearch.length === 0 || saleText.includes(normalizedSalesSearch);
    const matchesPayment = salesPaymentFilter === 'all' || sale.paymentMethod === salesPaymentFilter;
    const matchesStartDate = !salesStartDate || soldAt >= new Date(`${salesStartDate}T00:00:00`);
    const matchesEndDate = !salesEndDate || soldAt <= new Date(`${salesEndDate}T23:59:59`);

    return matchesSearch && matchesPayment && matchesStartDate && matchesEndDate;
  });

  const sortedSales = [...filteredSales].sort((left, right) => {
    const leftValue = salesSortField === 'soldAtUtc'
      ? new Date(left.soldAtUtc).getTime()
      : left[salesSortField];
    const rightValue = salesSortField === 'soldAtUtc'
      ? new Date(right.soldAtUtc).getTime()
      : right[salesSortField];
    const comparison = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
    return salesSortDirection === 'asc' ? comparison : -comparison;
  });

  const salesGroupedByDay = useMemo(() => {
    const groups = new Map<string, { label: string; sales: Sale[] }>();

    sortedSales.forEach((sale) => {
      const key = sale.soldAtUtc.slice(0, 10);
      if (!groups.has(key)) {
        groups.set(key, { label: formatUtcDate(sale.soldAtUtc), sales: [] });
      }

      groups.get(key)!.sales.push(sale);
    });

    return groups;
  }, [sortedSales]);

  const salesDayKeys = useMemo(
    () => Array.from(salesGroupedByDay.keys()),
    [salesGroupedByDay]
  );

  useEffect(() => {
    if (!isMultiDayFair) {
      setSalesDayTab('');
      return;
    }

    if (salesDayKeys.length === 0) {
      setSalesDayTab('');
      return;
    }

    if (!salesDayTab || !salesGroupedByDay.has(salesDayTab)) {
      setSalesDayTab(salesDayKeys[0]);
      setSalesPage(0);
    }
  }, [isMultiDayFair, salesDayKeys, salesDayTab, salesGroupedByDay]);

  const activeSales = useMemo(() => {
    if (!isMultiDayFair) {
      return sortedSales;
    }

    if (!salesDayTab) {
      return [];
    }

    return salesGroupedByDay.get(salesDayTab)?.sales ?? [];
  }, [isMultiDayFair, salesDayTab, salesGroupedByDay, sortedSales]);

  const pagedSales = useMemo(
    () => activeSales.slice(salesPage * salesRowsPerPage, salesPage * salesRowsPerPage + salesRowsPerPage),
    [activeSales, salesPage, salesRowsPerPage]
  );

  function handleSalesSort(field: FairSaleSortField) {
    if (field === salesSortField) {
      setSalesSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSalesSortField(field);
    setSalesSortDirection(field === 'soldAtUtc' ? 'desc' : 'asc');
  }

  if (!fair) {
    return (
      <Stack spacing={3}>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/feiras', { state: { preserveState: true } })} sx={{ alignSelf: 'flex-start' }}>
          Voltar para feiras
        </Button>
        <Typography color="text.secondary">Carregando dados da feira...</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h4">{fair.name}</Typography>
          <Typography color="text.secondary">{formatUtcDateRange(fair.eventDateUtc, fair.endDateUtc)} • {fair.location} • {fairStatusLabel(fair.status)}</Typography>
        </div>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/feiras', { state: { preserveState: true } })}>
            Voltar para feiras
          </Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setIsSaleModalOpen(true)} disabled={!canRegisterSale}>
            Registrar venda
          </Button>
          {canStartFair ? <Button variant="contained" color="secondary" startIcon={<TaskAltRoundedIcon />} onClick={() => startMutation.mutate()} disabled={startMutation.isLoading}>
            Iniciar feira
          </Button> : null}
          {!isSupplier ? <Button variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => navigate(`/feiras/${fair.id}/editar`, { state: { preserveState: true } })}>
            Editar cadastro
          </Button> : null}
          {canCancelFair ? <Button variant="outlined" color="warning" startIcon={<BlockRoundedIcon />} onClick={() => setIsCancelDialogOpen(true)} disabled={cancelMutation.isLoading}>
            Cancelar feira
          </Button> : null}
          {!isSupplier ? <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setIsDeleteDialogOpen(true)} disabled={deleteFairMutation.isLoading}>
            Excluir feira
          </Button> : null}
        </Stack>
      </Stack>

      {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

      <PageSection
        title="Relatório da feira"
        subtitle="Receita, lucro, itens vendidos e evolução diária do evento em tela própria."
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={handleExport}>Exportar CSV</Button>
            {canStartFair ? (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<TaskAltRoundedIcon />}
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isLoading}
              >
                Iniciar feira
              </Button>
            ) : null}
            {!isSupplier && fair.status === 'Open' ? (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<TaskAltRoundedIcon />}
                onClick={() => finalizeMutation.mutate()}
                disabled={finalizeMutation.isLoading}
              >
                Finalizar feira
              </Button>
            ) : null}
            {!isSupplier && fair.status !== 'Open' ? (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<ReplayRoundedIcon />}
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isLoading}
              >
                Reabrir feira
              </Button>
            ) : null}
          </Stack>
        }
      >
        {report ? (
          <Stack spacing={3}>
            <Grid container spacing={2}>
              {isSupplier ? (
                <>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Venda bruta</Typography><Typography variant="h5">{formatCurrency(ownSupplierGrossRevenue)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Custo das peças</Typography><Typography variant="h5">{formatCurrency(ownSupplierCostAmount)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Repasse estimado</Typography><Typography variant="h5">{formatCurrency(ownSupplierTransferAmount)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Sua cota da feira</Typography><Typography variant="h5">{formatCurrency(supplierFeeShare)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Resultado</Typography><Typography variant="h5">{formatCurrency(ownSupplierResult)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Ganho da lojinha</Typography><Typography variant="h5">{formatCurrency(ownSupplierLojinhaGain)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Caixinha sugerida</Typography><Typography variant="h5">{formatCurrency(Math.max(ownSupplierResult, 0) / 2)}</Typography></Paper></Grid>
                  {(() => {
                    const currentSupplierQuota = report.supplierQuotaStatus.find((item) => item.supplierId === session?.supplierId);
                    if (!currentSupplierQuota) {
                      return null;
                    }

                    return (
                      <>
                        <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Cota já paga</Typography><Typography variant="h5">{formatCurrency(currentSupplierQuota.paidAmount)}</Typography></Paper></Grid>
                        <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Cota em aberto</Typography><Typography variant="h5">{formatCurrency(currentSupplierQuota.outstandingAmount)}</Typography></Paper></Grid>
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Receita bruta</Typography><Typography variant="h5">{formatCurrency(report.grossRevenue)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Receita líquida</Typography><Typography variant="h5">{formatCurrency(report.netRevenue)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Caixinha</Typography><Typography variant="h5">{formatCurrency(report.piggyBankAmount)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Taxa total da feira</Typography><Typography variant="h5">{formatCurrency(report.registrationFee)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Dividido por</Typography><Typography variant="h5">{report.registrationFeeSplitCount} pessoa(s)</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">% da lojinha</Typography><Typography variant="h5">{report.storeFeePercentage.toFixed(2)}%</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Taxa da loja</Typography><Typography variant="h5">{formatCurrency(report.storeRegistrationFee)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Taxa dos fornecedores</Typography><Typography variant="h5">{formatCurrency(report.supplierRegistrationFee)}</Typography></Paper></Grid>
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Resultado</Typography><Typography variant="h5">{formatCurrency(report.result)}</Typography></Paper></Grid>
                  <Grid item xs={12}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Fornecedores participantes</Typography><Typography variant="h6">{report.suppliers.length === 0 ? 'Nenhum fornecedor vinculado' : report.suppliers.map((item) => item.supplierName).join(', ')}</Typography></Paper></Grid>
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography color="text.secondary" mb={1}>Acompanhamento de cotas dos fornecedores</Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Fornecedor</TableCell>
                            <TableCell>Cota devida</TableCell>
                            <TableCell>Pago</TableCell>
                            <TableCell>Em aberto</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {report.supplierQuotaStatus.map((quota) => (
                            <TableRow key={quota.supplierId}>
                              <TableCell>{quota.supplierName}</TableCell>
                              <TableCell>{formatCurrency(quota.quotaAmount)}</TableCell>
                              <TableCell>{formatCurrency(quota.paidAmount)}</TableCell>
                              <TableCell>{formatCurrency(quota.outstandingAmount)}</TableCell>
                              <TableCell>{quota.isSettled ? 'Quitado' : 'Em aberto'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Paper>
                  </Grid>
                </>
              )}
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.62)' }}>
                  <Typography variant="h6" mb={1}>Rateio transparente da cota</Typography>
                  <Typography color="text.secondary">Taxa total: {formatCurrency(report.registrationFee)}</Typography>
                  <Typography color="text.secondary">Parcela da lojinha ({report.storeFeePercentage.toFixed(2)}%): {formatCurrency(report.storeRegistrationFee)}</Typography>
                  <Typography color="text.secondary">Parcela dos fornecedores ({(100 - report.storeFeePercentage).toFixed(2)}%): {formatCurrency(supplierPool)}</Typography>
                  <Typography color="text.secondary">Fornecedores no rateio: {supplierCount}</Typography>
                  <Typography color="text.secondary" mb={1.5}>Cota média por fornecedor: {formatCurrency(averageQuotaPerSupplier)}</Typography>

                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fornecedor</TableCell>
                        <TableCell>Cota calculada</TableCell>
                        <TableCell>Cota lançada</TableCell>
                        <TableCell>Pago</TableCell>
                        <TableCell>Em aberto</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(isSupplier
                        ? report.supplierQuotaStatus.filter((item) => item.supplierId === session?.supplierId)
                        : report.supplierQuotaStatus).map((quota) => (
                        <TableRow key={quota.supplierId} sx={{ backgroundColor: quota.outstandingAmount > 0 ? 'rgba(217, 107, 135, 0.12)' : 'rgba(123, 207, 192, 0.12)' }}>
                          <TableCell>{quota.supplierName}</TableCell>
                          <TableCell>{formatCurrency(averageQuotaPerSupplier)}</TableCell>
                          <TableCell>{formatCurrency(quota.quotaAmount)}</TableCell>
                          <TableCell>{formatCurrency(quota.paidAmount)}</TableCell>
                          <TableCell>{formatCurrency(quota.outstandingAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Grid>
            </Grid>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={report.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="grossRevenue" fill="#d96b87" radius={[10, 10, 0, 0]} />
                <Bar dataKey="netRevenue" fill="#7bcfc0" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <Stack spacing={2}>
              <Typography variant="h6">Mais vendidos na feira</Typography>
              <Grid container spacing={1.5}>
                {report.topProducts.map((item) => (
                  <Grid item xs={12} sm={6} lg={4} key={item.productName}>
                    <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.62)' }}>
                      <Typography fontWeight={700}>{item.productName}</Typography>
                      <Typography color="text.secondary">{item.quantitySold} itens</Typography>
                      <Typography>{formatCurrency(item.revenue)}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Stack>

            <Stack spacing={2}>
              <Typography variant="h6">Vendas da feira</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Buscar venda"
                    value={salesSearch}
                    onChange={(event) => {
                      setSalesSearch(event.target.value);
                      setSalesPage(0);
                    }}
                    placeholder="Produto, observação ou pagamento"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    select
                    label="Pagamento"
                    value={salesPaymentFilter}
                    onChange={(event) => {
                      setSalesPaymentFilter(event.target.value);
                      setSalesPage(0);
                    }}
                    fullWidth
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="Pix">Pix</MenuItem>
                    <MenuItem value="CreditCard">Cartão crédito</MenuItem>
                    <MenuItem value="DebitCard">Cartão débito</MenuItem>
                    <MenuItem value="Cash">Dinheiro</MenuItem>
                    <MenuItem value="Transfer">Transferência</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    label="Data inicial"
                    type="date"
                    value={salesStartDate}
                    onChange={(event) => {
                      setSalesStartDate(event.target.value);
                      setSalesPage(0);
                    }}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    label="Data final"
                    type="date"
                    value={salesEndDate}
                    onChange={(event) => {
                      setSalesEndDate(event.target.value);
                      setSalesPage(0);
                    }}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    select
                    label="Itens por página"
                    value={String(salesRowsPerPage)}
                    onChange={(event) => {
                      setSalesRowsPerPage(Number(event.target.value));
                      setSalesPage(0);
                    }}
                    fullWidth
                  >
                    <MenuItem value="10">10</MenuItem>
                    <MenuItem value="20">20</MenuItem>
                    <MenuItem value="50">50</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              {isMultiDayFair ? (
                <Stack spacing={1}>
                  <Alert severity="info">Feira com mais de um dia: use as abas para navegar pelas vendas de cada data.</Alert>
                  <Paper sx={{ borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)', px: 1 }}>
                    <Tabs
                      value={salesDayTab}
                      onChange={(_event, value) => {
                        setSalesDayTab(value);
                        setSalesPage(0);
                      }}
                      variant="scrollable"
                      scrollButtons="auto"
                    >
                      {salesDayKeys.map((key) => {
                        const group = salesGroupedByDay.get(key);
                        return (
                          <Tab
                            key={key}
                            value={key}
                            label={`${group?.label ?? key} (${group?.sales.length ?? 0})`}
                          />
                        );
                      })}
                    </Tabs>
                  </Paper>
                </Stack>
              ) : null}
              <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Table size="small" sx={{ minWidth: 1100 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <TableSortLabel
                          active={salesSortField === 'soldAtUtc'}
                          direction={salesSortField === 'soldAtUtc' ? salesSortDirection : 'desc'}
                          onClick={() => handleSalesSort('soldAtUtc')}
                        >
                          Data
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Produtos vendidos</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <TableSortLabel
                          active={salesSortField === 'totalAmount'}
                          direction={salesSortField === 'totalAmount' ? salesSortDirection : 'asc'}
                          onClick={() => handleSalesSort('totalAmount')}
                        >
                          Receita bruta
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <TableSortLabel
                          active={salesSortField === 'profitAmount'}
                          direction={salesSortField === 'profitAmount' ? salesSortDirection : 'asc'}
                          onClick={() => handleSalesSort('profitAmount')}
                        >
                          Lucro lojinha
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Caixinha</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Pagamento</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', minWidth: 120, pr: 2 }}>Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedSales.map((sale) => {
                      const totalItems = sale.items.reduce((sum, item) => sum + item.quantity, 0);
                      const piggyBankAmount = Math.max(sale.profitAmount, 0) / 2;

                      return (
                        <TableRow key={sale.id} hover>
                          <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>{formatUtcDate(sale.soldAtUtc)}</TableCell>
                          <TableCell sx={{ py: 1.5, minWidth: 360 }}>
                            <Typography fontWeight={700} sx={{ lineHeight: 1.3 }}>
                              {sale.items.map((item) => item.productName).join(', ')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {totalItems} item(ns) • {sale.items.length} produto(s)
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }}>{formatCurrency(sale.totalAmount)}</TableCell>
                          <TableCell sx={{ py: 1.5 }}>{formatCurrency(sale.profitAmount)}</TableCell>
                          <TableCell sx={{ py: 1.5 }}>{formatCurrency(piggyBankAmount)}</TableCell>
                          <TableCell sx={{ py: 1.5 }}>{paymentMethodLabel(sale.paymentMethod)}</TableCell>
                          <TableCell align="right" sx={{ py: 1.5, pr: 1.5, whiteSpace: 'nowrap' }}>
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ minWidth: 90 }}>
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/vendas/${sale.id}`, { state: { preserveState: true } })}
                                aria-label="Abrir venda"
                                sx={{ border: '1px solid rgba(217, 107, 135, 0.45)', borderRadius: 1.5 }}
                              >
                                <OpenInNewRoundedIcon fontSize="small" />
                              </IconButton>
                              {sale.canDelete ? <IconButton size="small" color="error" onClick={() => setSaleToDelete(sale.id)} disabled={deleteSaleMutation.isLoading} aria-label="Excluir venda">
                                <DeleteOutlineRoundedIcon fontSize="small" />
                              </IconButton> : null}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
              {pagedSales.length === 0 ? <Alert severity="info">Nenhuma venda encontrada com os filtros selecionados.</Alert> : null}
              <TablePagination
                component="div"
                count={activeSales.length}
                page={salesPage}
                onPageChange={(_event, page) => setSalesPage(page)}
                rowsPerPage={salesRowsPerPage}
                onRowsPerPageChange={(event) => {
                  setSalesRowsPerPage(Number(event.target.value));
                  setSalesPage(0);
                }}
                rowsPerPageOptions={[10, 20, 50]}
                labelRowsPerPage="Itens por página"
              />
            </Stack>
            <Grid container spacing={2}>
              <Grid item xs={12}><Typography variant="h6">{isSupplier ? 'Resumo dos fornecedores na feira' : 'Visão de fornecedores'}</Typography></Grid>
              {!isSupplier ? <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Venda bruta de fornecedores</Typography><Typography variant="h5">{formatCurrency(supplierGrossRevenue)}</Typography></Paper></Grid> : null}
              {!isSupplier ? <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Custo das peças</Typography><Typography variant="h5">{formatCurrency(supplierCostAmount)}</Typography></Paper></Grid> : null}
              {!isSupplier ? <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Ganho da lojinha</Typography><Typography variant="h5">{formatCurrency(supplierLojinhaGain)}</Typography></Paper></Grid> : null}
              {!isSupplier ? <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Repasse estimado</Typography><Typography variant="h5">{formatCurrency(supplierTransferAmount)}</Typography></Paper></Grid> : null}
              {(isSupplier ? suppliersWithSales.filter((supplier) => supplier.supplierId === session?.supplierId) : suppliersWithSales).map((supplier) => (
                <Grid item xs={12} lg={6} key={supplier.supplierId || supplier.supplierName}>
                  <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.62)' }}>
                    <Stack spacing={1}>
                      <Typography variant="h6">{supplier.supplierName}</Typography>
                      <Grid container spacing={1.5}>
                        <Grid item xs={6}><Typography color="text.secondary">Itens vendidos</Typography><Typography fontWeight={700}>{supplier.quantity}</Typography></Grid>
                        <Grid item xs={6}><Typography color="text.secondary">Venda bruta</Typography><Typography fontWeight={700}>{formatCurrency(supplier.total)}</Typography></Grid>
                        <Grid item xs={6}><Typography color="text.secondary">Custo das peças</Typography><Typography fontWeight={700}>{formatCurrency(supplier.cost)}</Typography></Grid>
                        <Grid item xs={6}><Typography color="text.secondary">Ganho da lojinha</Typography><Typography fontWeight={700}>{formatCurrency(supplier.gain)}</Typography></Grid>
                        <Grid item xs={6}><Typography color="text.secondary">Repasse estimado</Typography><Typography fontWeight={700}>{formatCurrency(supplier.transferAmount)}</Typography></Grid>
                      </Grid>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
              {!isSupplier ? <Grid item xs={12}>
                <Stack spacing={1.5}>
                  {suppliersWithSales.length === 0 ? <Alert severity="info">Nenhum fornecedor vinculado a esta feira.</Alert> : suppliersWithSales.map((supplier) => (
                    <Paper key={supplier.supplierId || supplier.supplierName} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.62)' }}>
                      <Typography fontWeight={700}>{supplier.supplierName}</Typography>
                      <Typography color="text.secondary">Itens vendidos: {supplier.quantity}</Typography>
                      <Typography color="text.secondary">Valor bruto: {formatCurrency(supplier.total)}</Typography>
                      <Typography color="text.secondary">Custo das peças: {formatCurrency(supplier.cost)}</Typography>
                      <Typography>Ganho da lojinha: {formatCurrency(supplier.gain)}</Typography>
                    </Paper>
                  ))}
                </Stack>
              </Grid> : null}
            </Grid>
          </Stack>
        ) : (
          <Typography color="text.secondary">Carregando relatório da feira...</Typography>
        )}
      </PageSection>

      <ConfirmDialog
        open={saleToDelete !== null}
        title="Excluir venda"
        description="Deseja excluir esta venda? O estoque e o financeiro serão recalculados."
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteSaleMutation.isLoading}
        onCancel={() => setSaleToDelete(null)}
        onConfirm={() => {
          if (saleToDelete) {
            deleteSaleMutation.mutate(saleToDelete);
          }
        }}
      />

      <ConfirmDialog
        open={isCancelDialogOpen}
        title="Cancelar feira"
        description="Deseja cancelar esta feira? Ela deixará de aceitar vendas e poderá ser reaberta depois se necessário."
        confirmLabel="Cancelar feira"
        confirmColor="secondary"
        isLoading={cancelMutation.isLoading}
        onCancel={() => setIsCancelDialogOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
      />

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title="Excluir feira"
        description="Deseja excluir esta feira? Se houver vendas relacionadas, elas também serão removidas."
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteFairMutation.isLoading}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteFairMutation.mutate()}
      />

      <Dialog open={isSaleModalOpen} onClose={handleCloseSaleModal} fullWidth maxWidth="md">
        <DialogTitle>Registrar venda na feira</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">Lançamento válido apenas enquanto a feira estiver em aberto.</Typography>
          {!canRegisterSale ? <Alert severity="warning">Esta feira ainda nao esta em aberto para registrar vendas.</Alert> : null}
          <TextField select label="Forma de pagamento" value={saleForm.paymentMethod} onChange={(event) => setSaleForm({ ...saleForm, paymentMethod: event.target.value })}>
            {['Pix', 'CreditCard', 'DebitCard', 'Cash', 'Transfer'].map((method) => <MenuItem key={method} value={method}>{paymentMethodLabel(method)}</MenuItem>)}
          </TextField>
          <TextField
            label="Data da venda"
            type="date"
            value={saleForm.soldAtUtc}
            onChange={(event) => setSaleForm({ ...saleForm, soldAtUtc: event.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          {saleForm.items.map((item, index) => (
            <Grid container spacing={2} key={`${index}-${item.productId}`}>
              <Grid item xs={12} sm={saleForm.items.length > 1 ? 10 : 12}>
                <ProductLookupField
                  label={`Produto ${index + 1}`}
                  value={item.productId}
                  products={products}
                  onChange={(productId) => {
                    const selectedProduct = products.find((product) => product.id === productId);
                    const items = [...saleForm.items];
                    const defaultSupplierId = resolveDefaultSupplierId(productId);
                    items[index] = {
                      ...item,
                      productId,
                      supplierId: defaultSupplierId,
                      unitPrice: selectedProduct ? String(item.isCommissionedSale ? selectedProduct.commissionedSalePrice : selectedProduct.salePrice) : '',
                      lojinhaGainPercentage: defaultSupplierId !== '' ? item.lojinhaGainPercentage : '',
                      commissionAmount: selectedProduct && item.isCommissionedSale
                        ? String(Math.max(0, selectedProduct.commissionedSalePrice - selectedProduct.salePrice))
                        : ''
                    };
                    setSaleForm({ ...saleForm, items });
                  }}
                  disabled={!canRegisterSale}
                />
              </Grid>
              {saleForm.items.length > 1 ? (
                <Grid item xs={12} sm={2} display="flex" justifyContent="flex-end" alignItems="center">
                  <IconButton color="error" onClick={() => removeSaleItem(index)} aria-label={`Remover produto ${index + 1}`} disabled={!canRegisterSale}>
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Grid>
              ) : null}
              <Grid item xs={12} sm={6}><TextField label="Quantidade" type="number" value={item.quantity} onChange={(event) => {
                const items = [...saleForm.items];
                items[index] = { ...item, quantity: Number(event.target.value) };
                setSaleForm({ ...saleForm, items });
              }} fullWidth disabled={!canRegisterSale} /></Grid>
              <Grid item xs={12} sm={6}><CurrencyField label="Preço unitário" value={item.unitPrice === '' ? 0 : Number(item.unitPrice)} onValueChange={(value) => {
                const items = [...saleForm.items];
                items[index] = { ...item, unitPrice: String(value) };
                setSaleForm({ ...saleForm, items });
              }} fullWidth disabled={!canRegisterSale} /></Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Checkbox checked={item.isCommissionedSale} onChange={(event) => {
                    const selectedProduct = products.find((product) => product.id === item.productId);
                    const nextIsCommissionedSale = event.target.checked;
                    const items = [...saleForm.items];
                    items[index] = {
                      ...item,
                      isCommissionedSale: nextIsCommissionedSale,
                      unitPrice: selectedProduct
                        ? String(nextIsCommissionedSale ? selectedProduct.commissionedSalePrice : selectedProduct.salePrice)
                        : item.unitPrice,
                      commissionSellerSupplierId: nextIsCommissionedSale
                        ? (item.commissionSellerSupplierId || (isSupplier ? (session?.supplierId ?? '') : ''))
                        : '',
                      commissionAmount: nextIsCommissionedSale && selectedProduct
                        ? String(Math.max(0, selectedProduct.commissionedSalePrice - selectedProduct.salePrice))
                        : ''
                    };
                    setSaleForm({ ...saleForm, items });
                  }} disabled={!canRegisterSale} />}
                  label="Venda comissionada"
                />
              </Grid>
              {fair.suppliers.length > 0 ? (
                <Grid item xs={12}>
                  <TextField
                    select
                    label="Produto de fornecedor"
                    value={item.supplierId}
                    onChange={(event) => {
                      const items = [...saleForm.items];
                      const supplierId = event.target.value;
                      items[index] = {
                        ...item,
                        supplierId,
                        lojinhaGainPercentage: supplierId === '' ? '' : item.lojinhaGainPercentage
                      };
                      setSaleForm({ ...saleForm, items });
                    }}
                    helperText="Selecione um fornecedor para registrar a venda como consignada."
                    fullWidth
                    disabled={!canRegisterSale}
                  >
                    <MenuItem value="">Lojinha Sem Nome</MenuItem>
                    {fair.suppliers.map((supplier) => <MenuItem key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</MenuItem>)}
                  </TextField>
                </Grid>
              ) : null}
              {item.isCommissionedSale ? (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      label="Fornecedor vendedor"
                      value={item.commissionSellerSupplierId}
                      onChange={(event) => {
                        const items = [...saleForm.items];
                        items[index] = { ...item, commissionSellerSupplierId: event.target.value };
                        setSaleForm({ ...saleForm, items });
                      }}
                      helperText="Fornecedor que realizou a venda comissionada."
                      fullWidth
                      disabled={!canRegisterSale || isSupplier}
                    >
                      {!isSupplier ? <MenuItem value="">Selecione</MenuItem> : null}
                      {fair.suppliers.map((supplier) => <MenuItem key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <CurrencyField
                      label="Valor da comissão"
                      value={item.commissionAmount === '' ? 0 : Number(item.commissionAmount)}
                      onValueChange={(value) => {
                        const items = [...saleForm.items];
                        items[index] = { ...item, commissionAmount: String(value) };
                        setSaleForm({ ...saleForm, items });
                      }}
                      helperText="Campo livre. Esse valor será descontado no lançamento do vendedor."
                      fullWidth
                      disabled={!canRegisterSale}
                    />
                  </Grid>
                </>
              ) : null}
              {item.supplierId ? (
                <Grid item xs={12}>
                  <TextField
                    label={`% de ganho da lojinha (${fair.suppliers.find((supplier) => supplier.supplierId === item.supplierId)?.supplierName ?? 'fornecedor'})`}
                    type="number"
                    value={item.lojinhaGainPercentage}
                    onChange={(event) => {
                      const items = [...saleForm.items];
                      items[index] = { ...item, lojinhaGainPercentage: event.target.value };
                      setSaleForm({ ...saleForm, items });
                    }}
                    helperText="Opcional. Se ficar 0, não gera ganho para a lojinha nesse item."
                    fullWidth
                    disabled={!canRegisterSale}
                  />
                </Grid>
              ) : null}
            </Grid>
          ))}
          <Button variant="outlined" onClick={() => setSaleForm({
            ...saleForm,
            items: [...saleForm.items, {
              productId: '',
              supplierId: '',
              quantity: 1,
              unitPrice: '',
              lojinhaGainPercentage: '',
              isCommissionedSale: false,
              commissionSellerSupplierId: isSupplier ? (session?.supplierId ?? '') : '',
              commissionAmount: ''
            }]
          })} sx={{ alignSelf: 'flex-start' }} disabled={!canRegisterSale}>
            Adicionar item
          </Button>
          <TextField label="Observações" multiline minRows={3} value={saleForm.notes} onChange={(event) => setSaleForm({ ...saleForm, notes: event.target.value })} disabled={!canRegisterSale} />
          <FormControlLabel
            control={<Checkbox checked={saleForm.createTodoForProducedItems} onChange={(event) => setSaleForm({ ...saleForm, createTodoForProducedItems: event.target.checked })} disabled={!canRegisterSale} />}
            label="Gerar automaticamente item(s) em Reposição de produtos"
          />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={handleCloseSaleModal}>Cancelar</Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => saleMutation.mutate({ keepOpen: true })}
            disabled={!canRegisterSale || saleMutation.isLoading || saleForm.items.some((item) => !item.productId || (item.isCommissionedSale && (!item.commissionSellerSupplierId || item.commissionAmount === '')))}
          >
            Salvar e lançar outra
          </Button>
          <Button
            variant="contained"
            onClick={() => saleMutation.mutate({ keepOpen: false })}
            disabled={!canRegisterSale || saleMutation.isLoading || saleForm.items.some((item) => !item.productId || (item.isCommissionedSale && (!item.commissionSellerSupplierId || item.commissionAmount === '')))}
          >
            Registrar venda na feira
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
