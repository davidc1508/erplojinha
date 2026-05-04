import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { useMemo, useState } from 'react';
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
  const [saleForm, setSaleForm] = useState({ paymentMethod: 'Pix', soldAtUtc: getTodayDateInputValue(), notes: '', items: [{ productId: '', supplierId: '', quantity: 1, unitPrice: '', lojinhaGainPercentage: '' }] });
  const [breakEvenTicket, setBreakEvenTicket] = useState<number>(0);
  const [breakEvenMargin, setBreakEvenMargin] = useState<number>(45);

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
        items: saleForm.items.map((item) => ({
          productId: item.productId,
          supplierId: item.supplierId === '' ? null : item.supplierId,
          quantity: Number(item.quantity),
          unitPrice: item.unitPrice === '' ? null : Number(item.unitPrice),
          lojinhaGainPercentage: item.lojinhaGainPercentage === '' ? null : Number(item.lojinhaGainPercentage)
        }))
      });
      return { keepOpen };
    },
    onSuccess: async ({ keepOpen }) => {
      setFeedback({ severity: 'success', message: 'Venda lançada na feira.' });
      setSaleForm({ paymentMethod: 'Pix', soldAtUtc: getTodayDateInputValue(), notes: '', items: [{ productId: '', supplierId: '', quantity: 1, unitPrice: '', lojinhaGainPercentage: '' }] });
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
    ? ((fair?.registrationFee ?? 0) / 2) / (fair?.suppliers.length ?? 1)
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

  const canStartFair = !isSupplier && fair.status === 'Awaiting' && isUtcDateTodayOrPast(fair.eventDateUtc);
  const canRegisterSale = fair.status === 'Open';
  const canCancelFair = !isSupplier && fair.totalSales === 0 && (fair.status === 'Awaiting' || fair.status === 'Open');
  const supplierPool = (report?.registrationFee ?? 0) / 2;
  const supplierCount = report?.suppliers.length ?? 0;
  const averageQuotaPerSupplier = supplierCount > 0 ? supplierPool / supplierCount : 0;
  const requiredGrossForBreakEven = breakEvenMargin > 0 ? (report?.storeRegistrationFee ?? 0) / (breakEvenMargin / 100) : 0;
  const missingGrossForBreakEven = Math.max(0, requiredGrossForBreakEven - (report?.grossRevenue ?? 0));
  const salesNeededForBreakEven = breakEvenTicket > 0 ? Math.ceil(missingGrossForBreakEven / breakEvenTicket) : 0;

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
                  <Grid item xs={12} md={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Taxa da loja</Typography><Typography variant="h5">{formatCurrency(report.storeRegistrationFee)}</Typography></Paper></Grid>
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
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.62)' }}>
                  <Typography variant="h6" mb={1}>Rateio transparente da cota</Typography>
                  <Typography color="text.secondary">Taxa total: {formatCurrency(report.registrationFee)}</Typography>
                  <Typography color="text.secondary">Parcela da lojinha (50%): {formatCurrency(report.storeRegistrationFee)}</Typography>
                  <Typography color="text.secondary">Parcela dos fornecedores (50%): {formatCurrency(supplierPool)}</Typography>
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

              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.62)' }}>
                  <Typography variant="h6" mb={1}>Simulador de break-even</Typography>
                  <Typography color="text.secondary" mb={2}>Estimativa para cobrir a parcela da loja na taxa da feira.</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <CurrencyField label="Ticket médio esperado" value={breakEvenTicket} onValueChange={setBreakEvenTicket} fullWidth />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Margem líquida esperada (%)"
                        type="number"
                        value={breakEvenMargin}
                        onChange={(event) => setBreakEvenMargin(Number(event.target.value))}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12}><Typography color="text.secondary">Receita bruta para empatar: {formatCurrency(requiredGrossForBreakEven)}</Typography></Grid>
                    <Grid item xs={12}><Typography color="text.secondary">Receita adicional necessária: {formatCurrency(missingGrossForBreakEven)}</Typography></Grid>
                    <Grid item xs={12}><Typography color="text.secondary">Vendas adicionais estimadas: {salesNeededForBreakEven} venda(s)</Typography></Grid>
                  </Grid>
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
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Mais vendidos na feira</Typography>
                  {report.topProducts.map((item) => (
                    <Paper key={item.productName} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.62)' }}>
                      <Typography fontWeight={700}>{item.productName}</Typography>
                      <Typography color="text.secondary">{item.quantitySold} itens</Typography>
                      <Typography>{formatCurrency(item.revenue)}</Typography>
                    </Paper>
                  ))}
                </Stack>
              </Grid>
              <Grid item xs={12} md={7}>
                <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                  <Table size="small" sx={{ minWidth: 760 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>Data</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>Pagamento</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>Itens</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>Total</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 3 }}>Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.sales.map((sale) => (
                        <TableRow key={sale.id} hover>
                          <TableCell sx={{ py: 1.5 }}>{formatUtcDate(sale.soldAtUtc)}</TableCell>
                          <TableCell sx={{ py: 1.5 }}>{paymentMethodLabel(sale.paymentMethod)}</TableCell>
                          <TableCell sx={{ py: 1.5, whiteSpace: 'normal', wordBreak: 'break-word' }}>{sale.items.map((item) => `${item.productName} x${item.quantity}`).join(', ')}</TableCell>
                          <TableCell sx={{ py: 1.5 }}>{formatCurrency(sale.totalAmount)}</TableCell>
                          <TableCell align="right" sx={{ py: 1.5, pr: 2, whiteSpace: 'nowrap' }}>
                            {sale.canDelete ? <Button size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setSaleToDelete(sale.id)} disabled={deleteSaleMutation.isLoading}>
                              Excluir
                            </Button> : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Grid>
            </Grid>
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
                      unitPrice: selectedProduct ? String(selectedProduct.salePrice) : '',
                      lojinhaGainPercentage: defaultSupplierId !== '' ? item.lojinhaGainPercentage : ''
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
              {fair.suppliers.length > 0 ? (
                <Grid item xs={12}>
                  <TextField
                    select
                    label="Venda de fornecedor"
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
          <Button variant="outlined" onClick={() => setSaleForm({ ...saleForm, items: [...saleForm.items, { productId: '', supplierId: '', quantity: 1, unitPrice: '', lojinhaGainPercentage: '' }] })} sx={{ alignSelf: 'flex-start' }} disabled={!canRegisterSale}>
            Adicionar item
          </Button>
          <TextField label="Observações" multiline minRows={3} value={saleForm.notes} onChange={(event) => setSaleForm({ ...saleForm, notes: event.target.value })} disabled={!canRegisterSale} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={handleCloseSaleModal}>Cancelar</Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => saleMutation.mutate({ keepOpen: true })}
            disabled={!canRegisterSale || saleMutation.isLoading || saleForm.items.some((item) => !item.productId)}
          >
            Salvar e lançar outra
          </Button>
          <Button
            variant="contained"
            onClick={() => saleMutation.mutate({ keepOpen: false })}
            disabled={!canRegisterSale || saleMutation.isLoading || saleForm.items.some((item) => !item.productId)}
          >
            Registrar venda na feira
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}