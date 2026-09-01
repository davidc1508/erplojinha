import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CurrencyField } from '../components/CurrencyField';
import { ProductLookupField } from '../components/ProductLookupField';
import { useAuth } from '../hooks/useAuth';
import { fairsApi, productsApi, salesApi } from '../services/api';
import { formatUtcDate, formatUtcDateRange, getTodayDateInputValue, isUtcDateTodayOrPast, toUtcDateOnlyIso } from '../services/date';
import { fairStatusLabel, formatCurrency, paymentMethodLabel } from '../services/labels';
import type { Sale } from '../services/types';

type FairSaleSortField = 'soldAtUtc' | 'totalAmount' | 'profitAmount';

const EXPENSE_KINDS = [
  { key: 'Alimentacao', label: 'Alimentação', color: '#e1a657' },
  { key: 'Combustivel', label: 'Combustível', color: '#d96b87' },
  { key: 'Hospedagem', label: 'Hospedagem', color: '#7bcfc0' },
  { key: 'Transporte', label: 'Transporte', color: '#79a95f' },
  { key: 'Outros', label: 'Outros', color: '#8a7365' }
];

function expenseKind(key: string) {
  return EXPENSE_KINDS.find((item) => item.key === key) ?? EXPENSE_KINDS[EXPENSE_KINDS.length - 1];
}

const PAYMENT_METHODS = ['Pix', 'Cash', 'CreditCard', 'DebitCard', 'Transfer'];

