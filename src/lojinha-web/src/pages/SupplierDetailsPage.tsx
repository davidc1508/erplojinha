import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Chip, Grid, Paper, Stack, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { StatCard } from '../components/StatCard';
import { fairsApi, productsApi, salesApi, suppliersApi } from '../services/api';
import { formatUtcDate } from '../services/date';
import { fairStatusLabel, formatCurrency, paymentMethodLabel } from '../services/labels';
import type { FairStatus } from '../services/types';

type SupplierSaleItem = {
  saleId: string;
  soldAtUtc: string;
  paymentMethod: string;
  fairName?: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  lojinhaGainAmount: number;
};

export function SupplierDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: supplier } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => suppliersApi.getById(id!),
    enabled: Boolean(id)
  });
  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: salesApi.getAll });
  const { data: fairs = [] } = useQuery({ queryKey: ['fairs'], queryFn: fairsApi.getAll });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.getAll() });

  const summary = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        year: date.getFullYear(),
        month: date.getMonth()
      };
    });

    const supplierItems = sales.flatMap((sale) => sale.items
      .filter((item) => item.supplierId === id)
      .map<SupplierSaleItem>((item) => ({
        saleId: sale.id,
        soldAtUtc: sale.soldAtUtc,
        paymentMethod: sale.paymentMethod,
        fairName: sale.fairName,
        productName: item.productName,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        lojinhaGainAmount: item.lojinhaGainAmount
      })));

    const saleIds = new Set(supplierItems.map((item) => item.saleId));
    const supplierSales = sales.filter((sale) => saleIds.has(sale.id));
    const monthlyItems = supplierItems.filter((item) => {
      const soldAt = new Date(item.soldAtUtc);
      return soldAt.getUTCFullYear() === now.getUTCFullYear() && soldAt.getUTCMonth() === now.getUTCMonth();
    });
    const lowStockProducts = products
      .filter((product) => product.supplierId === id && product.currentStock <= product.minimumStock)
      .sort((left, right) => left.currentStock - right.currentStock)
      .slice(0, 6)
      .map((product) => ({
        productName: product.name,
        currentStock: product.currentStock,
        minimumStock: product.minimumStock
      }));
    const topProducts = Object.values(supplierItems.reduce<Record<string, { productName: string; quantitySold: number; revenue: number }>>((acc, item) => {
      if (!acc[item.productName]) {
        acc[item.productName] = { productName: item.productName, quantitySold: 0, revenue: 0 };
      }

      acc[item.productName].quantitySold += item.quantity;
      acc[item.productName].revenue += item.totalPrice;
      return acc;
    }, {})).sort((left, right) => right.quantitySold - left.quantitySold).slice(0, 5);
    const topProfitProducts = Object.values(supplierItems.reduce<Record<string, { productName: string; profit: number }>>((acc, item) => {
      if (!acc[item.productName]) {
        acc[item.productName] = { productName: item.productName, profit: 0 };
      }

      acc[item.productName].profit += item.lojinhaGainAmount;
      return acc;
    }, {})).sort((left, right) => right.profit - left.profit).slice(0, 5);
    const periodDefinitions = [
      { label: '0-15 dias', startDays: 0, endDays: 15 },
      { label: '16-30 dias', startDays: 15, endDays: 30 },
      { label: '31-60 dias', startDays: 30, endDays: 60 },
      { label: '61-90 dias', startDays: 60, endDays: 90 }
    ];
    const periodMetrics = periodDefinitions.map((period) => {
      const windowStart = new Date(now);
      windowStart.setUTCDate(windowStart.getUTCDate() - period.endDays);
      const windowEnd = new Date(now);
      if (period.startDays > 0) {
        windowEnd.setUTCDate(windowEnd.getUTCDate() - period.startDays);
      }

      const filteredItems = supplierItems.filter((item) => {
        const soldAt = new Date(item.soldAtUtc);
        return soldAt >= windowStart && soldAt < windowEnd;
      });
      const netRevenue = filteredItems.reduce((sum, item) => sum + item.lojinhaGainAmount, 0);

      return {
        label: period.label,
        days: period.endDays,
        itemsSold: filteredItems.reduce((sum, item) => sum + item.quantity, 0),
        grossRevenue: filteredItems.reduce((sum, item) => sum + item.totalPrice, 0),
        netRevenue,
        piggyBankAmount: netRevenue <= 0 ? 0 : Number((netRevenue / 2).toFixed(2))
      };
    });
    const revenueSeries = months.map((month) => ({
      label: month.label,
      value: supplierItems
        .filter((item) => {
          const soldAt = new Date(item.soldAtUtc);
          return soldAt.getUTCFullYear() === month.year && soldAt.getUTCMonth() === month.month;
        })
        .reduce((sum, item) => sum + item.totalPrice, 0)
    }));
    const revenueByPayment = Object.values(supplierItems.reduce<Record<string, { category: string; amount: number }>>((acc, item) => {
      const key = item.paymentMethod;
      if (!acc[key]) {
        acc[key] = { category: paymentMethodLabel(item.paymentMethod as any), amount: 0 };
      }

      acc[key].amount += item.totalPrice;
      return acc;
    }, {})).sort((left, right) => right.amount - left.amount);
    const recentFairs = Object.values(supplierItems.reduce<Record<string, { fairName: string; eventDateUtc: string; status: FairStatus; grossRevenue: number; netRevenue: number; registrationFee: number; piggyBankAmount: number }>>((acc, item) => {
      const fairName = item.fairName;
      if (!fairName) {
        return acc;
      }

      const fair = fairs.find((currentFair) => currentFair.name === fairName);
      const key = fair?.id ?? fairName;
      if (!acc[key]) {
        acc[key] = {
          fairName,
          eventDateUtc: fair?.eventDateUtc ?? item.soldAtUtc,
          status: fair?.status ?? 'Open',
          grossRevenue: 0,
          netRevenue: 0,
          registrationFee: fair?.registrationFee ?? 0,
          piggyBankAmount: 0
        };
      }

      acc[key].grossRevenue += item.totalPrice;
      acc[key].netRevenue += item.lojinhaGainAmount;
      acc[key].piggyBankAmount = acc[key].netRevenue <= 0 ? 0 : Number((acc[key].netRevenue / 2).toFixed(2));
      return acc;
    }, {})).sort((left, right) => new Date(right.eventDateUtc).getTime() - new Date(left.eventDateUtc).getTime()).slice(0, 3);

    return {
      monthlyRevenue: monthlyItems.reduce((sum, item) => sum + item.totalPrice, 0),
      realizedProfit: supplierItems.reduce((sum, item) => sum + item.lojinhaGainAmount, 0),
      averageTicket: supplierSales.length === 0 ? 0 : supplierItems.reduce((sum, item) => sum + item.totalPrice, 0) / supplierSales.length,
      totalSalesCount: supplierSales.length,
      openFairsCount: fairs.filter((fair) => fair.status === 'Open' && fair.suppliers.some((linkedSupplier) => linkedSupplier.supplierId === id)).length,
      lowStockCount: lowStockProducts.length,
      monthlyPiggyBankAmount: (() => {
        const monthlyNetRevenue = monthlyItems.reduce((sum, item) => sum + item.lojinhaGainAmount, 0);
        return monthlyNetRevenue <= 0 ? 0 : Number((monthlyNetRevenue / 2).toFixed(2));
      })(),
      topProducts,
      topProfitProducts,
      lowStockProducts,
      recentFairs,
      periodMetrics,
      revenueSeries,
      revenueByPayment
    };
  }, [fairs, id, products, sales]);

  if (!supplier) {
    return (
      <Stack spacing={3}>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/fornecedores')} sx={{ alignSelf: 'flex-start' }}>
          Voltar para fornecedores
        </Button>
        <Typography color="text.secondary">Carregando fornecedor...</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h3">{supplier.name}</Typography>
          <Typography color="text.secondary">Dashboard do fornecedor com base apenas nas vendas assinaladas para este fornecedor.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/fornecedores')}>
          Voltar para fornecedores
        </Button>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}><StatCard label="Resultado do mês" value={formatCurrency(summary.monthlyRevenue)} gradient="linear-gradient(135deg, rgba(245,178,197,0.68), rgba(255,236,223,0.95))" /></Grid>
        <Grid item xs={12} md={3}><StatCard label="Lucro realizado" value={formatCurrency(summary.realizedProfit)} gradient="linear-gradient(135deg, rgba(184,226,150,0.75), rgba(248,245,221,0.95))" detail="Somente vendas marcadas para este fornecedor" /></Grid>
        <Grid item xs={12} md={3}><StatCard label="Ticket médio" value={formatCurrency(summary.averageTicket)} gradient="linear-gradient(135deg, rgba(248,229,140,0.78), rgba(255,244,217,0.95))" detail={`${summary.totalSalesCount} vendas`} /></Grid>
        <Grid item xs={12} md={3}><StatCard label="Feiras em aberto" value={`${summary.openFairsCount}`} gradient="linear-gradient(135deg, rgba(152,217,208,0.72), rgba(233,255,251,0.95))" detail={`${summary.lowStockCount} alertas de estoque`} /></Grid>
        <Grid item xs={12} md={3}><StatCard label="Caixinha do mês" value={formatCurrency(summary.monthlyPiggyBankAmount)} gradient="linear-gradient(135deg, rgba(214, 189, 135, 0.78), rgba(255, 247, 228, 0.95))" detail="50% do líquido mensal" /></Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title="Resultado recente" subtitle="Últimos meses já descontando custo e ganho da lojinha">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={summary.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="value" stroke="#d96b87" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </PageSection>
        </Grid>
        <Grid item xs={12} lg={4}>
          <PageSection title="Últimas 3 feiras" subtitle="Eventos onde este fornecedor teve venda registrada">
            <Stack spacing={1.5}>
              {summary.recentFairs.length === 0 ? <Alert severity="info">Nenhuma feira com venda registrada para este fornecedor.</Alert> : summary.recentFairs.map((item) => (
                <Paper key={`${item.fairName}-${item.eventDateUtc}`} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.65)' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography fontWeight={700}>{item.fairName}</Typography>
                    <Chip size="small" label={fairStatusLabel(item.status)} color={item.status === 'Open' ? 'success' : item.status === 'Awaiting' ? 'warning' : 'default'} />
                  </Stack>
                  <Typography color="text.secondary">{formatUtcDate(item.eventDateUtc)}</Typography>
                  <Typography color="text.secondary">Bruto: {formatCurrency(item.grossRevenue)}</Typography>
                  <Typography color="text.secondary">Caixinha: {formatCurrency(item.piggyBankAmount)}</Typography>
                  <Typography variant="h6">Resultado: {formatCurrency(item.netRevenue)}</Typography>
                </Paper>
              ))}
            </Stack>
          </PageSection>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <PageSection title="Vendas por período" subtitle="Faixas isoladas de 0-15, 16-30, 31-60 e 61-90 dias">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary.periodMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number, name: string) => name === 'itemsSold' ? `${value} itens` : formatCurrency(Number(value))} />
                <Bar dataKey="itemsSold" fill="#7bcfc0" radius={[10, 10, 0, 0]} />
                <Bar dataKey="grossRevenue" fill="#d96b87" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </PageSection>
        </Grid>
        <Grid item xs={12} lg={6}>
          <PageSection title="Receita líquida por período" subtitle="Lucro líquido em faixas isoladas, sem acumular períodos maiores">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary.periodMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="netRevenue" fill="#98d9d0" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </PageSection>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <PageSection title="Itens mais vendidos" subtitle="Top por quantidade no período recente">
            <Stack spacing={1.5}>
              {summary.topProducts.length === 0 ? <Alert severity="info">Nenhum produto deste fornecedor com venda registrada.</Alert> : summary.topProducts.map((item) => (
                <Paper key={item.productName} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.65)' }}>
                  <Typography fontWeight={700}>{item.productName}</Typography>
                  <Typography color="text.secondary">{item.quantitySold} itens vendidos</Typography>
                  <Typography variant="h6">{formatCurrency(item.revenue)}</Typography>
                </Paper>
              ))}
            </Stack>
          </PageSection>
        </Grid>
        <Grid item xs={12} lg={4}>
          <PageSection title="Itens mais rentáveis" subtitle="Top por lucro acumulado">
            <Stack spacing={1.5}>
              {summary.topProfitProducts.length === 0 ? <Alert severity="info">Nenhum item rentável registrado para este fornecedor.</Alert> : summary.topProfitProducts.map((item) => (
                <Paper key={item.productName} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.65)' }}>
                  <Typography fontWeight={700}>{item.productName}</Typography>
                  <Typography variant="h6">{formatCurrency(item.profit)}</Typography>
                </Paper>
              ))}
            </Stack>
          </PageSection>
        </Grid>
        <Grid item xs={12} lg={4}>
          <PageSection title="Produtos com estoque baixo" subtitle="Reposição recomendada">
            <Stack spacing={1.5}>
              {summary.lowStockProducts.length === 0 ? <Alert severity="info">Nenhum produto deste fornecedor com estoque baixo.</Alert> : summary.lowStockProducts.map((item) => (
                <Paper key={item.productName} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.65)' }}>
                  <Typography fontWeight={700}>{item.productName}</Typography>
                  <Typography color="text.secondary">Atual: {item.currentStock} | Mínimo: {item.minimumStock}</Typography>
                </Paper>
              ))}
            </Stack>
          </PageSection>
        </Grid>
      </Grid>

      <PageSection title="Resultado por pagamento" subtitle="Resultado líquido por forma de pagamento nas vendas deste fornecedor">
        <Stack spacing={1.5}>
          {summary.revenueByPayment.length === 0 ? <Alert severity="info">Nenhuma venda registrada para este fornecedor.</Alert> : summary.revenueByPayment.map((item) => (
            <Paper key={item.category} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.65)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={700}>{item.category}</Typography>
                <Typography variant="h6">{formatCurrency(item.amount)}</Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </PageSection>

      <Paper sx={{ p: 2.5, backgroundColor: 'rgba(255,255,255,0.65)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
          <InsightsRoundedIcon color="primary" />
          <div>
            <Typography fontWeight={700}>Contato</Typography>
            <Typography color="text.secondary">{supplier.contactName || 'Não informado'} • {supplier.phoneNumber || 'Não informado'}</Typography>
            <Typography color="text.secondary">{supplier.notes || 'Sem observações cadastradas.'}</Typography>
          </div>
        </Stack>
      </Paper>
    </Stack>
  );
}