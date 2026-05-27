import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { useAuth } from '../hooks/useAuth';
import { salesApi } from '../services/api';
import { formatUtcDate } from '../services/date';
import { formatCurrency, paymentMethodLabel } from '../services/labels';

function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function SaleDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const isReseller = session?.role === 'Reseller';

  const { data: sale, isLoading, isError } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => salesApi.getById(id!),
    enabled: Boolean(id)
  });

  const summary = useMemo(() => {
    if (!sale) {
      return null;
    }

    const normalizedItems = sale.items.map((item) => {
      const isResellerSettlementItem = !item.isCommissionedSale && item.commissionAmount > 0;
      const displayedCommissionAmount = isResellerSettlementItem
        ? Math.max(item.totalPrice - item.commissionAmount, 0)
        : item.commissionAmount;
      const displayedLojinhaGainAmount = isResellerSettlementItem
        ? Math.min(item.commissionAmount, item.totalPrice)
        : item.lojinhaGainAmount;

      return {
        ...item,
        isResellerSettlementItem,
        displayedCommissionAmount,
        displayedLojinhaGainAmount
      };
    });

    const totalItems = sale.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalCostFromItems = sale.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    const totalCommissionAmount = normalizedItems.reduce((sum, item) => sum + item.displayedCommissionAmount, 0);
    const supplierItems = sale.items.filter((item) => item.supplierId);
    const supplierGrossRevenue = supplierItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const supplierCostAmount = supplierItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    const supplierTransferAmount = normalizedItems
      .filter((item) => item.supplierId && !item.isResellerSettlementItem)
      .reduce((sum, item) => sum + (item.totalPrice - (item.costPrice * item.quantity) - item.displayedLojinhaGainAmount), 0);
    const grossMarginAmount = sale.totalAmount - sale.costAmount;
    const netAfterCostAmount = sale.netReceivedAmount - sale.costAmount;
    const piggyBankAmount = Math.max(sale.profitAmount, 0) / 2;

    return {
      totalItems,
      distinctProducts: sale.items.length,
      totalCostFromItems,
      totalCommissionAmount,
      commissionedLines: sale.items.filter((item) => item.isCommissionedSale).length,
      supplierGrossRevenue,
      supplierCostAmount,
      supplierTransferAmount,
      grossMarginAmount,
      netAfterCostAmount,
      piggyBankAmount,
      totalDisplayedLojinhaGainAmount: normalizedItems.reduce((sum, item) => sum + item.displayedLojinhaGainAmount, 0),
      feePercentage: sale.totalAmount > 0 ? (sale.feeAmount / sale.totalAmount) * 100 : 0,
      grossMarginPercentage: sale.totalAmount > 0 ? (grossMarginAmount / sale.totalAmount) * 100 : 0,
      profitMarginPercentage: sale.totalAmount > 0 ? (sale.profitAmount / sale.totalAmount) * 100 : 0
    };
  }, [sale]);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h4">Detalhes da venda</Typography>
          <Typography color="text.secondary">Visualize itens, valores e comissionamento.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/vendas', { state: { preserveState: true } })}>
          Voltar para vendas
        </Button>
      </Stack>

      {isLoading ? <Typography color="text.secondary">Carregando venda...</Typography> : null}
      {isError ? <Alert severity="error">Nao foi possivel carregar os detalhes desta venda.</Alert> : null}
      {!isLoading && !isError && !sale ? <Alert severity="warning">Venda nao encontrada.</Alert> : null}

      {sale ? (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Data</Typography><Typography variant="h6">{formatUtcDate(sale.soldAtUtc)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Pagamento</Typography><Typography variant="h6">{paymentMethodLabel(sale.paymentMethod)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Receita bruta</Typography><Typography variant="h6">{formatCurrency(sale.totalAmount)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Lucro liquido</Typography><Typography variant="h6">{formatCurrency(sale.profitAmount)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Receita liquida (apos taxas)</Typography><Typography variant="h6">{formatCurrency(sale.netReceivedAmount)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Taxas da venda</Typography><Typography variant="h6">{formatCurrency(sale.feeAmount)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Custo total</Typography><Typography variant="h6">{formatCurrency(sale.costAmount)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Margem bruta</Typography><Typography variant="h6">{formatCurrency(summary?.grossMarginAmount ?? 0)}</Typography><Typography color="text.secondary">{formatPercentage(summary?.grossMarginPercentage ?? 0)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Liquido apos custo</Typography><Typography variant="h6">{formatCurrency(summary?.netAfterCostAmount ?? 0)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Margem liquida lojinha</Typography><Typography variant="h6">{formatPercentage(summary?.profitMarginPercentage ?? 0)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Caixinha sugerida</Typography><Typography variant="h6">{formatCurrency(summary?.piggyBankAmount ?? 0)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Comissao paga</Typography><Typography variant="h6">{formatCurrency(summary?.totalCommissionAmount ?? 0)}</Typography><Typography color="text.secondary">{summary?.commissionedLines ?? 0} item(ns)</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Ganho da lojinha</Typography><Typography variant="h6">{formatCurrency(summary?.totalDisplayedLojinhaGainAmount ?? 0)}</Typography></Paper></Grid>
            {!isReseller ? <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Repasse fornecedores</Typography><Typography variant="h6">{formatCurrency(summary?.supplierTransferAmount ?? 0)}</Typography></Paper></Grid> : null}
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Itens vendidos</Typography><Typography variant="h6">{summary?.totalItems ?? 0}</Typography><Typography color="text.secondary">{summary?.distinctProducts ?? 0} produto(s)</Typography></Paper></Grid>
          </Grid>

          <PageSection title="Resumo financeiro detalhado" subtitle="Abertura dos valores da venda para conferencia de resultado.">
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Receita de itens de fornecedor</Typography><Typography variant="h6">{formatCurrency(summary?.supplierGrossRevenue ?? 0)}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Custo dos itens de fornecedor</Typography><Typography variant="h6">{formatCurrency(summary?.supplierCostAmount ?? 0)}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Taxa sobre a venda</Typography><Typography variant="h6">{formatPercentage(summary?.feePercentage ?? 0)}</Typography></Paper></Grid>
              <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Custo total recalculado pelos itens</Typography><Typography variant="h6">{formatCurrency(summary?.totalCostFromItems ?? 0)}</Typography></Paper></Grid>
              <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Status</Typography><Typography variant="h6">{sale.status}</Typography></Paper></Grid>
            </Grid>
          </PageSection>

          <PageSection title="Itens da venda" subtitle="Cada item com seus dados de comissão quando aplicável.">
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 1360 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Produto</TableCell>
                    <TableCell>Qtd</TableCell>
                    <TableCell>Custo unit.</TableCell>
                    <TableCell>Custo total</TableCell>
                    <TableCell>Preço unit.</TableCell>
                    <TableCell>Receita item</TableCell>
                    <TableCell>Margem bruta item</TableCell>
                    <TableCell>Fornecedor</TableCell>
                    <TableCell>Comissionada</TableCell>
                    <TableCell>Vendedor</TableCell>
                    <TableCell>Comissão</TableCell>
                    <TableCell>Ganho da lojinha</TableCell>
                    <TableCell>Repasse fornecedor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sale.items.map((item, index) => (
                    <TableRow key={`${item.productName}-${index}`}>
                      {(() => {
                        const costTotal = item.costPrice * item.quantity;
                        const grossMargin = item.totalPrice - costTotal;
                        const isResellerSettlementItem = !item.isCommissionedSale && item.commissionAmount > 0;
                        const displayedCommissionAmount = isResellerSettlementItem
                          ? Math.max(item.totalPrice - item.commissionAmount, 0)
                          : item.commissionAmount;
                        const displayedLojinhaGainAmount = isResellerSettlementItem
                          ? Math.min(item.commissionAmount, item.totalPrice)
                          : item.lojinhaGainAmount;
                        const supplierTransfer = item.supplierId && !isResellerSettlementItem
                          ? item.totalPrice - costTotal - displayedLojinhaGainAmount
                          : 0;

                        return (
                          <>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(item.costPrice)}</TableCell>
                            <TableCell>{formatCurrency(costTotal)}</TableCell>
                            <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell>{formatCurrency(item.totalPrice)}</TableCell>
                            <TableCell>{formatCurrency(grossMargin)}</TableCell>
                            <TableCell>{item.supplierName ?? 'Lojinha Sem Nome'}</TableCell>
                            <TableCell>{item.isCommissionedSale ? 'Sim' : 'Nao'}</TableCell>
                            <TableCell>{item.commissionSellerSupplierName ?? '-'}</TableCell>
                            <TableCell>{formatCurrency(displayedCommissionAmount)}</TableCell>
                            <TableCell>{formatCurrency(displayedLojinhaGainAmount)}</TableCell>
                            <TableCell>{formatCurrency(supplierTransfer)}</TableCell>
                          </>
                        );
                      })()}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </PageSection>

          {sale.notes ? (
            <PageSection title="Observações" subtitle="Notas registradas no momento da venda.">
              <Typography>{sale.notes}</Typography>
            </PageSection>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
