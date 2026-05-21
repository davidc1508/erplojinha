import { useQuery } from '@tanstack/react-query';
import { Chip, Grid, Paper, Stack, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { dashboardApi } from '../services/api';
import { PageSection } from '../components/PageSection';
import { StatCard } from '../components/StatCard';
import { formatUtcDate } from '../services/date';
import { fairStatusLabel, formatCurrency } from '../services/labels';

export function DashboardPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const isReseller = session?.role === 'Reseller';
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.getSummary });

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h3">{isSupplier ? 'Painel do fornecedor' : isReseller ? 'Painel do revendedor' : 'Painel da loja'}</Typography>
        <Typography color="text.secondary">{isSupplier ? 'Visão do seu faturamento, comissão, estoque e desempenho dos seus próprios produtos.' : isReseller ? 'Visão somente das vendas realizadas por você, com lucro líquido pela sua margem.' : 'Visão rápida de faturamento, margem, estoque e performance comercial.'}</Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}><StatCard label={isSupplier || isReseller ? 'Resultado do mês' : 'Faturamento do mês'} value={formatCurrency(data?.monthlyRevenue ?? 0)} gradient="linear-gradient(135deg, rgba(245,178,197,0.68), rgba(255,236,223,0.95))" /></Grid>
        <Grid item xs={12} md={3}><StatCard label="Lucro realizado" value={formatCurrency(data?.realizedProfit ?? 0)} gradient="linear-gradient(135deg, rgba(184,226,150,0.75), rgba(248,245,221,0.95))" detail="Somente vendas registradas" /></Grid>
        <Grid item xs={12} md={3}><StatCard label="Ticket médio" value={formatCurrency(data?.averageTicket ?? 0)} gradient="linear-gradient(135deg, rgba(248,229,140,0.78), rgba(255,244,217,0.95))" detail={`${data?.totalSalesCount ?? 0} vendas`} /></Grid>
        {!isReseller ? <Grid item xs={12} md={3}><StatCard label="Feiras em aberto" value={`${data?.openFairsCount ?? 0}`} gradient="linear-gradient(135deg, rgba(152,217,208,0.72), rgba(233,255,251,0.95))" /></Grid> : null}
        {!isReseller ? <Grid item xs={12} md={3}><StatCard label="Caixinha do mês" value={formatCurrency(data?.monthlyPiggyBankAmount ?? 0)} gradient="linear-gradient(135deg, rgba(214, 189, 135, 0.78), rgba(255, 247, 228, 0.95))" detail="50% do líquido mensal" /></Grid> : null}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title={isSupplier || isReseller ? 'Resultado recente' : 'Receita recente'} subtitle={isSupplier ? 'Últimos meses já descontando custo e ganho da lojinha' : isReseller ? 'Últimos meses considerando margem por peça vendida' : 'Últimos meses de faturamento bruto'}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data?.revenueSeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="value" stroke="#d96b87" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </PageSection>
        </Grid>
        {!isReseller ? (
          <Grid item xs={12} lg={4}>
            <PageSection title="Últimas 3 feiras" subtitle="Indicadores rápidos por evento">
              <Stack spacing={1.5}>
                {(data?.recentFairs ?? []).map((item) => (
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
        ) : null}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <PageSection title="Vendas por período" subtitle="Faixas isoladas de 0-15, 16-30, 31-60 e 61-90 dias">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.periodMetrics ?? []}>
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
              <BarChart data={data?.periodMetrics ?? []}>
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
              {(data?.topProducts ?? []).map((item) => (
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
              {(data?.topProfitProducts ?? []).map((item) => (
                <Paper key={item.productName} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.65)' }}>
                  <Typography fontWeight={700}>{item.productName}</Typography>
                  <Typography variant="h6">{formatCurrency(item.profit)}</Typography>
                </Paper>
              ))}
            </Stack>
          </PageSection>
        </Grid>
      </Grid>
    </Stack>
  );
}