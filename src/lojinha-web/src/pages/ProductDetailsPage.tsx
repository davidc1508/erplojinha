import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inventoryApi, productsApi, salesApi } from '../services/api';
import { formatUtcDate } from '../services/date';
import { formatCurrency, paymentMethodLabel } from '../services/labels';
import { useAuth } from '../hooks/useAuth';

const productTypeLabel: Record<string, string> = {
  Impressao3D: 'Impressão 3D',
  Brinco: 'Brinco',
  Botton: 'Botton'
};

function BandCell({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
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

export function ProductDetailsPage() {
  const { session } = useAuth();
  const isReseller = session?.role === 'Reseller';
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [salesPage, setSalesPage] = useState(0);
  const [movementsPage, setMovementsPage] = useState(0);
  const [priceHistoryPage, setPriceHistoryPage] = useState(0);
  const rowsPerPage = 8;

  const { data: product } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getById(id!),
    enabled: Boolean(id)
  });

  const { data: pricing } = useQuery({
    queryKey: ['product-pricing', id],
    queryFn: () => productsApi.getPricing(id!),
    enabled: Boolean(id)
  });

  const { data: priceHistory = [] } = useQuery({
    queryKey: ['product-price-history', id],
    queryFn: () => productsApi.getPriceHistory(id!),
    enabled: Boolean(id)
  });

  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: salesApi.getAll });
  const { data: movements = [] } = useQuery({ queryKey: ['inventory'], queryFn: inventoryApi.getMovements });

  const productSales = useMemo(() => {
    if (!id) {
      return [];
    }

    return sales.flatMap((sale) =>
      sale.items
        .filter((item) => item.productId === id)
        .map((item) => ({
          saleId: sale.id,
          soldAtUtc: sale.soldAtUtc,
          paymentMethod: sale.paymentMethod,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          costPrice: item.costPrice,
          lojinhaGainAmount: item.lojinhaGainAmount,
          commissionAmount: item.commissionAmount
        }))
    );
  }, [id, sales]);

  const productMovements = useMemo(
    () => movements.filter((movement) => movement.itemType === 'Product' && movement.itemId === id),
    [id, movements]
  );

  const monthlyRevenueSeries = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_item, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        year: date.getFullYear(),
        month: date.getMonth()
      };
    });

    return months.map((month) => ({
      label: month.label,
      revenue: productSales
        .filter((sale) => {
          const soldAt = new Date(sale.soldAtUtc);
          return soldAt.getUTCFullYear() === month.year && soldAt.getUTCMonth() === month.month;
        })
        .reduce((sum, sale) => sum + sale.totalPrice, 0)
    }));
  }, [productSales]);

  const soldQuantity = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const soldRevenue = productSales.reduce((sum, sale) => sum + sale.totalPrice, 0);
  const soldProfit = productSales.reduce((sum, sale) => sum + sale.lojinhaGainAmount, 0);
  const averageTicket = productSales.length > 0 ? soldRevenue / productSales.length : 0;
  const lastSaleDate = productSales.length > 0
    ? productSales.map((sale) => sale.soldAtUtc).sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]
    : null;
  const lastMovementDate = productMovements.length > 0
    ? productMovements.map((movement) => movement.occurredAtUtc).sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]
    : null;

  const pagedSales = productSales.slice(salesPage * rowsPerPage, salesPage * rowsPerPage + rowsPerPage);
  const pagedMovements = productMovements.slice(movementsPage * rowsPerPage, movementsPage * rowsPerPage + rowsPerPage);
  const pagedPriceHistory = priceHistory.slice(priceHistoryPage * rowsPerPage, priceHistoryPage * rowsPerPage + rowsPerPage);

  if (!product) {
    return (
      <Stack spacing={3}>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/produtos', { state: { preserveState: true } })} sx={{ alignSelf: 'flex-start' }}>
          Voltar para produtos
        </Button>
        <Typography color="text.secondary">Carregando produto...</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h3">{product.name}</Typography>
            <Chip label={productTypeLabel[product.productType] ?? product.productType} size="small" sx={{ fontWeight: 700 }} />
          </Stack>
          <Typography color="text.secondary">SKU {product.sku} • {product.category} • {product.supplier ?? 'Lojinha Sem Nome'}</Typography>
        </div>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/produtos', { state: { preserveState: true } })}>
            Voltar para produtos
          </Button>
          {!isReseller ? (
            <Button variant="contained" onClick={() => navigate(`/produtos/${product.id}/editar`, { state: { preserveState: true } })}>
              Editar produto
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {product.currentStock === 0 ? (
        <Alert severity="error">Produto sem estoque. Reposição imediata recomendada.</Alert>
      ) : null}

      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' } }}>
        <BandCell label="Estoque" value={`${product.currentStock}`} />
        <BandCell label="Vendidas" value={`${soldQuantity}`} />
        <BandCell label="Receita" value={formatCurrency(soldRevenue)} />
        <BandCell label="= Lucro acumulado" value={formatCurrency(soldProfit)} emphasize />
        <BandCell label="Ticket médio" value={formatCurrency(averageTicket)} />
        <BandCell label="Última venda" value={lastSaleDate ? formatUtcDate(lastSaleDate) : 'Sem vendas'} />
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2.5, borderBottom: '1px solid rgba(217,107,135,0.18)' }}>
          <Tab label="Visão geral" />
          <Tab label={`Vendas (${productSales.length})`} />
          <Tab label={`Estoque (${productMovements.length})`} />
          <Tab label={`Preço & auditoria (${priceHistory.length})`} />
        </Tabs>

        {tab === 0 ? (
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.6fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>Evolução de vendas</Typography>
              <Typography color="text.secondary" fontSize={13} sx={{ mb: 1 }}>Receita dos últimos 6 meses.</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyRevenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="revenue" stroke="#d96b87" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>Composição de custo</Typography>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Custo de composição</Typography><Typography>{formatCurrency(pricing?.compositionCost ?? 0)}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Material</Typography><Typography>{formatCurrency(pricing?.materialCost ?? 0)}</Typography></Stack>
                {product.productType === 'Brinco' ? (
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Pingente ({product.pingenteSupply ?? '—'})</Typography><Typography>{formatCurrency(product.pingenteCost)}</Typography></Stack>
                ) : null}
                {product.productType === 'Botton' ? (
                  <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Tamanho ({product.bottonSize ?? '—'}) • {product.bottonSizeQuantity}/un</Typography><Typography>estoque {product.bottonSizeStockQuantity}</Typography></Stack>
                ) : null}
                {product.productType === 'Impressao3D' ? (
                  <>
                    <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Energia</Typography><Typography>{formatCurrency(pricing?.energyCost ?? 0)}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Manutenção</Typography><Typography>{formatCurrency(pricing?.maintenanceCost ?? 0)}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Falhas</Typography><Typography>{formatCurrency(pricing?.failureCost ?? 0)}</Typography></Stack>
                  </>
                ) : null}
                <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Acabamento</Typography><Typography>{formatCurrency(pricing?.finishingCost ?? 0)}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Mão de obra</Typography><Typography>{formatCurrency(pricing?.laborCost ?? 0)}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Custos adicionais</Typography><Typography>{formatCurrency(pricing?.additionalCosts ?? 0)}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, borderTop: '1px dashed rgba(217,107,135,0.3)' }}><Typography fontWeight={700}>Custo total</Typography><Typography fontWeight={700}>{formatCurrency(pricing?.totalCost ?? 0)}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Preço final</Typography><Typography fontWeight={700}>{formatCurrency(product.salePrice)}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Margem estimada</Typography><Typography fontWeight={700} sx={{ color: '#4e7a34' }}>{(pricing?.estimatedMargin ?? 0).toFixed(2)}%</Typography></Stack>
                <Typography color="text.secondary" fontSize={12}>Última movimentação de estoque: {lastMovementDate ? formatUtcDate(lastMovementDate) : 'sem movimentação'}</Typography>
              </Stack>
            </Box>
          </Box>
        ) : null}

        {tab === 1 ? (
          <>
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Venda</TableCell>
                    <TableCell>Pagamento</TableCell>
                    <TableCell align="right">Quantidade</TableCell>
                    <TableCell align="right">Preço unitário</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Ganho lojinha</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedSales.map((sale) => (
                    <TableRow key={`${sale.saleId}-${sale.soldAtUtc}`} hover>
                      <TableCell>{formatUtcDate(sale.soldAtUtc)}</TableCell>
                      <TableCell>{sale.saleId.slice(0, 8)}</TableCell>
                      <TableCell>{paymentMethodLabel(sale.paymentMethod)}</TableCell>
                      <TableCell align="right">{sale.quantity}</TableCell>
                      <TableCell align="right">{formatCurrency(sale.unitPrice)}</TableCell>
                      <TableCell align="right">{formatCurrency(sale.totalPrice)}</TableCell>
                      <TableCell align="right">{formatCurrency(sale.lojinhaGainAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            {pagedSales.length === 0 ? <Alert severity="info" sx={{ mt: 2 }}>Nenhuma venda deste produto foi encontrada.</Alert> : null}
            <TablePagination component="div" count={productSales.length} page={salesPage} onPageChange={(_event, page) => setSalesPage(page)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} labelRowsPerPage="Itens por página" />
          </>
        ) : null}

        {tab === 2 ? (
          <>
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Quantidade</TableCell>
                    <TableCell align="right">Custo unitário</TableCell>
                    <TableCell>Observação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedMovements.map((movement) => (
                    <TableRow key={movement.id} hover>
                      <TableCell>{formatUtcDate(movement.occurredAtUtc)}</TableCell>
                      <TableCell>{movement.type}</TableCell>
                      <TableCell align="right">{movement.quantity}</TableCell>
                      <TableCell align="right">{formatCurrency(movement.unitCost)}</TableCell>
                      <TableCell>{movement.notes || 'Sem observação'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            {pagedMovements.length === 0 ? <Alert severity="info" sx={{ mt: 2 }}>Sem movimentações de estoque para este produto.</Alert> : null}
            <TablePagination component="div" count={productMovements.length} page={movementsPage} onPageChange={(_event, page) => setMovementsPage(page)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} labelRowsPerPage="Itens por página" />
          </>
        ) : null}

        {tab === 3 ? (
          <>
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Quando</TableCell>
                    <TableCell>Ação</TableCell>
                    <TableCell align="right">Custo</TableCell>
                    <TableCell align="right">Venda</TableCell>
                    <TableCell align="right">Estoque</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedPriceHistory.map((entry) => (
                    <TableRow key={`${entry.changedAtUtc}-${entry.changedBy}`} hover>
                      <TableCell>{formatUtcDate(entry.changedAtUtc)}</TableCell>
                      <TableCell>{entry.action}</TableCell>
                      <TableCell align="right">{entry.costPrice ? formatCurrency(entry.costPrice) : '-'}</TableCell>
                      <TableCell align="right">{entry.salePrice ? formatCurrency(entry.salePrice) : '-'}</TableCell>
                      <TableCell align="right">{entry.currentStock ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            {pagedPriceHistory.length === 0 ? <Alert severity="info" sx={{ mt: 2 }}>Sem histórico de preço para exibir.</Alert> : null}
            <TablePagination component="div" count={priceHistory.length} page={priceHistoryPage} onPageChange={(_event, page) => setPriceHistoryPage(page)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} labelRowsPerPage="Itens por página" />
          </>
        ) : null}
      </Paper>
    </Stack>
  );
}
