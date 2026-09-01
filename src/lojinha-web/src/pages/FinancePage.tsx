import { useQuery } from '@tanstack/react-query';
import { Box, Button, Chip, Grid, LinearProgress, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, Tabs, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { fairsApi, financeApi } from '../services/api';
import { financialCategoryLabel, financialClassificationLabel, financialTypeLabel, formatCurrency } from '../services/labels';

const FAIR_QUOTA_PAYMENT_CATEGORY = 'Pagamento de cota de feira';
const FAIR_QUOTA_LEGACY_PENDING_CATEGORY = 'Pendencia de pagamento em feiras';
const FAIR_QUOTA_PAYABLE_CATEGORY = 'Contas a pagar de feiras';

const isFairQuotaPayment = (category: string) =>
  category === FAIR_QUOTA_PAYMENT_CATEGORY || category === FAIR_QUOTA_LEGACY_PENDING_CATEGORY;

const isFairQuotaPayable = (category: string) =>
  category === FAIR_QUOTA_PAYABLE_CATEGORY || category === FAIR_QUOTA_LEGACY_PENDING_CATEGORY;

const daysSince = (isoDate: string) => Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000));

export function FinancePage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const isReseller = session?.role === 'Reseller';
  const isStoreAdmin = !isSupplier && !isReseller;
  const rowsPerPage = 8;
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [kpiYear, setKpiYear] = useState(currentYear);
  const { data: entries = [] } = useQuery({ queryKey: ['finance-entries'], queryFn: financeApi.getEntries });
  const { data: report } = useQuery({ queryKey: ['finance-report', kpiYear], queryFn: () => financeApi.getReport(kpiYear) });
  const { data: fairs = [] } = useQuery({ queryKey: ['fairs'], queryFn: fairsApi.getAll });

  const [search, setSearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<'All' | 'Fixed' | 'Variable'>('All');
  const [scopeFilter, setScopeFilter] = useState<'All' | 'Store' | 'Supplier'>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [entryTab, setEntryTab] = useState<'expense' | 'income' | 'quota'>('expense');
  const [quotaView, setQuotaView] = useState<'lancamentos' | 'fornecedores'>('lancamentos');
  const [quotaSearch, setQuotaSearch] = useState('');
  const [delinquencySearch, setDelinquencySearch] = useState('');
  const [delinquencyFairFilter, setDelinquencyFairFilter] = useState('All');
  const [delinquencyPage, setDelinquencyPage] = useState(0);
  const [quotaPage, setQuotaPage] = useState(0);
  const [entryPage, setEntryPage] = useState(0);

  const categoryBreakdown = useMemo(
    () => (report?.categories ?? []).map((item) => ({ ...item, categoryLabel: financialCategoryLabel(item.category) })).slice(0, 8),
    [report?.categories]
  );

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(entries.map((entry) => new Date(entry.occurredOnUtc).getFullYear())))
      .filter((year) => Number.isFinite(year))
      .sort((left, right) => right - left);
    return years.length > 0 ? years : [currentYear];
  }, [currentYear, entries]);

  useEffect(() => {
    if (!availableYears.includes(kpiYear)) {
      setKpiYear(availableYears[0]);
    }
  }, [availableYears, kpiYear]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((left, right) => {
      const leftPriority = left.category === FAIR_QUOTA_PAYMENT_CATEGORY ? 0 : 1;
      const rightPriority = right.category === FAIR_QUOTA_PAYMENT_CATEGORY ? 0 : 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return new Date(right.occurredOnUtc).getTime() - new Date(left.occurredOnUtc).getTime();
    });
  }, [entries]);

  const profileScopedEntries = useMemo(() => {
    if (isSupplier) {
      return sortedEntries.filter((entry) => entry.supplierId === session?.supplierId);
    }
    return sortedEntries.filter((entry) => !entry.supplierId);
  }, [isSupplier, session?.supplierId, sortedEntries]);

  const otherEntries = useMemo(() => profileScopedEntries.filter((entry) => !isFairQuotaPayment(entry.category)), [profileScopedEntries]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(otherEntries.map((entry) => entry.category)))
      .sort((left, right) => financialCategoryLabel(left).localeCompare(financialCategoryLabel(right), 'pt-BR')),
    [otherEntries]
  );

  const filteredOtherEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return otherEntries.filter((entry) => {
      if (classificationFilter !== 'All' && entry.classification !== classificationFilter) {
        return false;
      }
      if (isStoreAdmin) {
        if (scopeFilter === 'Store' && entry.supplierId) {
          return false;
        }
        if (scopeFilter === 'Supplier' && !entry.supplierId) {
          return false;
        }
      }
      if (categoryFilter !== 'All' && entry.category !== categoryFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      return [
        financialCategoryLabel(entry.category),
        entry.category,
        entry.description,
        entry.classification,
        entry.type,
        entry.supplierName ?? 'Lojinha'
      ].join(' ').toLowerCase().includes(term);
    });
  }, [categoryFilter, classificationFilter, isStoreAdmin, otherEntries, scopeFilter, search]);

  const incomeEntries = useMemo(() => filteredOtherEntries.filter((entry) => entry.type === 'Income'), [filteredOtherEntries]);
  const expenseEntries = useMemo(() => filteredOtherEntries.filter((entry) => entry.type === 'Expense'), [filteredOtherEntries]);

  const quotaEntries = useMemo(() => {
    const term = quotaSearch.trim().toLowerCase();
    return sortedEntries.filter((entry) => {
      if (!isFairQuotaPayment(entry.category)) {
        return false;
      }
      if (isSupplier && entry.supplierId !== session?.supplierId) {
        return false;
      }
      if (!term) {
        return true;
      }
      return [financialCategoryLabel(entry.category), entry.description, entry.supplierName ?? 'Lojinha'].join(' ').toLowerCase().includes(term);
    });
  }, [sortedEntries, quotaSearch, isSupplier, session?.supplierId]);

  const activeEntries = entryTab === 'expense' ? expenseEntries : entryTab === 'income' ? incomeEntries : quotaEntries;
  const pagedEntries = activeEntries.slice(entryPage * rowsPerPage, entryPage * rowsPerPage + rowsPerPage);

  const monthlyFlow = useMemo(() => {
    const months = Array.from({ length: 12 }, (_item, index) => ({
      label: new Date(kpiYear, index, 1).toLocaleDateString('pt-BR', { month: 'short' }),
      income: 0,
      expense: 0
    }));
    profileScopedEntries.forEach((entry) => {
      const date = new Date(entry.occurredOnUtc);
      if (date.getFullYear() !== kpiYear) {
        return;
      }
      const bucket = months[date.getMonth()];
      if (entry.type === 'Income') {
        bucket.income += entry.amount;
      } else {
        bucket.expense += entry.amount;
      }
    });
    return months;
  }, [profileScopedEntries, kpiYear]);

  const fairDebtRows = useMemo(() => {
    const rows: {
      fairId: string;
      fairName: string;
      supplierId: string;
      supplierName: string;
      quotaAmount: number;
      paidAmount: number;
      outstandingAmount: number;
      eventDateUtc: string;
      ageDays: number;
    }[] = [];

    const allFairEntries = entries.filter((entry) => entry.referenceId);

    fairs.forEach((fair) => {
      const suppliers = fair.suppliers ?? [];
      const defaultQuota = suppliers.length > 0 ? (fair.supplierRegistrationFee / suppliers.length) : 0;

      suppliers.forEach((supplier) => {
        const supplierEntries = allFairEntries.filter((entry) => entry.referenceId === fair.id && entry.supplierId === supplier.supplierId);
        const quotaAmount = supplierEntries
          .filter((entry) => entry.type === 'Expense' && isFairQuotaPayable(entry.category))
          .reduce((sum, entry) => sum + entry.amount, 0);
        const paidAmount = supplierEntries
          .filter((entry) => entry.type === 'Expense' && entry.category === FAIR_QUOTA_PAYMENT_CATEGORY)
          .reduce((sum, entry) => sum + entry.amount, 0);
        const normalizedQuota = quotaAmount > 0 ? quotaAmount : defaultQuota;
        const outstandingAmount = Math.max(0, normalizedQuota - paidAmount);

        rows.push({
          fairId: fair.id,
          fairName: fair.name,
          supplierId: supplier.supplierId,
          supplierName: supplier.supplierName,
          quotaAmount: normalizedQuota,
          paidAmount,
          outstandingAmount,
          eventDateUtc: fair.eventDateUtc,
          ageDays: daysSince(fair.eventDateUtc)
        });
      });
    });

    return rows.sort((left, right) => {
      if (left.outstandingAmount !== right.outstandingAmount) {
        return right.outstandingAmount - left.outstandingAmount;
      }
      return new Date(right.eventDateUtc).getTime() - new Date(left.eventDateUtc).getTime();
    });
  }, [entries, fairs]);

  const delinquencyRows = useMemo(() => fairDebtRows.filter((row) => row.outstandingAmount > 0), [fairDebtRows]);
  const delinquencyFairOptions = useMemo(
    () => Array.from(new Set(delinquencyRows.map((row) => row.fairName))).sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [delinquencyRows]
  );
  const filteredDelinquencyRows = useMemo(() => {
    const term = delinquencySearch.trim().toLowerCase();
    return delinquencyRows.filter((row) => {
      if (delinquencyFairFilter !== 'All' && row.fairName !== delinquencyFairFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      return [row.fairName, row.supplierName].join(' ').toLowerCase().includes(term);
    });
  }, [delinquencyFairFilter, delinquencyRows, delinquencySearch]);
  const pagedDelinquencyRows = filteredDelinquencyRows.slice(delinquencyPage * rowsPerPage, delinquencyPage * rowsPerPage + rowsPerPage);

  const supplierDebtRows = useMemo(() => fairDebtRows.filter((row) => row.supplierId === session?.supplierId), [fairDebtRows, session?.supplierId]);

  const quotaTotals = useMemo(() => {
    const total = fairDebtRows.reduce((sum, row) => sum + row.quotaAmount, 0);
    const paid = fairDebtRows.reduce((sum, row) => sum + row.paidAmount, 0);
    const outstanding = fairDebtRows.reduce((sum, row) => sum + row.outstandingAmount, 0);
    return { total, paid, outstanding, rate: total > 0 ? paid / total : 1 };
  }, [fairDebtRows]);

  const delinquencySummary = useMemo(() => {
    const suppliersWithDebt = new Set(delinquencyRows.map((row) => row.supplierId)).size;
    const suppliersTotal = new Set(fairDebtRows.map((row) => row.supplierId)).size;
    const fairsWithDebt = new Set(delinquencyRows.map((row) => row.fairId)).size;
    const fairsTotal = new Set(fairDebtRows.map((row) => row.fairId)).size;
    const oldest = delinquencyRows.reduce<{ ageDays: number; fairName: string; supplierName: string } | null>((best, row) => {
      return !best || row.ageDays > best.ageDays ? { ageDays: row.ageDays, fairName: row.fairName, supplierName: row.supplierName } : best;
    }, null);
    return { suppliersWithDebt, suppliersTotal, fairsWithDebt, fairsTotal, oldest };
  }, [delinquencyRows, fairDebtRows]);

  const agingBuckets = useMemo(() => {
    const buckets = [
      { label: '0 – 15 dias', min: 0, max: 15, amount: 0, color: '#79a95f' },
      { label: '16 – 30 dias', min: 16, max: 30, amount: 0, color: '#e1a657' },
      { label: '31 – 60 dias', min: 31, max: 60, amount: 0, color: '#d96b87' },
      { label: '60+ dias', min: 61, max: Infinity, amount: 0, color: '#c0566e' }
    ];
    delinquencyRows.forEach((row) => {
      const bucket = buckets.find((item) => row.ageDays >= item.min && row.ageDays <= item.max);
      if (bucket) {
        bucket.amount += row.outstandingAmount;
      }
    });
    return buckets;
  }, [delinquencyRows]);

  const supplierDebtGrouped = useMemo(() => {
    const map = new Map<string, { supplierId: string; supplierName: string; quota: number; paid: number; outstanding: number; pendingFairs: number; oldestAge: number }>();
    fairDebtRows.forEach((row) => {
      const group = map.get(row.supplierId) ?? { supplierId: row.supplierId, supplierName: row.supplierName, quota: 0, paid: 0, outstanding: 0, pendingFairs: 0, oldestAge: 0 };
      group.quota += row.quotaAmount;
      group.paid += row.paidAmount;
      group.outstanding += row.outstandingAmount;
      if (row.outstandingAmount > 0) {
        group.pendingFairs += 1;
        group.oldestAge = Math.max(group.oldestAge, row.ageDays);
      }
      map.set(row.supplierId, group);
    });
    return Array.from(map.values()).sort((left, right) => right.outstanding - left.outstanding);
  }, [fairDebtRows]);

  const supplierDebtSummary = useMemo(() => {
    const totalQuota = supplierDebtRows.reduce((sum, row) => sum + row.quotaAmount, 0);
    const totalPaid = supplierDebtRows.reduce((sum, row) => sum + row.paidAmount, 0);
    const totalOutstanding = supplierDebtRows.reduce((sum, row) => sum + row.outstandingAmount, 0);
    return { totalQuota, totalPaid, totalOutstanding };
  }, [supplierDebtRows]);

  const revenue = report?.revenue ?? 0;
  const expenses = report?.expenses ?? 0;
  const profit = report?.profit ?? 0;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  function handleExportCsv() {
    const header = 'Data;Tipo;Classificação;Categoria;Descrição;Escopo;Valor';
    const rows = filteredOtherEntries.map((entry) =>
      [
        new Date(entry.occurredOnUtc).toLocaleDateString('pt-BR'),
        financialTypeLabel(entry.type),
        financialClassificationLabel(entry.classification),
        financialCategoryLabel(entry.category),
        entry.description,
        entry.supplierName ?? 'Lojinha',
        entry.amount.toFixed(2).replace('.', ',')
      ].join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financeiro-${kpiYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const formatOccurredOn = (occurredOnUtc: string) => new Date(occurredOnUtc).toLocaleDateString('pt-BR');

  const kpiTiles = [
    { label: `Receitas ${kpiYear}`, value: formatCurrency(revenue) },
    { label: `Despesas ${kpiYear}`, value: formatCurrency(expenses) },
    { label: 'Resultado', value: formatCurrency(profit), note: `margem ${margin.toFixed(1)}%`, emphasis: true, negative: profit < 0 },
    isStoreAdmin
      ? { label: 'Cotas de feira a receber', value: formatCurrency(quotaTotals.outstanding), note: `${delinquencySummary.suppliersWithDebt} fornecedor(es) em aberto` }
      : { label: 'Lançamentos filtrados', value: String(filteredOtherEntries.length) }
  ];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h3">{isSupplier || isReseller ? 'Meu financeiro' : 'Financeiro'}</Typography>
          <Typography color="text.secondary">
            {isSupplier || isReseller ? 'Receitas, lançamentos próprios e resultado líquido das suas vendas.' : 'Resultado, fluxo mensal e controle de cotas de feira em uma tela.'}
          </Typography>
        </div>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={handleExportCsv}>Exportar CSV</Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/financeiro/novo')}>Novo lançamento</Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} alignItems="stretch">
        {kpiTiles.map((tile) => (
          <Grid item xs={6} md={3} key={tile.label}>
            <Paper sx={{ p: 2, height: '100%', ...(tile.emphasis ? { border: '1.5px solid', borderColor: 'primary.main' } : {}) }}>
              <Typography color="text.secondary" fontSize={13} fontWeight={700}>{tile.label}</Typography>
              <Typography variant="h5" color={tile.negative ? 'error.main' : (tile.emphasis ? 'primary.dark' : undefined)}>{tile.value}</Typography>
              {tile.note ? <Typography color="text.secondary" fontSize={12}>{tile.note}</Typography> : null}
            </Paper>
          </Grid>
        ))}
        <Grid item xs={12} md={3}>
          <TextField select label="Ano dos indicadores" value={kpiYear} onChange={(event) => setKpiYear(Number(event.target.value))} fullWidth size="small">
            {availableYears.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
          </TextField>
        </Grid>
      </Grid>

      {isStoreAdmin ? (
        <PageSection
          title="Cotas de feira — fornecedores em aberto"
          subtitle="Quanto os fornecedores ainda devem das cotas de participação nas feiras."
        >
          <Stack spacing={2.5}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' } }}>
              <Paper variant="outlined" sx={{ p: 1.5, borderColor: quotaTotals.outstanding > 0 ? 'primary.main' : undefined }}>
                <Typography variant="caption" fontWeight={800} color="text.secondary">Total em aberto</Typography>
                <Typography variant="h6" color={quotaTotals.outstanding > 0 ? 'primary.dark' : undefined}>{formatCurrency(quotaTotals.outstanding)}</Typography>
                <Typography variant="caption" color="text.secondary">de {formatCurrency(quotaTotals.total)} em cotas</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" fontWeight={800} color="text.secondary">Fornecedores devendo</Typography>
                <Typography variant="h6">{delinquencySummary.suppliersWithDebt} / {delinquencySummary.suppliersTotal}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" fontWeight={800} color="text.secondary">Feiras com pendência</Typography>
                <Typography variant="h6">{delinquencySummary.fairsWithDebt} / {delinquencySummary.fairsTotal}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" fontWeight={800} color="text.secondary">Taxa de quitação</Typography>
                <Typography variant="h6">{Math.round(quotaTotals.rate * 100)}%</Typography>
                <Typography variant="caption" color="text.secondary">{formatCurrency(quotaTotals.paid)} pagos</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5, borderColor: delinquencySummary.oldest ? 'primary.main' : undefined }}>
                <Typography variant="caption" fontWeight={800} color="text.secondary">Pendência mais antiga</Typography>
                <Typography variant="h6" color={delinquencySummary.oldest ? 'primary.dark' : undefined}>{delinquencySummary.oldest ? `${delinquencySummary.oldest.ageDays} dias` : '—'}</Typography>
                <Typography variant="caption" color="text.secondary">{delinquencySummary.oldest ? `${delinquencySummary.oldest.fairName} · ${delinquencySummary.oldest.supplierName}` : 'Sem pendências'}</Typography>
              </Paper>
            </Box>

            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
              {agingBuckets.map((bucket) => (
                <Paper key={bucket.label} variant="outlined" sx={{ p: 1.25, textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">{bucket.label}</Typography>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: bucket.amount > 0 ? bucket.color : 'text.primary' }}>{formatCurrency(bucket.amount)}</Typography>
                </Paper>
              ))}
            </Box>

            <Tabs value={quotaView} onChange={(_event, value) => setQuotaView(value)} sx={{ minHeight: 40 }}>
              <Tab value="lancamentos" label="Por feira" sx={{ minHeight: 40 }} />
              <Tab value="fornecedores" label="Por fornecedor" sx={{ minHeight: 40 }} />
            </Tabs>

            {quotaView === 'lancamentos' ? (
              <Stack spacing={2}>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={7}>
                    <TextField fullWidth size="small" label="Buscar" value={delinquencySearch} onChange={(event) => { setDelinquencySearch(event.target.value); setDelinquencyPage(0); }} placeholder="Feira ou fornecedor" />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField fullWidth select size="small" label="Feira" value={delinquencyFairFilter} onChange={(event) => { setDelinquencyFairFilter(event.target.value); setDelinquencyPage(0); }}>
                      <MenuItem value="All">Todas</MenuItem>
                      {delinquencyFairOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>
                <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                  <Table size="small" sx={{ minWidth: 820 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Fornecedor</TableCell>
                        <TableCell>Feira</TableCell>
                        <TableCell align="right">Cota devida</TableCell>
                        <TableCell align="right">Pago</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>Quitação</TableCell>
                        <TableCell align="right">Em aberto</TableCell>
                        <TableCell align="right">Há</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedDelinquencyRows.map((row, index) => (
                        <TableRow key={`${row.fairId}-${row.supplierId}-${index}`}>
                          <TableCell sx={{ fontWeight: 700 }}>{row.supplierName}</TableCell>
                          <TableCell>{row.fairName}</TableCell>
                          <TableCell align="right">{formatCurrency(row.quotaAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.paidAmount)}</TableCell>
                          <TableCell>
                            <LinearProgress variant="determinate" value={row.quotaAmount > 0 ? Math.min(100, (row.paidAmount / row.quotaAmount) * 100) : 0} sx={{ height: 8, borderRadius: 999 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>{formatCurrency(row.outstandingAmount)}</TableCell>
                          <TableCell align="right">
                            <Chip size="small" label={`${row.ageDays}d`} color={row.ageDays > 30 ? 'warning' : 'default'} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredDelinquencyRows.length === 0 ? (
                        <TableRow><TableCell colSpan={7}><Typography color="text.secondary">Sem pendências de cota no momento.</Typography></TableCell></TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </Paper>
                <TablePagination component="div" count={filteredDelinquencyRows.length} page={delinquencyPage} onPageChange={(_event, value) => setDelinquencyPage(value)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                {supplierDebtGrouped.length === 0 ? <Typography color="text.secondary">Nenhum fornecedor vinculado a feiras.</Typography> : null}
                {supplierDebtGrouped.map((group) => (
                  <Paper key={group.supplierId} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography fontWeight={700}>{group.supplierName}</Typography>
                          {group.outstanding > 0
                            ? <Chip size="small" color="warning" label={`pendência há ${group.oldestAge} dias`} />
                            : <Chip size="small" color="success" label="em dia" />}
                        </Stack>
                        <Stack direction="row" spacing={2.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
                          <Box><Typography variant="caption" color="text.secondary" fontWeight={700}>Cota total</Typography><Typography fontWeight={700}>{formatCurrency(group.quota)}</Typography></Box>
                          <Box><Typography variant="caption" color="text.secondary" fontWeight={700}>Pago</Typography><Typography fontWeight={700}>{formatCurrency(group.paid)}</Typography></Box>
                          <Box><Typography variant="caption" color="text.secondary" fontWeight={700}>Em aberto</Typography><Typography fontWeight={700} color={group.outstanding > 0 ? 'error.main' : undefined}>{formatCurrency(group.outstanding)}</Typography></Box>
                          <Box><Typography variant="caption" color="text.secondary" fontWeight={700}>Feiras pendentes</Typography><Typography fontWeight={700}>{group.pendingFairs}</Typography></Box>
                        </Stack>
                        <LinearProgress variant="determinate" value={group.quota > 0 ? Math.min(100, (group.paid / group.quota) * 100) : 100} sx={{ height: 10, borderRadius: 999, mt: 1.25 }} color={group.outstanding > 0 ? 'warning' : 'success'} />
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </PageSection>
      ) : isSupplier ? (
        <PageSection title="Seu saldo devedor de cotas" subtitle="Acompanhe o que já foi pago e o que ainda está pendente por feira.">
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Cota total</Typography><Typography variant="h5">{formatCurrency(supplierDebtSummary.totalQuota)}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Total pago</Typography><Typography variant="h5">{formatCurrency(supplierDebtSummary.totalPaid)}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2, border: supplierDebtSummary.totalOutstanding > 0 ? '1.5px solid' : undefined, borderColor: 'primary.main' }}><Typography color="text.secondary">Em aberto</Typography><Typography variant="h5" color={supplierDebtSummary.totalOutstanding > 0 ? 'primary.dark' : undefined}>{formatCurrency(supplierDebtSummary.totalOutstanding)}</Typography></Paper></Grid>
            </Grid>
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Feira</TableCell>
                    <TableCell align="right">Cota devida</TableCell>
                    <TableCell align="right">Pago</TableCell>
                    <TableCell align="right">Em aberto</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {supplierDebtRows.map((row, index) => (
                    <TableRow key={`${row.fairId}-${index}`}>
                      <TableCell>{row.fairName}</TableCell>
                      <TableCell align="right">{formatCurrency(row.quotaAmount)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.paidAmount)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: row.outstandingAmount > 0 ? 700 : 400, color: row.outstandingAmount > 0 ? 'error.main' : undefined }}>{formatCurrency(row.outstandingAmount)}</TableCell>
                      <TableCell><Chip size="small" label={row.outstandingAmount > 0 ? 'Pendente' : 'Quitado'} color={row.outstandingAmount > 0 ? 'warning' : 'success'} /></TableCell>
                    </TableRow>
                  ))}
                  {supplierDebtRows.length === 0 ? <TableRow><TableCell colSpan={5}><Typography color="text.secondary">Nenhuma cota vinculada encontrada.</Typography></TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        </PageSection>
      ) : null}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <PageSection title="Fluxo mensal" subtitle={`Receitas e despesas de cada mês de ${kpiYear}.`}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="income" name="Receitas" fill="#7bcfc0" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" name="Despesas" fill="#d96b87" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </PageSection>
        </Grid>
        <Grid item xs={12} lg={5}>
          <PageSection title="Resultado por categoria" subtitle="Saldo (receita − despesa) por agrupamento.">
            {categoryBreakdown.length === 0 ? <Typography color="text.secondary">Sem dados no período.</Typography> : (
              <Stack spacing={1.25}>
                {categoryBreakdown.map((item) => {
                  const max = Math.max(...categoryBreakdown.map((row) => Math.abs(row.amount)), 1);
                  const positive = item.amount >= 0;
                  return (
                    <Stack key={item.category} spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography fontSize={12.5} sx={{ minWidth: 0 }} noWrap>{item.categoryLabel}</Typography>
                        <Typography fontSize={12.5} fontWeight={700} color={positive ? 'success.main' : 'error.main'}>{positive ? '+' : '−'}{formatCurrency(Math.abs(item.amount))}</Typography>
                      </Stack>
                      <Box sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(217,107,135,0.10)' }}>
                        <Box sx={{ height: '100%', borderRadius: 999, bgcolor: positive ? 'secondary.main' : 'primary.main', width: `${Math.round((Math.abs(item.amount) / max) * 100)}%` }} />
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </PageSection>
        </Grid>
      </Grid>

      <PageSection title="Lançamentos" subtitle="Despesas, receitas e pagamentos de cota em abas separadas.">
        <Stack spacing={2}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <TextField fullWidth size="small" label="Buscar lançamento" value={search} onChange={(event) => { setSearch(event.target.value); setEntryPage(0); }} placeholder="Categoria, descrição ou tipo" />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField fullWidth select size="small" label="Classificação" value={classificationFilter} onChange={(event) => { setClassificationFilter(event.target.value as 'All' | 'Fixed' | 'Variable'); setEntryPage(0); }}>
                <MenuItem value="All">Todas</MenuItem>
                <MenuItem value="Fixed">Fixa</MenuItem>
                <MenuItem value="Variable">Variável</MenuItem>
              </TextField>
            </Grid>
            {isStoreAdmin ? (
              <Grid item xs={6} md={2}>
                <TextField fullWidth select size="small" label="Escopo" value={scopeFilter} onChange={(event) => { setScopeFilter(event.target.value as 'All' | 'Store' | 'Supplier'); setEntryPage(0); }}>
                  <MenuItem value="All">Todos</MenuItem>
                  <MenuItem value="Store">Lojinha</MenuItem>
                  <MenuItem value="Supplier">Fornecedor</MenuItem>
                </TextField>
              </Grid>
            ) : null}
            <Grid item xs={12} md={isStoreAdmin ? 4 : 6}>
              <TextField fullWidth select size="small" label="Categoria" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setEntryPage(0); }}>
                <MenuItem value="All">Todas</MenuItem>
                {categoryOptions.map((option) => <MenuItem key={option} value={option}>{financialCategoryLabel(option)}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>

          <Tabs value={entryTab} onChange={(_event, value) => { setEntryTab(value); setEntryPage(0); }} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab value="expense" label={`Despesas (${expenseEntries.length})`} />
            <Tab value="income" label={`Receitas (${incomeEntries.length})`} />
            {!isReseller ? <Tab value="quota" label={`Cotas pagas (${quotaEntries.length})`} /> : null}
          </Tabs>

          {entryTab === 'quota' ? (
            <TextField size="small" label="Buscar pagamento de cota" value={quotaSearch} onChange={(event) => { setQuotaSearch(event.target.value); setEntryPage(0); }} placeholder="Fornecedor ou descrição" sx={{ maxWidth: 360 }} />
          ) : null}

          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Data</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Descrição</TableCell>
                  <TableCell>Classe</TableCell>
                  <TableCell>{entryTab === 'quota' ? 'Fornecedor' : 'Escopo'}</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedEntries.map((entry) => (
                  <TableRow key={entry.id} sx={{ backgroundColor: entry.type === 'Income' ? 'rgba(123, 207, 192, 0.12)' : 'rgba(217, 107, 135, 0.08)' }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatOccurredOn(entry.occurredOnUtc)}</TableCell>
                    <TableCell>{financialCategoryLabel(entry.category)}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>{financialClassificationLabel(entry.classification)}</TableCell>
                    <TableCell>{entry.supplierName ?? 'Lojinha'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap', color: entry.type === 'Income' ? 'success.main' : 'error.main' }}>{formatCurrency(entry.amount)}</TableCell>
                  </TableRow>
                ))}
                {pagedEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><Typography color="text.secondary">Nenhum lançamento encontrado com os filtros atuais.</Typography></TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>
          <TablePagination component="div" count={activeEntries.length} page={entryPage} onPageChange={(_event, value) => setEntryPage(value)} rowsPerPage={rowsPerPage} rowsPerPageOptions={[rowsPerPage]} />
        </Stack>
      </PageSection>
    </Stack>
  );
}
