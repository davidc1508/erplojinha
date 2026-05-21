import { useQuery } from '@tanstack/react-query';
import { Button, Grid, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMemo, useState } from 'react';
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

export function FinancePage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const isReseller = session?.role === 'Reseller';
  const rowsPerPage = 8;
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [kpiYear, setKpiYear] = useState(currentYear);
  const { data: entries = [] } = useQuery({ queryKey: ['finance-entries'], queryFn: financeApi.getEntries });
  const { data: report } = useQuery({ queryKey: ['finance-report', kpiYear], queryFn: () => financeApi.getReport(kpiYear) });
  const { data: fairs = [] } = useQuery({ queryKey: ['fairs'], queryFn: fairsApi.getAll });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [classificationFilter, setClassificationFilter] = useState<'All' | 'Fixed' | 'Variable'>('All');
  const [scopeFilter, setScopeFilter] = useState<'All' | 'Store' | 'Supplier'>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [quotaSearch, setQuotaSearch] = useState('');
  const [quotaScopeFilter, setQuotaScopeFilter] = useState<'All' | 'Supplier'>('All');
  const [delinquencySearch, setDelinquencySearch] = useState('');
  const [delinquencyFairFilter, setDelinquencyFairFilter] = useState('All');
  const [delinquencyPage, setDelinquencyPage] = useState(0);
  const [quotaPage, setQuotaPage] = useState(0);
  const [incomePage, setIncomePage] = useState(0);
  const [expensePage, setExpensePage] = useState(0);
  const categoryBreakdown = useMemo(
    () => (report?.categories ?? []).map((item) => ({ ...item, categoryLabel: financialCategoryLabel(item.category) })),
    [report?.categories]
  );

  const sortedEntries = useMemo(() => {
    return [...entries].sort((left, right) => {
      const leftPriority = left.category === FAIR_QUOTA_PAYMENT_CATEGORY ? 0 : 1;
      const rightPriority = right.category === FAIR_QUOTA_PAYMENT_CATEGORY ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftDate = new Date(left.occurredOnUtc).getTime();
      const rightDate = new Date(right.occurredOnUtc).getTime();
      return rightDate - leftDate;
    });
  }, [entries]);

  const profileScopedEntries = useMemo(() => {
    if (isSupplier) {
      return sortedEntries.filter((entry) => entry.supplierId === session?.supplierId);
    }

    return sortedEntries.filter((entry) => !entry.supplierId);
  }, [isSupplier, session?.supplierId, sortedEntries]);

  const categoryOptions = useMemo(() => {
    return ['All', ...Array.from(new Set(profileScopedEntries.filter((entry) => !isFairQuotaPayment(entry.category)).map((entry) => entry.category))).sort((left, right) => financialCategoryLabel(left).localeCompare(financialCategoryLabel(right)))];
  }, [profileScopedEntries]);

  const otherEntries = useMemo(() => profileScopedEntries.filter((entry) => !isFairQuotaPayment(entry.category)), [profileScopedEntries]);

  const filteredOtherEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return otherEntries.filter((entry) => {
      if (typeFilter !== 'All' && entry.type !== typeFilter) {
        return false;
      }

      if (classificationFilter !== 'All' && entry.classification !== classificationFilter) {
        return false;
      }

      if (!isSupplier && !isReseller) {
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
  }, [categoryFilter, classificationFilter, isReseller, isSupplier, otherEntries, scopeFilter, search, typeFilter]);

  const quotaEntries = useMemo(() => {
    const term = quotaSearch.trim().toLowerCase();
    return sortedEntries.filter((entry) => {
      if (!isFairQuotaPayment(entry.category)) {
        return false;
      }

      if (quotaScopeFilter === 'Supplier' && !entry.supplierId) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [
        financialCategoryLabel(entry.category),
        entry.category,
        entry.description,
        entry.supplierName ?? 'Lojinha'
      ].join(' ').toLowerCase().includes(term);
    });
  }, [sortedEntries, quotaSearch, quotaScopeFilter]);

  const pagedQuotaEntries = quotaEntries.slice(quotaPage * rowsPerPage, quotaPage * rowsPerPage + rowsPerPage);
  const incomeOtherEntries = useMemo(
    () => filteredOtherEntries.filter((entry) => entry.type === 'Income'),
    [filteredOtherEntries]
  );
  const expenseOtherEntries = useMemo(
    () => filteredOtherEntries.filter((entry) => entry.type === 'Expense'),
    [filteredOtherEntries]
  );
  const pagedIncomeEntries = incomeOtherEntries.slice(incomePage * rowsPerPage, incomePage * rowsPerPage + rowsPerPage);
  const pagedExpenseEntries = expenseOtherEntries.slice(expensePage * rowsPerPage, expensePage * rowsPerPage + rowsPerPage);

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
          eventDateUtc: fair.eventDateUtc
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
    () => ['All', ...Array.from(new Set(delinquencyRows.map((row) => row.fairName))).sort((left, right) => left.localeCompare(right, 'pt-BR'))],
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

  const delinquencySummary = useMemo(() => {
    const totalOutstanding = delinquencyRows.reduce((sum, row) => sum + row.outstandingAmount, 0);
    const suppliersWithDebt = new Set(delinquencyRows.map((row) => row.supplierId)).size;
    const fairsWithDebt = new Set(delinquencyRows.map((row) => row.fairId)).size;
    return { totalOutstanding, suppliersWithDebt, fairsWithDebt };
  }, [delinquencyRows]);

  const supplierDebtSummary = useMemo(() => {
    const totalQuota = supplierDebtRows.reduce((sum, row) => sum + row.quotaAmount, 0);
    const totalPaid = supplierDebtRows.reduce((sum, row) => sum + row.paidAmount, 0);
    const totalOutstanding = supplierDebtRows.reduce((sum, row) => sum + row.outstandingAmount, 0);
    return { totalQuota, totalPaid, totalOutstanding };
  }, [supplierDebtRows]);

  const handleFilterChange = (callback: () => void) => {
    callback();
    setIncomePage(0);
    setExpensePage(0);
  };

  const handleQuotaFilterChange = (callback: () => void) => {
    callback();
    setQuotaPage(0);
  };

  const handleDelinquencyFilterChange = (callback: () => void) => {
    callback();
    setDelinquencyPage(0);
  };

  const formatOccurredOn = (occurredOnUtc: string) => new Date(occurredOnUtc).toLocaleString('pt-BR');

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
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financeiro-${kpiYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h3">{isSupplier || isReseller ? 'Meu financeiro' : 'Financeiro'}</Typography>
          <Typography color="text.secondary">{isSupplier || isReseller ? 'Receitas, lançamentos próprios e resultado líquido das suas vendas.' : 'Histórico e indicadores em uma tela, com separação entre lojinha e fornecedores.'}</Typography>
        </div>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={handleExportCsv}>
            Exportar CSV
          </Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/financeiro/novo')}>
            Novo lançamento
          </Button>
        </Stack>
      </Stack>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Receitas</Typography><Typography variant="h5">{formatCurrency(report?.revenue ?? 0)}</Typography></Paper></Grid>
        <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Despesas</Typography><Typography variant="h5">{formatCurrency(report?.expenses ?? 0)}</Typography></Paper></Grid>
        <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Lucro / prejuízo</Typography><Typography variant="h5">{formatCurrency(report?.profit ?? 0)}</Typography></Paper></Grid>
        <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Lançamentos filtrados</Typography><Typography variant="h5">{filteredOtherEntries.length}</Typography></Paper></Grid>
        <Grid item xs={12} md={3}>
          <TextField
            select
            label="Ano dos KPIs"
            value={kpiYear}
            onChange={(event) => setKpiYear(Number(event.target.value))}
            fullWidth
          >
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((year) => (
              <MenuItem key={year} value={year}>{year}</MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      {!isSupplier && !isReseller ? (
        <PageSection title="Painel de inadimplência" subtitle="Controle de cotas de feira em aberto por fornecedor.">
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Total em aberto</Typography><Typography variant="h5">{formatCurrency(delinquencySummary.totalOutstanding)}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Fornecedores com pendência</Typography><Typography variant="h5">{delinquencySummary.suppliersWithDebt}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Feiras com pendência</Typography><Typography variant="h5">{delinquencySummary.fairsWithDebt}</Typography></Paper></Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={12} md={7}>
                <TextField
                  fullWidth
                  label="Buscar inadimplência"
                  value={delinquencySearch}
                  onChange={(event) => handleDelinquencyFilterChange(() => setDelinquencySearch(event.target.value))}
                  placeholder="Feira ou fornecedor"
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  select
                  label="Feira"
                  value={delinquencyFairFilter}
                  onChange={(event) => handleDelinquencyFilterChange(() => setDelinquencyFairFilter(event.target.value))}
                >
                  {delinquencyFairOptions.map((option) => (
                    <MenuItem key={option} value={option}>{option === 'All' ? 'Todas' : option}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Feira</TableCell>
                  <TableCell>Fornecedor</TableCell>
                  <TableCell>Cota devida</TableCell>
                  <TableCell>Pago</TableCell>
                  <TableCell>Em aberto</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedDelinquencyRows.map((row, index) => (
                  <TableRow key={`${row.fairId}-${row.supplierId}-${index}`} sx={{ backgroundColor: 'rgba(217, 107, 135, 0.12)' }}>
                    <TableCell>{row.fairName}</TableCell>
                    <TableCell>{row.supplierName}</TableCell>
                    <TableCell>{formatCurrency(row.quotaAmount)}</TableCell>
                    <TableCell>{formatCurrency(row.paidAmount)}</TableCell>
                    <TableCell>{formatCurrency(row.outstandingAmount)}</TableCell>
                  </TableRow>
                ))}
                {filteredDelinquencyRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}><Typography color="text.secondary">Sem pendências de cota no momento.</Typography></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredDelinquencyRows.length}
              page={delinquencyPage}
              onPageChange={(_, value) => setDelinquencyPage(value)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[rowsPerPage]}
            />
          </Stack>
        </PageSection>
      ) : (
        <PageSection title="Seu saldo devedor de cotas" subtitle="Acompanhe o que já foi pago e o que ainda está pendente por feira.">
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Cota total</Typography><Typography variant="h5">{formatCurrency(supplierDebtSummary.totalQuota)}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Total pago</Typography><Typography variant="h5">{formatCurrency(supplierDebtSummary.totalPaid)}</Typography></Paper></Grid>
              <Grid item xs={12} md={4}><Paper sx={{ p: 2, backgroundColor: supplierDebtSummary.totalOutstanding > 0 ? 'rgba(217, 107, 135, 0.12)' : 'rgba(123, 207, 192, 0.12)' }}><Typography color="text.secondary">Em aberto</Typography><Typography variant="h5">{formatCurrency(supplierDebtSummary.totalOutstanding)}</Typography></Paper></Grid>
            </Grid>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Feira</TableCell>
                  <TableCell>Cota devida</TableCell>
                  <TableCell>Pago</TableCell>
                  <TableCell>Em aberto</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {supplierDebtRows.map((row, index) => (
                  <TableRow key={`${row.fairId}-${index}`} sx={{ backgroundColor: row.outstandingAmount > 0 ? 'rgba(217, 107, 135, 0.12)' : 'rgba(123, 207, 192, 0.12)' }}>
                    <TableCell>{row.fairName}</TableCell>
                    <TableCell>{formatCurrency(row.quotaAmount)}</TableCell>
                    <TableCell>{formatCurrency(row.paidAmount)}</TableCell>
                    <TableCell>{formatCurrency(row.outstandingAmount)}</TableCell>
                    <TableCell>{row.outstandingAmount > 0 ? 'Pendente' : 'Quitado'}</TableCell>
                  </TableRow>
                ))}
                {supplierDebtRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}><Typography color="text.secondary">Nenhuma cota vinculada encontrada.</Typography></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Stack>
        </PageSection>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <PageSection title="Fluxo mensal" subtitle="Receitas por mês para leitura rápida do ritmo financeiro.">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={report?.monthlySeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" fill="#7bcfc0" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </PageSection>
        </Grid>
        <Grid item xs={12} lg={6}>
          <PageSection title="Resultado por categoria" subtitle="Saldo por agrupamento financeiro.">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121, 99, 88, 0.15)" />
                <XAxis dataKey="categoryLabel" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="amount" fill="#d96b87" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </PageSection>
        </Grid>
        <Grid item xs={12}>
          <PageSection title="Filtros de lançamentos" subtitle="Refine os resultados antes de analisar as tabelas.">
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Buscar lançamento"
                    value={search}
                    onChange={(event) => handleFilterChange(() => setSearch(event.target.value))}
                    placeholder="Categoria, descrição, tipo ou classificação"
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth select label="Tipo" value={typeFilter} onChange={(event) => handleFilterChange(() => setTypeFilter(event.target.value as 'All' | 'Income' | 'Expense'))}>
                    <MenuItem value="All">Todos</MenuItem>
                    <MenuItem value="Income">Receita</MenuItem>
                    <MenuItem value="Expense">Despesa</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth select label="Classificação" value={classificationFilter} onChange={(event) => handleFilterChange(() => setClassificationFilter(event.target.value as 'All' | 'Fixed' | 'Variable'))}>
                    <MenuItem value="All">Todas</MenuItem>
                    <MenuItem value="Fixed">Fixa</MenuItem>
                    <MenuItem value="Variable">Variável</MenuItem>
                  </TextField>
                </Grid>
                {!isSupplier && !isReseller ? (
                  <Grid item xs={12} md={2}>
                    <TextField fullWidth select label="Escopo" value={scopeFilter} onChange={(event) => handleFilterChange(() => setScopeFilter(event.target.value as 'All' | 'Store' | 'Supplier'))}>
                      <MenuItem value="All">Todos</MenuItem>
                      <MenuItem value="Store">Lojinha</MenuItem>
                      <MenuItem value="Supplier">Fornecedor</MenuItem>
                    </TextField>
                  </Grid>
                ) : null}
                <Grid item xs={12} md={isSupplier || isReseller ? 4 : 2}>
                  <TextField fullWidth select label="Categoria" value={categoryFilter} onChange={(event) => handleFilterChange(() => setCategoryFilter(event.target.value))}>
                    <MenuItem value="All">Todas</MenuItem>
                    {categoryOptions.filter((option) => option !== 'All').map((option) => (
                      <MenuItem key={option} value={option}>{financialCategoryLabel(option)}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Stack>
          </PageSection>
        </Grid>

        <Grid item xs={12}>
          <PageSection title="Receitas" subtitle="Entradas financeiras fora do fluxo de cota da feira.">
            <Stack spacing={2}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Classificação</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell>Descrição</TableCell>
                    <TableCell>Escopo</TableCell>
                    <TableCell>Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedIncomeEntries.map((entry) => (
                    <TableRow key={entry.id} sx={{ backgroundColor: 'rgba(123, 207, 192, 0.14)' }}>
                      <TableCell>{formatOccurredOn(entry.occurredOnUtc)}</TableCell>
                      <TableCell>{financialTypeLabel(entry.type)}</TableCell>
                      <TableCell>{financialClassificationLabel(entry.classification)}</TableCell>
                      <TableCell>{financialCategoryLabel(entry.category)}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{entry.supplierName ?? 'Lojinha'}</TableCell>
                      <TableCell>{formatCurrency(entry.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {pagedIncomeEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography color="text.secondary">Nenhuma receita encontrada com os filtros atuais.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={incomeOtherEntries.length}
                page={incomePage}
                onPageChange={(_, value) => setIncomePage(value)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[rowsPerPage]}
              />
            </Stack>
          </PageSection>
        </Grid>

        <Grid item xs={12}>
          <PageSection title="Despesas" subtitle="Saídas financeiras fora do fluxo de cota da feira.">
            <Stack spacing={2}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Classificação</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell>Descrição</TableCell>
                    <TableCell>Escopo</TableCell>
                    <TableCell>Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedExpenseEntries.map((entry) => (
                    <TableRow key={entry.id} sx={{ backgroundColor: 'rgba(217, 107, 135, 0.12)' }}>
                      <TableCell>{formatOccurredOn(entry.occurredOnUtc)}</TableCell>
                      <TableCell>{financialTypeLabel(entry.type)}</TableCell>
                      <TableCell>{financialClassificationLabel(entry.classification)}</TableCell>
                      <TableCell>{financialCategoryLabel(entry.category)}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{entry.supplierName ?? 'Lojinha'}</TableCell>
                      <TableCell>{formatCurrency(entry.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {pagedExpenseEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography color="text.secondary">Nenhuma despesa encontrada com os filtros atuais.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={expenseOtherEntries.length}
                page={expensePage}
                onPageChange={(_, value) => setExpensePage(value)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[rowsPerPage]}
              />
            </Stack>
          </PageSection>
        </Grid>

        <Grid item xs={12}>
          <PageSection title="Pagamentos de cota de feira" subtitle="Lista dedicada de cotas pagas por fornecedores, separada dos demais lançamentos.">
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Buscar pagamento de cota"
                    value={quotaSearch}
                    onChange={(event) => handleQuotaFilterChange(() => setQuotaSearch(event.target.value))}
                    placeholder="Fornecedor, descrição ou categoria"
                  />
                </Grid>
                {!isSupplier && !isReseller ? (
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      select
                      label="Escopo"
                      value={quotaScopeFilter}
                      onChange={(event) => handleQuotaFilterChange(() => setQuotaScopeFilter(event.target.value as 'All' | 'Supplier'))}
                    >
                      <MenuItem value="All">Todos</MenuItem>
                      <MenuItem value="Supplier">Somente fornecedor</MenuItem>
                    </TextField>
                  </Grid>
                ) : null}
              </Grid>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Classificação</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell>Descrição</TableCell>
                    {!isSupplier && !isReseller ? <TableCell>Fornecedor</TableCell> : null}
                    <TableCell>Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedQuotaEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatOccurredOn(entry.occurredOnUtc)}</TableCell>
                      <TableCell>{financialTypeLabel(entry.type)}</TableCell>
                      <TableCell>{financialClassificationLabel(entry.classification)}</TableCell>
                      <TableCell>{financialCategoryLabel(entry.category)}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      {!isSupplier && !isReseller ? <TableCell>{entry.supplierName ?? 'Não informado'}</TableCell> : null}
                      <TableCell>{formatCurrency(entry.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {pagedQuotaEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isSupplier || isReseller ? 6 : 7}>
                        <Typography color="text.secondary">Nenhum pagamento de cota encontrado.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={quotaEntries.length}
                page={quotaPage}
                onPageChange={(_, value) => setQuotaPage(value)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[rowsPerPage]}
              />
            </Stack>
          </PageSection>
        </Grid>
      </Grid>
    </Stack>
  );
}