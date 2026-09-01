import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Paper, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useActionCenter } from '../hooks/useActionCenter';
import { dashboardApi } from '../services/api';
import { PageSection } from '../components/PageSection';
import { StatCard } from '../components/StatCard';
import { formatUtcDate } from '../services/date';
import { fairStatusLabel, formatCurrency, paymentMethodLabel } from '../services/labels';

const GRADIENTS = {
  rose: 'linear-gradient(135deg, rgba(245,178,197,0.68), rgba(255,236,223,0.95))',
  green: 'linear-gradient(135deg, rgba(184,226,150,0.75), rgba(248,245,221,0.95))',
  yellow: 'linear-gradient(135deg, rgba(248,229,140,0.78), rgba(255,244,217,0.95))',
  gold: 'linear-gradient(135deg, rgba(214, 189, 135, 0.78), rgba(255, 247, 228, 0.95))'
};

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderColor: 'rgba(217,107,135,0.16)', backgroundColor: 'rgba(255,255,255,0.6)' }}>
      <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'block' }}>{label}</Typography>
      <Typography sx={{ fontFamily: '"Baloo 2", "Nunito", sans-serif', fontWeight: 700, fontSize: '1.15rem' }}>{value}</Typography>
    </Paper>
  );
}

function RankingList({
  emptyLabel,
  rows
}: {
  emptyLabel: string;
  rows: { name: string; caption?: string; barRatio: number; value: string }[];
}) {
  if (rows.length === 0) {
    return <Typography color="text.secondary">{emptyLabel}</Typography>;
  }

  return (
    <Stack spacing={1.5}>
      {rows.map((row, index) => (
        <Box key={row.name} sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) auto', alignItems: 'center', gap: 1.25 }}>
          <Typography sx={{ fontFamily: '"Baloo 2", "Nunito", sans-serif', fontWeight: 700, color: '#c9a6ac' }}>{index + 1}</Typography>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={700} fontSize={13.5} noWrap title={row.name}>{row.name}</Typography>
            {row.caption ? <Typography color="text.secondary" fontSize={12}>{row.caption}</Typography> : null}
            <Box sx={{ mt: 0.5, height: 8, borderRadius: 999, backgroundColor: 'rgba(217,107,135,0.12)', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', borderRadius: 999, width: `${Math.max(6, Math.round(row.barRatio * 100))}%`, backgroundColor: '#7bcfc0' }} />
            </Box>
          </Box>
          <Typography sx={{ fontFamily: '"Baloo 2", "Nunito", sans-serif', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>{row.value}</Typography>
        </Box>
      ))}
    </Stack>
  );
}

export function DashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isSupplier = session?.role === 'Supplier';
  const isReseller = session?.role === 'Reseller';
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.getSummary });
  const actionItems = useActionCenter();

  const periodItemsTotal = useMemo(
    () => (data?.periodMetrics ?? []).reduce((sum, item) => sum + item.itemsSold, 0),
    [data?.periodMetrics]
  );

  const paymentRows = useMemo(() => {
    const rows = (data?.revenueByPayment ?? []).filter((row) => row.amount > 0);
    const max = rows.reduce((peak, row) => Math.max(peak, row.amount), 0);
    return rows.map((row) => ({ ...row, ratio: max > 0 ? row.amount / max : 0 }));
  }, [data?.revenueByPayment]);

  const topSoldRows = useMemo(() => {
    const rows = (data?.topProducts ?? []).filter((item) => item.productName);
    const max = rows.reduce((peak, item) => Math.max(peak, item.quantitySold), 0);
    return rows.map((item) => ({
      name: item.productName,
      caption: formatCurrency(item.revenue),
      barRatio: max > 0 ? item.quantitySold / max : 0,
      value: `${item.quantitySold} un`
    }));
  }, [data?.topProducts]);

  const topProfitRows = useMemo(() => {
    const rows = (data?.topProfitProducts ?? []).filter((item) => item.productName);
    const max = rows.reduce((peak, item) => Math.max(peak, item.profit), 0);
    return rows.map((item) => ({
      name: item.productName,
      barRatio: max > 0 ? item.profit / max : 0,
      value: formatCurrency(item.profit)
    }));
  }, [data?.topProfitProducts]);

  const revenueChartTitle = isSupplier || isReseller ? 'Resultado nos últimos meses' : 'Receita nos últimos meses';
  const revenueChartSubtitle = isSupplier
    ? 'Já descontando custo e ganho da lojinha.'
    : isReseller
      ? 'Considerando a margem por peça vendida.'
      : 'Faturamento bruto mês a mês.';

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h3">{isSupplier ? 'Painel do fornecedor' : isReseller ? 'Painel do revendedor' : 'Painel da loja'}</Typography>
        <Typography color="text.secondary">
          {isSupplier
            ? 'Seu faturamento, comissão, estoque e desempenho dos seus próprios produtos.'
            : isReseller
              ? 'Somente as vendas realizadas por você, com lucro líquido pela sua margem.'
              : 'Faturamento, margem, caixinha e performance comercial em uma leitura rápida.'}
        </Typography>
      </Stack>

      {actionItems.length > 0 ? (
        <Paper sx={{ p: { xs: 2, md: 3 }, overflow: 'hidden', border: '1px solid rgba(217,107,135,0.4)' }}>
          <Typography variant="h5" sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, lineHeight: 1.2, mb: 0.5 }}>Precisa de você</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>O que está em aberto agora, antes dos números.</Typography>
          <Stack spacing={1}>
            {actionItems.map((item) => (
              <Paper
                key={item.key}
                variant="outlined"
                sx={{ p: 1.5, borderColor: item.tone === 'urgent' ? 'rgba(217,107,135,0.35)' : 'rgba(217,107,135,0.16)' }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} sx={{ color: item.tone === 'urgent' ? '#c0566e' : 'inherit' }}>{item.label}</Typography>
                    <Typography color="text.secondary" fontSize={12.5}>{item.detail}</Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => navigate(item.to)} sx={{ flexShrink: 0 }}>Abrir</Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: isReseller ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }
        }}
      >
        <StatCard
          label={isSupplier || isReseller ? 'Resultado do mês' : 'Faturamento do mês'}
          value={formatCurrency(data?.monthlyRevenue ?? 0)}
          gradient={GRADIENTS.rose}
          detail={`${data?.totalSalesCount ?? 0} vendas`}
        />
        <StatCard label="Lucro realizado" value={formatCurrency(data?.realizedProfit ?? 0)} gradient={GRADIENTS.green} detail="Somente vendas registradas" />
        <StatCard label="Ticket médio" value={formatCurrency(data?.averageTicket ?? 0)} gradient={GRADIENTS.yellow} detail={`${data?.totalSalesCount ?? 0} vendas no total`} />
        {!isReseller ? (
          <StatCard label="Caixinha do mês" value={formatCurrency(data?.monthlyPiggyBankAmount ?? 0)} gradient={GRADIENTS.gold} detail="50% do líquido mensal" />
        ) : null}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: isReseller ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }
        }}
      >
        <MiniStat label="Vendas no total" value={`${data?.totalSalesCount ?? 0}`} />
        <MiniStat label="Itens vendidos (90d)" value={`${periodItemsTotal}`} />
        {!isReseller ? <MiniStat label="Feiras em aberto" value={`${data?.openFairsCount ?? 0}`} /> : null}
        <MiniStat label="Despesas do mês" value={formatCurrency(data?.totalExpenses ?? 0)} />
      </Box>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.6fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
        <PageSection title={revenueChartTitle} subtitle={revenueChartSubtitle}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.revenueSeries ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line type="monotone" dataKey="value" stroke="#d96b87" strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </PageSection>

        <PageSection title="Formas de pagamento" subtitle="Participação de cada meio na receita do período.">
          {paymentRows.length === 0 ? (
            <Typography color="text.secondary">Nenhuma venda registrada ainda.</Typography>
          ) : (
            <Stack spacing={1.75}>
              {paymentRows.map((row) => (
                <Box key={row.category}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography fontSize={13} fontWeight={700}>{paymentMethodLabel(row.category)}</Typography>
                    <Typography fontSize={13}>{formatCurrency(row.amount)}</Typography>
                  </Stack>
                  <Box sx={{ height: 10, borderRadius: 999, backgroundColor: 'rgba(217,107,135,0.12)', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', borderRadius: 999, width: `${Math.max(4, Math.round(row.ratio * 100))}%`, backgroundColor: '#7bcfc0' }} />
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </PageSection>
      </Box>

      <PageSection title="Vendas por período" subtitle="Faixas isoladas de 0-15, 16-30, 31-60 e 61-90 dias — cada linha é só aquele intervalo.">
        {isMobile ? (
          <Stack spacing={1.25}>
            {(data?.periodMetrics ?? []).map((metric) => (
              <Paper key={metric.label} variant="outlined" sx={{ p: 1.5, borderColor: 'rgba(217,107,135,0.16)' }}>
                <Typography fontWeight={700}>{metric.label}</Typography>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                  <Typography fontSize={13} color="text.secondary">{metric.itemsSold} itens</Typography>
                  <Typography fontSize={13}>Bruto {formatCurrency(metric.grossRevenue)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontSize={13} sx={{ color: metric.netRevenue >= 0 ? '#4e7a34' : '#c0566e', fontWeight: 700 }}>Líquido {formatCurrency(metric.netRevenue)}</Typography>
                  <Typography fontSize={13} color="text.secondary">Caixinha {formatCurrency(metric.piggyBankAmount)}</Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 560 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(4, 1fr)', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid rgba(217,107,135,0.22)' }}>
                {['Faixa', 'Itens', 'Receita bruta', 'Receita líquida', 'Caixinha'].map((header, index) => (
                  <Typography key={header} variant="overline" sx={{ color: 'text.secondary', textAlign: index === 0 ? 'left' : 'right' }}>{header}</Typography>
                ))}
              </Box>
              {(data?.periodMetrics ?? []).map((metric) => (
                <Box
                  key={metric.label}
                  sx={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(4, 1fr)', gap: 1, px: 1.5, py: 1.25, borderBottom: '1px solid rgba(217,107,135,0.12)' }}
                >
                  <Typography fontWeight={700}>{metric.label}</Typography>
                  <Typography textAlign="right">{metric.itemsSold}</Typography>
                  <Typography textAlign="right">{formatCurrency(metric.grossRevenue)}</Typography>
                  <Typography textAlign="right" sx={{ color: metric.netRevenue >= 0 ? '#4e7a34' : '#c0566e' }}>{formatCurrency(metric.netRevenue)}</Typography>
                  <Typography textAlign="right">{formatCurrency(metric.piggyBankAmount)}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </PageSection>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
        <PageSection title="Itens mais vendidos" subtitle="Top por quantidade no período recente.">
          <RankingList emptyLabel="Sem vendas no período." rows={topSoldRows} />
        </PageSection>
        <PageSection title="Itens mais rentáveis" subtitle="Top por lucro acumulado.">
          <RankingList emptyLabel="Sem lucro apurado no período." rows={topProfitRows} />
        </PageSection>
      </Box>

      {!isReseller ? (
        <PageSection title="Feiras recentes" subtitle="Resultado por evento, da mais recente para a mais antiga.">
          {(data?.recentFairs ?? []).length === 0 ? (
            <Typography color="text.secondary">Nenhuma feira registrada ainda.</Typography>
          ) : (
            <>
              <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
                <Box sx={{ minWidth: 640 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 1fr', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid rgba(217,107,135,0.22)' }}>
                    {['Feira', 'Data', 'Status', 'Bruto', 'Caixinha', 'Resultado'].map((header, index) => (
                      <Typography key={header} variant="overline" sx={{ color: 'text.secondary', textAlign: index >= 3 ? 'right' : 'left' }}>{header}</Typography>
                    ))}
                  </Box>
                  {(data?.recentFairs ?? []).map((fair) => (
                    <Box
                      key={`${fair.fairName}-${fair.eventDateUtc}`}
                      sx={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 1fr', gap: 1, px: 1.5, py: 1.25, borderBottom: '1px solid rgba(217,107,135,0.12)', alignItems: 'center' }}
                    >
                      <Typography fontWeight={700} noWrap title={fair.fairName}>{fair.fairName}</Typography>
                      <Typography>{formatUtcDate(fair.eventDateUtc)}</Typography>
                      <Typography>{fairStatusLabel(fair.status)}</Typography>
                      <Typography textAlign="right">{formatCurrency(fair.grossRevenue)}</Typography>
                      <Typography textAlign="right">{formatCurrency(fair.piggyBankAmount)}</Typography>
                      <Typography textAlign="right" fontWeight={700} sx={{ color: fair.netRevenue >= 0 ? '#4e7a34' : '#c0566e' }}>{formatCurrency(fair.netRevenue)}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Stack spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' } }}>
                {(data?.recentFairs ?? []).map((fair) => (
                  <Paper key={`${fair.fairName}-${fair.eventDateUtc}`} variant="outlined" sx={{ p: 2, borderColor: 'rgba(217,107,135,0.16)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography fontWeight={700}>{fair.fairName}</Typography>
                      <Typography fontSize={12} color="text.secondary">{fairStatusLabel(fair.status)}</Typography>
                    </Stack>
                    <Typography color="text.secondary" fontSize={13}>{formatUtcDate(fair.eventDateUtc)}</Typography>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                      <Typography fontSize={13} color="text.secondary">Bruto {formatCurrency(fair.grossRevenue)}</Typography>
                      <Typography fontSize={13} color="text.secondary">Caixinha {formatCurrency(fair.piggyBankAmount)}</Typography>
                    </Stack>
                    <Typography fontWeight={700} sx={{ mt: 0.5, color: fair.netRevenue >= 0 ? '#4e7a34' : '#c0566e' }}>Resultado {formatCurrency(fair.netRevenue)}</Typography>
                  </Paper>
                ))}
              </Stack>
            </>
          )}
        </PageSection>
      ) : null}
    </Stack>
  );
}
