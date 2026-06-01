import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageSection } from '../components/PageSection';
import { inventoryApi, productsApi, salesApi } from '../services/api';
import { formatUtcDate } from '../services/date';
import { formatCurrency, paymentMethodLabel } from '../services/labels';
import { useAuth } from '../hooks/useAuth';

export function ProductDetailsPage() {
  const { session } = useAuth();
  const isReseller = session?.role === 'Reseller';
  const { id } = useParams();
  const navigate = useNavigate();
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
        .reduce((sum, sale) => sum + sale.totalPrice, 0),
      quantity: productSales
        .filter((sale) => {
          const soldAt = new Date(sale.soldAtUtc);
          return soldAt.getUTCFullYear() === month.year && soldAt.getUTCMonth() === month.month;
        })
        .reduce((sum, sale) => sum + sale.quantity, 0)
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
          <Typography variant="h4">{product.name}</Typography>
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

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Estoque real</Typography><Typography variant="h5">{product.currentStock}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Unidades vendidas</Typography><Typography variant="h5">{soldQuantity}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Receita acumulada</Typography><Typography variant="h5">{formatCurrency(soldRevenue)}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Lucro acumulado</Typography><Typography variant="h5">{formatCurrency(soldProfit)}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Ticket médio</Typography><Typography variant="h5">{formatCurrency(averageTicket)}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Última venda</Typography><Typography variant="h5">{lastSaleDate ? formatUtcDate(lastSaleDate) : 'Sem vendas'}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} lg={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Última movimentação</Typography><Typography variant="h5">{lastMovementDate ? formatUtcDate(lastMovementDate) : 'Sem movimentação'}</Typography></Paper></Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title="Evolução de vendas" subtitle="Receita e quantidade vendida dos últimos 6 meses.">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyRevenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="revenue" stroke="#d96b87" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </PageSection>
        </Grid>
        <Grid item xs={12} lg={4}>
          <PageSection title="Composição de custos" subtitle="Visão completa para precificação e margem.">
            <Stack spacing={1.2}>
              <Typography color="text.secondary">Custo de composição: {formatCurrency(pricing?.compositionCost ?? 0)}</Typography>
              <Typography color="text.secondary">Custo total: {formatCurrency(pricing?.totalCost ?? 0)}</Typography>
              <Typography color="text.secondary">Material: {formatCurrency(pricing?.materialCost ?? 0)}</Typography>
              <Typography color="text.secondary">Energia: {formatCurrency(pricing?.energyCost ?? 0)}</Typography>
              <Typography color="text.secondary">Manutenção: {formatCurrency(pricing?.maintenanceCost ?? 0)}</Typography>
              <Typography color="text.secondary">Falhas: {formatCurrency(pricing?.failureCost ?? 0)}</Typography>
              <Typography color="text.secondary">Acabamento: {formatCurrency(pricing?.finishingCost ?? 0)}</Typography>
              <Typography color="text.secondary">Mão de obra: {formatCurrency(pricing?.laborCost ?? 0)}</Typography>
              <Typography color="text.secondary">Custos adicionais: {formatCurrency(pricing?.additionalCosts ?? 0)}</Typography>
              <Typography fontWeight={700}>Preço final cadastrado: {formatCurrency(product.salePrice)}</Typography>
              <Typography fontWeight={700}>Margem estimada: {(pricing?.estimatedMargin ?? 0).toFixed(2)}%</Typography>
            </Stack>
          </PageSection>
        </Grid>
      </Grid>

      <PageSection title="Histórico de vendas" subtitle="Cada venda que movimentou este produto.">
        <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
          <Table size="small" sx={{ minWidth: 960 }}>
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Venda</TableCell>
                <TableCell>Pagamento</TableCell>
                <TableCell>Quantidade</TableCell>
                <TableCell>Preço unitário</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Ganho lojinha</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedSales.map((sale) => (
                <TableRow key={`${sale.saleId}-${sale.soldAtUtc}`} hover>
                  <TableCell>{formatUtcDate(sale.soldAtUtc)}</TableCell>
                  <TableCell>{sale.saleId.slice(0, 8)}</TableCell>
                  <TableCell>{paymentMethodLabel(sale.paymentMethod)}</TableCell>
                  <TableCell>{sale.quantity}</TableCell>
                  <TableCell>{formatCurrency(sale.unitPrice)}</TableCell>
                  <TableCell>{formatCurrency(sale.totalPrice)}</TableCell>
                  <TableCell>{formatCurrency(sale.lojinhaGainAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
        {pagedSales.length === 0 ? <Alert severity="info">Nenhuma venda deste produto foi encontrada.</Alert> : null}
        <TablePagination
          component="div"
          count={productSales.length}
          page={salesPage}
          onPageChange={(_event, page) => setSalesPage(page)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[rowsPerPage]}
          labelRowsPerPage="Itens por página"
        />
      </PageSection>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <PageSection title="Movimentações de estoque" subtitle="Entradas, saídas, ajustes e vendas relacionadas ao item.">
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 860 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Quantidade</TableCell>
                    <TableCell>Custo unitário</TableCell>
                    <TableCell>Observação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedMovements.map((movement) => (
                    <TableRow key={movement.id} hover>
                      <TableCell>{formatUtcDate(movement.occurredAtUtc)}</TableCell>
                      <TableCell>{movement.type}</TableCell>
                      <TableCell>{movement.quantity}</TableCell>
                      <TableCell>{formatCurrency(movement.unitCost)}</TableCell>
                      <TableCell>{movement.notes || 'Sem observação'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            {pagedMovements.length === 0 ? <Alert severity="info">Sem movimentações de estoque para este produto.</Alert> : null}
            <TablePagination
              component="div"
              count={productMovements.length}
              page={movementsPage}
              onPageChange={(_event, page) => setMovementsPage(page)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[rowsPerPage]}
              labelRowsPerPage="Itens por página"
            />
          </PageSection>
        </Grid>

        <Grid item xs={12} lg={5}>
          <PageSection title="Histórico de preço" subtitle="Rastro de alterações para auditoria comercial.">
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Quando</TableCell>
                    <TableCell>Ação</TableCell>
                    <TableCell>Custo</TableCell>
                    <TableCell>Venda</TableCell>
                    <TableCell>Estoque</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedPriceHistory.map((entry) => (
                    <TableRow key={`${entry.changedAtUtc}-${entry.changedBy}`} hover>
                      <TableCell>{formatUtcDate(entry.changedAtUtc)}</TableCell>
                      <TableCell>{entry.action}</TableCell>
                      <TableCell>{entry.costPrice ? formatCurrency(entry.costPrice) : '-'}</TableCell>
                      <TableCell>{entry.salePrice ? formatCurrency(entry.salePrice) : '-'}</TableCell>
                      <TableCell>{entry.currentStock ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            {pagedPriceHistory.length === 0 ? <Alert severity="info">Sem histórico de preço para exibir.</Alert> : null}
            <TablePagination
              component="div"
              count={priceHistory.length}
              page={priceHistoryPage}
              onPageChange={(_event, page) => setPriceHistoryPage(page)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[rowsPerPage]}
              labelRowsPerPage="Itens por página"
            />
          </PageSection>
        </Grid>
      </Grid>
    </Stack>
  );
}
