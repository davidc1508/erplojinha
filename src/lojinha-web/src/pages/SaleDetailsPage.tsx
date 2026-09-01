import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Tab, Typography, useMediaQuery, useTheme } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { salesApi } from '../services/api';
import { formatUtcDate } from '../services/date';
import { formatCurrency, paymentMethodLabel } from '../services/labels';

function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

function FinancialBandCell({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75,
        borderColor: emphasize ? 'rgba(121,169,95,0.4)' : 'rgba(217,107,135,0.14)',
        backgroundColor: emphasize ? 'rgba(184,226,150,0.22)' : 'rgba(255,255,255,0.6)'
      }}
    >
      <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'block', fontSize: 10 }}>{label}</Typography>
      <Typography sx={{ fontFamily: '"Baloo 2", "Nunito", sans-serif', fontWeight: 700, fontSize: emphasize ? '1.15rem' : '1.02rem', color: emphasize ? '#4e7a34' : 'inherit' }}>{value}</Typography>
    </Paper>
  );
}

export function SaleDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const isReseller = session?.role === 'Reseller';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [tab, setTab] = useState(0);

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
          <Typography variant="h3">Detalhes da venda</Typography>
          <Typography color="text.secondary">
            {sale ? `${formatUtcDate(sale.soldAtUtc)} · ${paymentMethodLabel(sale.paymentMethod)} · ${sale.items.length} produto(s)` : 'Itens, valores e comissionamento.'}
          </Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/vendas', { state: { preserveState: true } })} sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}>
          Voltar para vendas
        </Button>
      </Stack>

      {isLoading ? <Typography color="text.secondary">Carregando venda...</Typography> : null}
      {isError ? <Alert severity="error">Nao foi possivel carregar os detalhes desta venda.</Alert> : null}
      {!isLoading && !isError && !sale ? <Alert severity="warning">Venda nao encontrada.</Alert> : null}

      {sale && summary ? (
        <>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' } }}>
            <FinancialBandCell label="Bruto" value={formatCurrency(sale.totalAmount)} />
            <FinancialBandCell label="− Taxas" value={formatCurrency(sale.feeAmount)} />
            <FinancialBandCell label="− Custo" value={formatCurrency(sale.costAmount)} />
            <FinancialBandCell label="− Comissão" value={formatCurrency(summary.totalCommissionAmount)} />
            <FinancialBandCell label="= Lucro líquido" value={formatCurrency(sale.profitAmount)} emphasize />
            <FinancialBandCell label="Caixinha sugerida" value={formatCurrency(summary.piggyBankAmount)} />
          </Box>

          <Paper sx={{ p: { xs: 2, md: 3 }, overflow: 'hidden' }}>
            <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 2.5, borderBottom: '1px solid rgba(217,107,135,0.18)' }}>
              <Tab label="Itens da venda" />
              <Tab label="Financeiro detalhado" />
              {sale.notes ? <Tab label="Observações" /> : null}
            </Tabs>

            {tab === 0 && isMobile ? (
              <Stack spacing={1.25}>
                {sale.items.map((item, index) => {
                  const costTotal = item.costPrice * item.quantity;
                  const grossMargin = item.totalPrice - costTotal;
                  const isResellerSettlementItem = !item.isCommissionedSale && item.commissionAmount > 0;
                  const displayedCommissionAmount = isResellerSettlementItem ? Math.max(item.totalPrice - item.commissionAmount, 0) : item.commissionAmount;
                  const displayedLojinhaGainAmount = isResellerSettlementItem ? Math.min(item.commissionAmount, item.totalPrice) : item.lojinhaGainAmount;
                  const supplierTransfer = item.supplierId && !isResellerSettlementItem ? item.totalPrice - costTotal - displayedLojinhaGainAmount : 0;

                  return (
                    <Paper key={`${item.productName}-${index}`} variant="outlined" sx={{ p: 1.75, borderColor: 'rgba(217,107,135,0.16)' }}>
                      <Stack spacing={0.5}>
                        <Typography fontWeight={700}>{item.productName}</Typography>
                        <Typography fontSize={13}>{item.quantity} × {formatCurrency(item.unitPrice)} = <strong>{formatCurrency(item.totalPrice)}</strong></Typography>
                        <Typography color="text.secondary" fontSize={12.5}>Custo {formatCurrency(costTotal)} · Margem bruta <strong>{formatCurrency(grossMargin)}</strong></Typography>
                        <Typography color="text.secondary" fontSize={12.5}>Fornecedor: {item.supplierName ?? 'Lojinha Sem Nome'}{item.isCommissionedSale ? ' · comissionada' : ''}</Typography>
                        {item.isCommissionedSale || displayedCommissionAmount > 0 ? (
                          <Typography color="text.secondary" fontSize={12.5}>Comissão {formatCurrency(displayedCommissionAmount)}{item.commissionSellerSupplierName ? ` (${item.commissionSellerSupplierName})` : ''}</Typography>
                        ) : null}
                        <Typography color="text.secondary" fontSize={12.5}>
                          Ganho lojinha {formatCurrency(displayedLojinhaGainAmount)}{!isReseller && supplierTransfer > 0 ? ` · Repasse ${formatCurrency(supplierTransfer)}` : ''}
                        </Typography>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            ) : tab === 0 ? (
              <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Table size="small" sx={{ minWidth: 1200 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Produto</TableCell>
                      <TableCell align="right">Qtd</TableCell>
                      <TableCell align="right">Custo unit.</TableCell>
                      <TableCell align="right">Custo total</TableCell>
                      <TableCell align="right">Preço unit.</TableCell>
                      <TableCell align="right">Receita</TableCell>
                      <TableCell align="right">Margem bruta</TableCell>
                      <TableCell>Fornecedor</TableCell>
                      <TableCell>Comissionada</TableCell>
                      <TableCell>Vendedor</TableCell>
                      <TableCell align="right">Comissão</TableCell>
                      <TableCell align="right">Ganho da lojinha</TableCell>
                      {!isReseller ? <TableCell align="right">Repasse fornecedor</TableCell> : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sale.items.map((item, index) => {
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
                        <TableRow key={`${item.productName}-${index}`} hover>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(item.costPrice)}</TableCell>
                          <TableCell align="right">{formatCurrency(costTotal)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.totalPrice)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(grossMargin)}</TableCell>
                          <TableCell>{item.supplierName ?? 'Lojinha Sem Nome'}</TableCell>
                          <TableCell>{item.isCommissionedSale ? 'Sim' : 'Não'}</TableCell>
                          <TableCell>{item.commissionSellerSupplierName ?? '-'}</TableCell>
                          <TableCell align="right">{formatCurrency(displayedCommissionAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(displayedLojinhaGainAmount)}</TableCell>
                          {!isReseller ? <TableCell align="right">{formatCurrency(supplierTransfer)}</TableCell> : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            ) : null}

            {tab === 1 ? (
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } }}>
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Receita líquida (após taxas)</Typography><Typography variant="h6">{formatCurrency(sale.netReceivedAmount)}</Typography></Paper>
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Margem bruta</Typography><Typography variant="h6">{formatCurrency(summary.grossMarginAmount)}</Typography><Typography color="text.secondary">{formatPercentage(summary.grossMarginPercentage)}</Typography></Paper>
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Líquido após custo</Typography><Typography variant="h6">{formatCurrency(summary.netAfterCostAmount)}</Typography></Paper>
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Margem líquida lojinha</Typography><Typography variant="h6">{formatPercentage(summary.profitMarginPercentage)}</Typography></Paper>
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Taxa sobre a venda</Typography><Typography variant="h6">{formatPercentage(summary.feePercentage)}</Typography></Paper>
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Ganho da lojinha</Typography><Typography variant="h6">{formatCurrency(summary.totalDisplayedLojinhaGainAmount)}</Typography></Paper>
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Comissão paga</Typography><Typography variant="h6">{formatCurrency(summary.totalCommissionAmount)}</Typography><Typography color="text.secondary">{summary.commissionedLines} item(ns)</Typography></Paper>
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Itens vendidos</Typography><Typography variant="h6">{summary.totalItems}</Typography><Typography color="text.secondary">{summary.distinctProducts} produto(s)</Typography></Paper>
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Custo total recalculado pelos itens</Typography><Typography variant="h6">{formatCurrency(summary.totalCostFromItems)}</Typography></Paper>
                {!isReseller ? (
                  <>
                    <Paper sx={{ p: 2 }}><Typography color="text.secondary">Receita de itens de fornecedor</Typography><Typography variant="h6">{formatCurrency(summary.supplierGrossRevenue)}</Typography></Paper>
                    <Paper sx={{ p: 2 }}><Typography color="text.secondary">Custo dos itens de fornecedor</Typography><Typography variant="h6">{formatCurrency(summary.supplierCostAmount)}</Typography></Paper>
                    <Paper sx={{ p: 2 }}><Typography color="text.secondary">Repasse a fornecedores</Typography><Typography variant="h6">{formatCurrency(summary.supplierTransferAmount)}</Typography></Paper>
                  </>
                ) : null}
                <Paper sx={{ p: 2 }}><Typography color="text.secondary">Status</Typography><Typography variant="h6">{sale.status}</Typography></Paper>
              </Box>
            ) : null}

            {tab === 2 && sale.notes ? (
              <Typography>{sale.notes}</Typography>
            ) : null}
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}