export function FairDetailsPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [tab, setTab] = useState<'vendas' | 'despesas' | 'fornecedores' | 'analise'>('vendas');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ kind: 'Alimentacao', description: '', amount: '', occurredOnUtc: getTodayDateInputValue() });
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isFinalizeChecklistOpen, setIsFinalizeChecklistOpen] = useState(false);
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

  useEffect(() => {
    if (isSupplier && tab === 'despesas') {
      setTab('vendas');
    }
  }, [isSupplier, tab]);

  function resolveDefaultSupplierId(productId: string) {
    const selectedProduct = products.find((product) => product.id === productId);
    if (!selectedProduct?.supplierId) {
      return '';
    }

    return fair?.suppliers.some((supplier) => supplier.supplierId === selectedProduct.supplierId)
      ? selectedProduct.supplierId
      : '';
  }

  function invalidateFairQueries() {
    queryClient.invalidateQueries({ queryKey: ['fairs'] });
    queryClient.invalidateQueries({ queryKey: ['fair', id] });
    queryClient.invalidateQueries({ queryKey: ['fair-report', id] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  const finalizeMutation = useMutation({
    mutationFn: async () => fairsApi.finalize(id!),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Feira finalizada. Novas vendas foram bloqueadas.' });
      invalidateFairQueries();
    },
    onError: () => setFeedback({ severity: 'error', message: 'Nao foi possivel finalizar a feira selecionada.' })
  });

  const reopenMutation = useMutation({
    mutationFn: async () => fairsApi.reopen(id!),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Feira reaberta. Novas vendas foram liberadas.' });
      invalidateFairQueries();
    },
    onError: () => setFeedback({ severity: 'error', message: 'Nao foi possivel reabrir a feira selecionada.' })
  });

  const startMutation = useMutation({
    mutationFn: async () => fairsApi.start(id!),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Feira iniciada. Novas vendas foram liberadas.' });
      invalidateFairQueries();
    },
    onError: () => setFeedback({ severity: 'error', message: 'Nao foi possivel iniciar a feira selecionada.' })
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
      invalidateFairQueries();
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['products-sales-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['operational-restock'] });
    },
    onError: () => setFeedback({ severity: 'error', message: 'Nao foi possivel registrar a venda para esta feira.' })
  });

  const addExpenseMutation = useMutation({
    mutationFn: async () => fairsApi.addExpense(id!, {
      kind: expenseForm.kind,
      description: expenseForm.description.trim(),
      amount: Number(expenseForm.amount),
      occurredOnUtc: toUtcDateOnlyIso(expenseForm.occurredOnUtc)
    }),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Despesa lançada na feira.' });
      setExpenseForm({ kind: 'Alimentacao', description: '', amount: '', occurredOnUtc: getTodayDateInputValue() });
      setIsExpenseModalOpen(false);
      invalidateFairQueries();
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
    },
    onError: () => setFeedback({ severity: 'error', message: 'Nao foi possivel lançar a despesa da feira.' })
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => fairsApi.removeExpense(id!, expenseId),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Despesa removida da feira.' });
      setExpenseToDelete(null);
      invalidateFairQueries();
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
    },
    onError: () => setFeedback({ severity: 'error', message: 'Nao foi possivel remover a despesa da feira.' })
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => salesApi.remove(saleId),
    onSuccess: async () => {
      invalidateFairQueries();
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['products-sales-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setFeedback({ severity: 'success', message: 'Venda removida da feira.' });
    },
    onError: () => setFeedback({ severity: 'error', message: 'Nao foi possivel excluir a venda da feira.' })
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
    onError: () => setFeedback({ severity: 'error', message: 'Nao foi possivel excluir a feira.' })
  });

  const cancelMutation = useMutation({
    mutationFn: async () => fairsApi.cancel(id!),
    onSuccess: async () => {
      setIsCancelDialogOpen(false);
      setFeedback({ severity: 'success', message: 'Feira cancelada.' });
      invalidateFairQueries();
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

    setSaleForm({ ...saleForm, items: saleForm.items.filter((_, index) => index !== indexToRemove) });
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
    .map((summary) => ({ ...summary, transferAmount: summary.total - summary.cost - summary.gain }));
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
  const isMultiDayFair = fair ? fair.eventDateUtc.slice(0, 10) !== fair.endDateUtc.slice(0, 10) : false;

  const salesCount = report?.sales.length ?? 0;
  const itemsSold = report?.totalItemsSold ?? 0;
  const averageTicket = salesCount > 0 ? (report?.grossRevenue ?? 0) / salesCount : 0;

  const expensesByKind = useMemo(() => {
    const totals = new Map<string, number>();
    (report?.expenses ?? []).forEach((expense) => {
      totals.set(expense.kind, (totals.get(expense.kind) ?? 0) + expense.amount);
    });
    return EXPENSE_KINDS.map((kind) => ({ ...kind, total: totals.get(kind.key) ?? 0 }));
  }, [report?.expenses]);

  const paymentBreakdown = useMemo(() => {
    const sales = report?.sales ?? [];
    const grouped = PAYMENT_METHODS.map((method) => {
      const rows = sales.filter((sale) => sale.paymentMethod === method);
      return { method, count: rows.length, total: rows.reduce((sum, sale) => sum + sale.totalAmount, 0) };
    }).filter((row) => row.count > 0);
    return grouped.sort((left, right) => right.total - left.total);
  }, [report?.sales]);

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
    const leftValue = salesSortField === 'soldAtUtc' ? new Date(left.soldAtUtc).getTime() : left[salesSortField];
    const rightValue = salesSortField === 'soldAtUtc' ? new Date(right.soldAtUtc).getTime() : right[salesSortField];
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

  const salesDayKeys = useMemo(() => Array.from(salesGroupedByDay.keys()), [salesGroupedByDay]);

  useEffect(() => {
    if (!isMultiDayFair || salesDayKeys.length === 0) {
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

  const statusColor: 'success' | 'warning' | 'default' | 'error' =
    fair.status === 'Open' ? 'success' : fair.status === 'Awaiting' ? 'warning' : fair.status === 'Cancelled' ? 'error' : 'default';

  const bandCells = isSupplier
    ? [
        { label: 'Venda bruta', value: formatCurrency(ownSupplierGrossRevenue) },
        { label: 'Custo das peças', value: formatCurrency(ownSupplierCostAmount) },
        { label: 'Repasse estimado', value: formatCurrency(ownSupplierTransferAmount) },
        { label: '− Sua cota', value: formatCurrency(supplierFeeShare) },
        { label: '= Resultado', value: formatCurrency(ownSupplierResult), emphasis: true, negative: ownSupplierResult < 0 },
        { label: 'Caixinha sugerida', value: formatCurrency(Math.max(ownSupplierResult, 0) / 2) }
      ]
    : [
        { label: 'Receita bruta', value: formatCurrency(report?.grossRevenue ?? 0) },
        { label: 'Lucro das vendas', value: formatCurrency(report?.netRevenue ?? 0) },
        { label: '− Taxa da feira', value: formatCurrency(report?.storeRegistrationFee ?? 0) },
        { label: '− Despesas', value: formatCurrency(report?.totalExpenses ?? 0) },
        { label: '= Resultado', value: formatCurrency(report?.result ?? 0), emphasis: true, negative: (report?.result ?? 0) < 0 },
        { label: 'Caixinha', value: formatCurrency(report?.piggyBankAmount ?? 0) }
      ];

  const tabDefs: { key: typeof tab; label: string; count?: number }[] = isSupplier
    ? [
        { key: 'vendas', label: 'Vendas', count: salesCount },
        { key: 'fornecedores', label: 'Meu resumo' },
        { key: 'analise', label: 'Análise' }
      ]
    : [
        { key: 'vendas', label: 'Vendas', count: salesCount },
        { key: 'despesas', label: 'Despesas', count: report?.expenses?.length ?? 0 },
        { key: 'fornecedores', label: 'Fornecedores', count: fair.suppliers.length },
        { key: 'analise', label: 'Análise' }
      ];

  function closeMenu() {
    setMenuAnchor(null);
  }

  function runFromMenu(action: () => void) {
    closeMenu();
    action();
  }

  const salesFilters = (
    <Grid container spacing={1.5}>
      <Grid item xs={12} md={4}>
        <TextField label="Buscar venda" value={salesSearch} onChange={(event) => { setSalesSearch(event.target.value); setSalesPage(0); }} placeholder="Produto, observação ou pagamento" fullWidth size="small" />
      </Grid>
      <Grid item xs={6} md={2}>
        <TextField select label="Pagamento" value={salesPaymentFilter} onChange={(event) => { setSalesPaymentFilter(event.target.value); setSalesPage(0); }} fullWidth size="small">
          <MenuItem value="all">Todos</MenuItem>
          {PAYMENT_METHODS.map((method) => <MenuItem key={method} value={method}>{paymentMethodLabel(method)}</MenuItem>)}
        </TextField>
      </Grid>
      <Grid item xs={6} md={2}>
        <TextField label="Data inicial" type="date" value={salesStartDate} onChange={(event) => { setSalesStartDate(event.target.value); setSalesPage(0); }} InputLabelProps={{ shrink: true }} fullWidth size="small" />
      </Grid>
      <Grid item xs={6} md={2}>
        <TextField label="Data final" type="date" value={salesEndDate} onChange={(event) => { setSalesEndDate(event.target.value); setSalesPage(0); }} InputLabelProps={{ shrink: true }} fullWidth size="small" />
      </Grid>
      <Grid item xs={6} md={2}>
        <TextField select label="Por página" value={String(salesRowsPerPage)} onChange={(event) => { setSalesRowsPerPage(Number(event.target.value)); setSalesPage(0); }} fullWidth size="small">
          <MenuItem value="10">10</MenuItem>
          <MenuItem value="20">20</MenuItem>
          <MenuItem value="50">50</MenuItem>
        </TextField>
      </Grid>
    </Grid>
  );

  const salesDayTabs = isMultiDayFair && salesDayKeys.length > 0 ? (
    <Paper sx={{ borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)', px: 1 }}>
      <Tabs value={salesDayTab} onChange={(_event, value) => { setSalesDayTab(value); setSalesPage(0); }} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
        {salesDayKeys.map((key) => {
          const group = salesGroupedByDay.get(key);
          return <Tab key={key} value={key} label={`${group?.label ?? key} (${group?.sales.length ?? 0})`} />;
        })}
      </Tabs>
    </Paper>
  ) : null;

  const saleActions = (sale: Sale) => (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
      <IconButton size="small" onClick={() => navigate(`/vendas/${sale.id}`, { state: { preserveState: true } })} aria-label="Abrir venda" sx={{ border: '1px solid rgba(217, 107, 135, 0.45)', borderRadius: 1.5 }}>
        <OpenInNewRoundedIcon fontSize="small" />
      </IconButton>
      {sale.canDelete ? (
        <IconButton size="small" color="error" onClick={() => setSaleToDelete(sale.id)} disabled={deleteSaleMutation.isLoading} aria-label="Excluir venda">
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Stack>
  );

  const salesList = (
    <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
      <Table size="small" sx={{ minWidth: 980 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              <TableSortLabel active={salesSortField === 'soldAtUtc'} direction={salesSortField === 'soldAtUtc' ? salesSortDirection : 'desc'} onClick={() => handleSalesSort('soldAtUtc')}>Data</TableSortLabel>
            </TableCell>
            <TableCell>Produtos vendidos</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              <TableSortLabel active={salesSortField === 'totalAmount'} direction={salesSortField === 'totalAmount' ? salesSortDirection : 'asc'} onClick={() => handleSalesSort('totalAmount')}>Receita bruta</TableSortLabel>
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              <TableSortLabel active={salesSortField === 'profitAmount'} direction={salesSortField === 'profitAmount' ? salesSortDirection : 'asc'} onClick={() => handleSalesSort('profitAmount')}>Lucro lojinha</TableSortLabel>
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>Caixinha</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>Pagamento</TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 2 }}>Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pagedSales.map((sale) => {
            const totalItems = sale.items.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <TableRow key={sale.id} hover>
                <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>{formatUtcDate(sale.soldAtUtc)}</TableCell>
                <TableCell sx={{ py: 1.5, minWidth: 320 }}>
                  <Typography fontWeight={700} sx={{ lineHeight: 1.3 }}>{sale.items.map((item) => item.productName).join(', ')}</Typography>
                  <Typography variant="body2" color="text.secondary">{totalItems} item(ns) • {sale.items.length} produto(s)</Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5 }}>{formatCurrency(sale.totalAmount)}</TableCell>
                <TableCell sx={{ py: 1.5 }}>{formatCurrency(sale.profitAmount)}</TableCell>
                <TableCell sx={{ py: 1.5 }}>{formatCurrency(Math.max(sale.profitAmount, 0) / 2)}</TableCell>
                <TableCell sx={{ py: 1.5 }}>{paymentMethodLabel(sale.paymentMethod)}</TableCell>
                <TableCell align="right" sx={{ py: 1.5, pr: 1.5 }}>{saleActions(sale)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );

  const quotaList = isMobile ? (
    <Stack spacing={1.5}>
      {report?.supplierQuotaStatus.map((quota) => (
        <Paper key={quota.supplierId} sx={{ p: 2, borderRadius: 3, backgroundColor: quota.outstandingAmount > 0 ? 'rgba(217,107,135,0.10)' : 'rgba(123,207,192,0.10)' }}>
          <Stack spacing={0.75}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography fontWeight={700}>{quota.supplierName}</Typography>
              <Chip size="small" label={quota.isSettled ? 'Quitado' : 'Em aberto'} color={quota.isSettled ? 'success' : 'warning'} />
            </Stack>
            <Typography variant="body2" color="text.secondary">Cota devida {formatCurrency(quota.quotaAmount)} • Pago {formatCurrency(quota.paidAmount)}</Typography>
            <Typography fontWeight={700} color={quota.outstandingAmount > 0 ? 'error.main' : undefined}>Em aberto {formatCurrency(quota.outstandingAmount)}</Typography>
          </Stack>
        </Paper>
      ))}
    </Stack>
  ) : (
    <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
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
          {report?.supplierQuotaStatus.map((quota) => (
            <TableRow key={quota.supplierId} sx={{ backgroundColor: quota.outstandingAmount > 0 ? 'rgba(217, 107, 135, 0.10)' : 'rgba(123, 207, 192, 0.10)' }}>
              <TableCell>{quota.supplierName}</TableCell>
              <TableCell>{formatCurrency(quota.quotaAmount)}</TableCell>
              <TableCell>{formatCurrency(quota.paidAmount)}</TableCell>
              <TableCell sx={{ color: quota.outstandingAmount > 0 ? 'error.main' : undefined, fontWeight: quota.outstandingAmount > 0 ? 700 : 400 }}>{formatCurrency(quota.outstandingAmount)}</TableCell>
              <TableCell><Chip size="small" label={quota.isSettled ? 'Quitado' : 'Em aberto'} color={quota.isSettled ? 'success' : 'warning'} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );

  const performanceCards = (isSupplier ? suppliersWithSales.filter((supplier) => supplier.supplierId === session?.supplierId) : suppliersWithSales);

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }} spacing={1.5}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
            <Typography variant="h4" sx={{ lineHeight: 1.15 }}>{fair.name}</Typography>
            <Chip size="small" label={fairStatusLabel(fair.status)} color={statusColor} sx={{ fontWeight: 700 }} />
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {formatUtcDateRange(fair.eventDateUtc, fair.endDateUtc)} • {fair.location} • {fair.suppliers.length} fornecedor(es)
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setIsSaleModalOpen(true)} disabled={!canRegisterSale} sx={{ flex: { xs: 1, md: 'initial' } }}>
            Registrar venda
          </Button>
          <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)} sx={{ border: '1px solid rgba(217,107,135,0.35)', borderRadius: 2 }} aria-label="Mais ações">
            <MoreVertRoundedIcon />
          </IconButton>
        </Stack>
      </Stack>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        {canStartFair ? (
          <MenuItem onClick={() => runFromMenu(() => startMutation.mutate())} disabled={startMutation.isLoading}>
            <ListItemIcon><TaskAltRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Iniciar feira</ListItemText>
          </MenuItem>
        ) : null}
        {!isSupplier && fair.status === 'Open' ? (
          <MenuItem onClick={() => runFromMenu(() => setIsFinalizeChecklistOpen(true))} disabled={finalizeMutation.isLoading}>
            <ListItemIcon><TaskAltRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Finalizar feira</ListItemText>
          </MenuItem>
        ) : null}
        {!isSupplier && fair.status !== 'Open' && fair.status !== 'Cancelled' ? (
          <MenuItem onClick={() => runFromMenu(() => reopenMutation.mutate())} disabled={reopenMutation.isLoading}>
            <ListItemIcon><ReplayRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Reabrir feira</ListItemText>
          </MenuItem>
        ) : null}
        {!isSupplier ? (
          <MenuItem onClick={() => runFromMenu(() => navigate(`/feiras/${fair.id}/editar`, { state: { preserveState: true } }))}>
            <ListItemIcon><EditRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Editar cadastro</ListItemText>
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => runFromMenu(handleExport)}>
          <ListItemIcon><DownloadRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Exportar CSV</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => runFromMenu(() => navigate('/feiras', { state: { preserveState: true } }))}>
          <ListItemIcon><ArrowBackRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Voltar para feiras</ListItemText>
        </MenuItem>
        {canCancelFair ? (
          <MenuItem onClick={() => runFromMenu(() => setIsCancelDialogOpen(true))} sx={{ color: 'warning.main' }}>
            <ListItemIcon><BlockRoundedIcon fontSize="small" color="warning" /></ListItemIcon>
            <ListItemText>Cancelar feira</ListItemText>
          </MenuItem>
        ) : null}
        {!isSupplier ? (
          <MenuItem onClick={() => runFromMenu(() => setIsDeleteDialogOpen(true))} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Excluir feira</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>

      {feedback ? <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.message}</Alert> : null}

      <Paper sx={{ p: { xs: 1.75, md: 2.5 }, background: 'linear-gradient(135deg, rgba(245,178,197,0.20), rgba(123,207,192,0.14))' }}>
        <Box sx={{ display: 'grid', gap: { xs: 1.25, md: 2 }, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' } }}>
          {bandCells.map((cell) => (
            <Box key={cell.label} sx={cell.emphasis ? { border: '1.5px solid', borderColor: 'primary.main', borderRadius: 2, bgcolor: 'background.paper', p: 1.25 } : { p: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block' }}>{cell.label}</Typography>
              <Typography variant="h6" sx={{ mt: 0.25 }} color={cell.negative ? 'error.main' : (cell.emphasis ? 'primary.dark' : undefined)}>{cell.value}</Typography>
            </Box>
          ))}
        </Box>
        {!isSupplier ? (
          <Stack direction="row" spacing={{ xs: 2, md: 3 }} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary"><b>{itemsSold}</b> itens vendidos</Typography>
            <Typography variant="body2" color="text.secondary"><b>{salesCount}</b> vendas</Typography>
            <Typography variant="body2" color="text.secondary">Ticket médio <b>{formatCurrency(averageTicket)}</b></Typography>
          </Stack>
        ) : null}
      </Paper>

      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ borderBottom: '1px solid rgba(217,107,135,0.18)' }}
      >
        {tabDefs.map((definition) => (
          <Tab
            key={definition.key}
            value={definition.key}
            label={definition.count !== undefined ? `${definition.label} (${definition.count})` : definition.label}
          />
        ))}
      </Tabs>

      {!report ? <Typography color="text.secondary">Carregando relatório da feira...</Typography> : null}

      {report && tab === 'vendas' ? (
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
              <div>
                <Typography variant="h6">Vendas da feira</Typography>
                <Typography color="text.secondary" fontSize={13}>{salesCount} vendas • {itemsSold} itens. Filtre por dia, pagamento ou produto.</Typography>
              </div>
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setIsSaleModalOpen(true)} disabled={!canRegisterSale} sx={{ width: { xs: '100%', sm: 'auto' } }}>Nova venda</Button>
            </Stack>
            {salesFilters}
            {salesDayTabs}
            {salesList}
            {activeSales.length === 0 ? <Alert severity="info">Nenhuma venda encontrada com os filtros selecionados.</Alert> : null}
            <TablePagination
              component="div"
              count={activeSales.length}
              page={salesPage}
              onPageChange={(_event, page) => setSalesPage(page)}
              rowsPerPage={salesRowsPerPage}
              onRowsPerPageChange={(event) => { setSalesRowsPerPage(Number(event.target.value)); setSalesPage(0); }}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage="Por página"
            />
          </Stack>
        </Paper>
      ) : null}

      {report && tab === 'despesas' && !isSupplier ? (
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
              <div>
                <Typography variant="h6">Despesas da feira</Typography>
                <Typography color="text.secondary" fontSize={13}>Combustível, alimentação, hospedagem e outros custos do evento. Entram no resultado da feira e no Financeiro geral.</Typography>
              </div>
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setIsExpenseModalOpen(true)} sx={{ width: { xs: '100%', sm: 'auto' } }}>Nova despesa</Button>
            </Stack>

            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' } }}>
              {expensesByKind.map((kind) => (
                <Paper key={kind.key} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ width: 9, height: 9, borderRadius: '3px', bgcolor: kind.color, flex: 'none' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>{kind.label}</Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ mt: 0.5 }}>{formatCurrency(kind.total)}</Typography>
                </Paper>
              ))}
            </Box>

            {(report.expenses ?? []).length === 0 ? (
              <Alert severity="info">Nenhuma despesa lançada para esta feira.</Alert>
            ) : isMobile ? (
              <Stack spacing={1.5}>
                {(report.expenses ?? []).map((expense) => (
                  <Paper key={expense.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Stack spacing={0.5}>
                        <Chip size="small" label={expenseKind(expense.kind).label} sx={{ alignSelf: 'flex-start', bgcolor: `${expenseKind(expense.kind).color}22`, fontWeight: 700 }} />
                        <Typography fontWeight={700}>{expense.description}</Typography>
                        <Typography variant="body2" color="text.secondary">{formatUtcDate(expense.occurredOnUtc)}</Typography>
                      </Stack>
                      <Stack alignItems="flex-end" spacing={0.5}>
                        <Typography fontWeight={700}>{formatCurrency(expense.amount)}</Typography>
                        <IconButton size="small" color="error" onClick={() => setExpenseToDelete(expense.id)} disabled={deleteExpenseMutation.isLoading} aria-label="Remover despesa">
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
                <Paper sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(217,107,135,0.08)' }}>
                  <Stack direction="row" justifyContent="space-between"><Typography fontWeight={800}>Total das despesas</Typography><Typography fontWeight={800}>{formatCurrency(report.totalExpenses)}</Typography></Stack>
                </Paper>
              </Stack>
            ) : (
              <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Data</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Descrição</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Valor</TableCell>
                      <TableCell align="right" sx={{ pr: 2 }}>Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(report.expenses ?? []).map((expense) => (
                      <TableRow key={expense.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatUtcDate(expense.occurredOnUtc)}</TableCell>
                        <TableCell><Chip size="small" label={expenseKind(expense.kind).label} sx={{ bgcolor: `${expenseKind(expense.kind).color}22`, fontWeight: 700 }} /></TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{formatCurrency(expense.amount)}</TableCell>
                        <TableCell align="right" sx={{ pr: 1 }}>
                          <IconButton size="small" color="error" onClick={() => setExpenseToDelete(expense.id)} disabled={deleteExpenseMutation.isLoading} aria-label="Remover despesa">
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} sx={{ fontWeight: 800, borderTop: '2px solid rgba(217,107,135,0.22)' }}>Total das despesas</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: 'nowrap', borderTop: '2px solid rgba(217,107,135,0.22)' }}>{formatCurrency(report.totalExpenses)}</TableCell>
                      <TableCell sx={{ borderTop: '2px solid rgba(217,107,135,0.22)' }} />
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Stack>
        </Paper>
      ) : null}

      {report && tab === 'fornecedores' ? (
        <Stack spacing={2.5}>
          {!isSupplier ? (
            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" mb={0.5}>Rateio da cota da feira</Typography>
              <Typography color="text.secondary" fontSize={13} mb={2}>
                Taxa total {formatCurrency(report.registrationFee)} • {report.storeFeePercentage.toFixed(0)}% loja / {(100 - report.storeFeePercentage).toFixed(0)}% fornecedores • dividida entre {supplierCount} fornecedor(es).
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Taxa total</Typography><Typography variant="h6">{formatCurrency(report.registrationFee)}</Typography></Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Parcela da loja</Typography><Typography variant="h6">{formatCurrency(report.storeRegistrationFee)}</Typography></Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Parcela fornecedores</Typography><Typography variant="h6">{formatCurrency(supplierPool)}</Typography></Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Cota média / fornecedor</Typography><Typography variant="h6">{formatCurrency(averageQuotaPerSupplier)}</Typography></Paper>
              </Box>
            </Paper>
          ) : null}

          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" mb={0.5}>{isSupplier ? 'Sua cota da feira' : 'Acompanhamento de cotas'}</Typography>
            <Typography color="text.secondary" fontSize={13} mb={2}>Quanto cada fornecedor deve e já pagou da cota da feira.</Typography>
            {isSupplier ? (
              (() => {
                const quota = report.supplierQuotaStatus.find((item) => item.supplierId === session?.supplierId);
                if (!quota) {
                  return <Alert severity="info">Sua cota ainda não foi lançada para esta feira.</Alert>;
                }
                return (
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
                    <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Cota devida</Typography><Typography variant="h6">{formatCurrency(quota.quotaAmount)}</Typography></Paper>
                    <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Pago</Typography><Typography variant="h6">{formatCurrency(quota.paidAmount)}</Typography></Paper>
                    <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Em aberto</Typography><Typography variant="h6" color={quota.outstandingAmount > 0 ? 'error.main' : undefined}>{formatCurrency(quota.outstandingAmount)}</Typography></Paper>
                    <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Status</Typography><Typography variant="h6">{quota.isSettled ? 'Quitado' : 'Em aberto'}</Typography></Paper>
                  </Box>
                );
              })()
            ) : quotaList}
          </Paper>

          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" mb={0.5}>Desempenho por fornecedor</Typography>
            <Typography color="text.secondary" fontSize={13} mb={2}>Vendas consignadas de cada fornecedor nesta feira.</Typography>
            {!isSupplier ? (
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, mb: 2 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Venda bruta</Typography><Typography variant="h6">{formatCurrency(supplierGrossRevenue)}</Typography></Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Custo das peças</Typography><Typography variant="h6">{formatCurrency(supplierCostAmount)}</Typography></Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Ganho da lojinha</Typography><Typography variant="h6">{formatCurrency(supplierLojinhaGain)}</Typography></Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>Repasse estimado</Typography><Typography variant="h6">{formatCurrency(supplierTransferAmount)}</Typography></Paper>
              </Box>
            ) : null}
            {performanceCards.length === 0 ? (
              <Alert severity="info">Nenhum fornecedor com vendas nesta feira.</Alert>
            ) : (
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' } }}>
                {performanceCards.map((supplier) => (
                  <Paper key={supplier.supplierId || supplier.supplierName} variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" mb={1.5}>{supplier.supplierName}</Typography>
                    <Grid container spacing={1.25}>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary" fontWeight={700}>Itens vendidos</Typography><Typography fontWeight={700}>{supplier.quantity}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary" fontWeight={700}>Venda bruta</Typography><Typography fontWeight={700}>{formatCurrency(supplier.total)}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary" fontWeight={700}>Custo das peças</Typography><Typography fontWeight={700}>{formatCurrency(supplier.cost)}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary" fontWeight={700}>Ganho da lojinha</Typography><Typography fontWeight={700}>{formatCurrency(supplier.gain)}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary" fontWeight={700}>Repasse estimado</Typography><Typography fontWeight={700}>{formatCurrency(supplier.transferAmount)}</Typography></Grid>
                    </Grid>
                  </Paper>
                ))}
              </Box>
            )}
          </Paper>
        </Stack>
      ) : null}

      {report && tab === 'analise' ? (
        <Stack spacing={2.5}>
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" mb={0.5}>Evolução por dia</Typography>
            <Typography color="text.secondary" fontSize={13} mb={2}>Receita bruta e lucro da lojinha em cada dia da feira.</Typography>
            <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
              <BarChart data={report.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="label" />
                <YAxis width={isMobile ? 40 : 60} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="grossRevenue" name="Receita bruta" fill="#d96b87" radius={[10, 10, 0, 0]} />
                <Bar dataKey="netRevenue" name="Lucro da lojinha" fill="#7bcfc0" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: { xs: 2, md: 3 }, height: '100%' }}>
                <Typography variant="h6" mb={0.5}>Mais vendidos</Typography>
                <Typography color="text.secondary" fontSize={13} mb={2}>Top produtos por quantidade na feira.</Typography>
                {report.topProducts.length === 0 ? <Alert severity="info">Sem vendas registradas.</Alert> : (
                  <Stack spacing={1.5}>
                    {report.topProducts.map((item) => {
                      const max = report.topProducts[0]?.quantitySold || 1;
                      return (
                        <Stack key={item.productName} spacing={0.5}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography fontSize={13}>{item.productName}</Typography>
                            <Typography fontSize={13} fontWeight={700}>{item.quantitySold} un • {formatCurrency(item.revenue)}</Typography>
                          </Stack>
                          <Box sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(217,107,135,0.12)' }}>
                            <Box sx={{ height: '100%', borderRadius: 999, bgcolor: 'primary.main', width: `${Math.round((item.quantitySold / max) * 100)}%` }} />
                          </Box>
                        </Stack>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: { xs: 2, md: 3 }, height: '100%' }}>
                <Typography variant="h6" mb={0.5}>Formas de pagamento</Typography>
                <Typography color="text.secondary" fontSize={13} mb={2}>Distribuição das {salesCount} vendas da feira.</Typography>
                {paymentBreakdown.length === 0 ? <Alert severity="info">Sem vendas registradas.</Alert> : (
                  <Stack spacing={1.25}>
                    {paymentBreakdown.map((row) => (
                      <Paper key={row.method} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography fontWeight={700}>{paymentMethodLabel(row.method)}</Typography>
                          <Typography fontWeight={700}>{formatCurrency(row.total)}</Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{row.count} venda(s) • {salesCount > 0 ? Math.round((row.count / salesCount) * 100) : 0}%</Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      ) : null}

      <ConfirmDialog
        open={saleToDelete !== null}
        title="Excluir venda"
        description="Deseja excluir esta venda? O estoque e o financeiro serão recalculados."
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteSaleMutation.isLoading}
        onCancel={() => setSaleToDelete(null)}
        onConfirm={() => { if (saleToDelete) { deleteSaleMutation.mutate(saleToDelete); setSaleToDelete(null); } }}
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

      <ConfirmDialog
        open={expenseToDelete !== null}
        title="Remover despesa"
        description="Deseja remover esta despesa da feira? O resultado e o financeiro serão recalculados."
        confirmLabel="Remover"
        confirmColor="error"
        isLoading={deleteExpenseMutation.isLoading}
        onCancel={() => setExpenseToDelete(null)}
        onConfirm={() => { if (expenseToDelete) { deleteExpenseMutation.mutate(expenseToDelete); } }}
      />

      <Dialog open={isFinalizeChecklistOpen} onClose={() => setIsFinalizeChecklistOpen(false)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>Antes de finalizar a feira</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Revise os pontos abaixo. Nenhum é obrigatório, mas depois de finalizar a feira não aceita mais vendas.
          </Typography>
          <Stack spacing={1.25}>
            {(() => {
              const totalSales = fair.totalSales ?? 0;
              const totalExpenses = report?.totalExpenses ?? 0;
              const quotas = report?.supplierQuotaStatus ?? [];
              const settledQuotas = quotas.filter((quota) => quota.isSettled).length;
              const outstandingQuotas = quotas.length - settledQuotas;
              const rows = [
                {
                  ok: totalSales > 0,
                  label: 'Vendas lançadas',
                  detail: totalSales > 0 ? `${totalSales} venda(s) registrada(s)` : 'Nenhuma venda lançada — confirme se a feira teve movimento'
                },
                {
                  ok: true,
                  neutral: totalExpenses === 0,
                  label: 'Despesas da feira',
                  detail: totalExpenses > 0 ? `${formatCurrency(totalExpenses)} em despesas lançadas` : 'Nenhuma despesa lançada — lance alimentação, combustível, etc. se houver'
                },
                {
                  ok: quotas.length === 0 || outstandingQuotas === 0,
                  label: 'Cotas dos fornecedores',
                  detail: quotas.length === 0
                    ? 'Sem fornecedores participantes'
                    : outstandingQuotas === 0
                      ? `Todas as ${quotas.length} cotas quitadas`
                      : `${outstandingQuotas} de ${quotas.length} cota(s) em aberto — registre os pagamentos na aba Fornecedores`
                },
                {
                  ok: true,
                  neutral: true,
                  label: 'Resultado e caixinha',
                  detail: `Resultado ${formatCurrency(report?.result ?? 0)} · Caixinha ${formatCurrency(report?.piggyBankAmount ?? 0)}`
                }
              ];

              return rows.map((row) => (
                <Paper key={row.label} variant="outlined" sx={{ p: 1.5, borderColor: row.ok ? 'rgba(217,107,135,0.16)' : 'rgba(225,166,87,0.5)' }}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Chip
                      size="small"
                      label={row.neutral ? 'Revisar' : row.ok ? 'OK' : 'Atenção'}
                      color={row.neutral ? 'default' : row.ok ? 'success' : 'warning'}
                      sx={{ fontWeight: 700, mt: 0.25 }}
                    />
                    <Box>
                      <Typography fontWeight={700} fontSize={14}>{row.label}</Typography>
                      <Typography color="text.secondary" fontSize={12.5}>{row.detail}</Typography>
                    </Box>
                  </Stack>
                </Paper>
              ));
            })()}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setIsFinalizeChecklistOpen(false)}>Voltar</Button>
          <Button
            variant="contained"
            onClick={() => { setIsFinalizeChecklistOpen(false); finalizeMutation.mutate(); }}
            disabled={finalizeMutation.isLoading}
          >
            Finalizar feira
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>Nova despesa da feira</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="Tipo" value={expenseForm.kind} onChange={(event) => setExpenseForm({ ...expenseForm, kind: event.target.value })} fullWidth>
              {EXPENSE_KINDS.map((kind) => <MenuItem key={kind.key} value={kind.key}>{kind.label}</MenuItem>)}
            </TextField>
            <TextField
              label="Descrição"
              value={expenseForm.description}
              onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })}
              placeholder="Ex.: gasolina ida e volta, almoço da equipe, diária do hotel"
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <CurrencyField label="Valor" value={expenseForm.amount === '' ? 0 : Number(expenseForm.amount)} onValueChange={(value) => setExpenseForm({ ...expenseForm, amount: String(value) })} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Data" type="date" value={expenseForm.occurredOnUtc} onChange={(event) => setExpenseForm({ ...expenseForm, occurredOnUtc: event.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setIsExpenseModalOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => addExpenseMutation.mutate()}
            disabled={addExpenseMutation.isLoading || expenseForm.description.trim() === '' || expenseForm.amount === '' || Number(expenseForm.amount) <= 0}
          >
            Lançar despesa
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isSaleModalOpen} onClose={() => setIsSaleModalOpen(false)} fullWidth maxWidth="md" fullScreen={isMobile}>
        <DialogTitle>Registrar venda na feira</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">Lançamento válido apenas enquanto a feira estiver em aberto.</Typography>
            {!canRegisterSale ? <Alert severity="warning">Esta feira ainda nao esta em aberto para registrar vendas.</Alert> : null}
            <TextField select label="Forma de pagamento" value={saleForm.paymentMethod} onChange={(event) => setSaleForm({ ...saleForm, paymentMethod: event.target.value })}>
              {PAYMENT_METHODS.map((method) => <MenuItem key={method} value={method}>{paymentMethodLabel(method)}</MenuItem>)}
            </TextField>
            <TextField label="Data da venda" type="date" value={saleForm.soldAtUtc} onChange={(event) => setSaleForm({ ...saleForm, soldAtUtc: event.target.value })} InputLabelProps={{ shrink: true }} />
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
                        items[index] = { ...item, supplierId, lojinhaGainPercentage: supplierId === '' ? '' : item.lojinhaGainPercentage };
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
        <DialogActions sx={{ px: 3, pb: 3, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => setIsSaleModalOpen(false)}>Cancelar</Button>
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
