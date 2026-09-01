import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, Tabs, TextField, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import { useMemo, useState } from 'react';
import { CurrencyField } from '../components/CurrencyField';
import { ProductLookupField } from '../components/ProductLookupField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { categoriesApi, inventoryApi, productsApi } from '../services/api';
import { formatUtcDate } from '../services/date';
import { inventoryMovementTypeLabel } from '../services/labels';
import type { InventoryMovement } from '../services/types';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function KpiCard({ label, value, caption, alert }: { label: string; value: string; caption?: string; alert?: boolean }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderColor: alert ? 'rgba(217,107,135,0.4)' : 'rgba(217,107,135,0.16)', backgroundColor: 'rgba(255,255,255,0.6)' }}
    >
      <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'block' }}>{label}</Typography>
      <Typography sx={{ fontFamily: '"Baloo 2", "Nunito", sans-serif', fontWeight: 700, fontSize: '1.3rem', color: alert ? '#c0566e' : 'inherit' }}>{value}</Typography>
      {caption ? <Typography color="text.secondary" fontSize={11.5}>{caption}</Typography> : null}
    </Paper>
  );
}

export function InventoryPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const supplierId = session?.supplierId ?? '';
  const movementRowsPerPage = 8;
  const queryClient = useQueryClient();
  const { data: movements = [] } = useQuery({ queryKey: ['inventory'], queryFn: inventoryApi.getMovements });
  const { data: products = [] } = useQuery({ queryKey: ['products', 'inventory-options'], queryFn: () => productsApi.getAll({ isBudget: false }) });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });
  const { data: metadata } = useQuery({ queryKey: ['products-metadata'], queryFn: productsApi.getMetadata, enabled: !isSupplier });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventoryMovement | null>(null);
  const [reverseTarget, setReverseTarget] = useState<InventoryMovement | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState('all');
  const [analysisSearch, setAnalysisSearch] = useState('');
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState('all');
  const [entryPage, setEntryPage] = useState(0);
  const [exitPage, setExitPage] = useState(0);
  const [stockPage, setStockPage] = useState(0);
  const [analysisPage, setAnalysisPage] = useState(0);
  const [stockRowsPerPage, setStockRowsPerPage] = useState(8);
  const [analysisRowsPerPage, setAnalysisRowsPerPage] = useState(8);
  const [form, setForm] = useState({ itemType: 'Product', itemId: '', type: 'Entry', quantity: 1, unitCost: 0, notes: '' });

  const managedProducts = useMemo(
    () => isSupplier ? products.filter((p) => p.supplierId === supplierId) : products,
    [isSupplier, products, supplierId]
  );

  const selectedMovementProduct = useMemo(
    () => managedProducts.find((product) => product.id === form.itemId) ?? null,
    [managedProducts, form.itemId]
  );

  const scopedProducts = useMemo(
    () => managedProducts.filter((p) =>
      scopeFilter === 'all' ? true
        : scopeFilter === 'store' ? !p.supplierId
          : p.supplierId === scopeFilter),
    [managedProducts, scopeFilter]
  );

  // KPIs reais de estoque
  const kpiInStock = useMemo(() => scopedProducts.filter((p) => p.currentStock > 0).length, [scopedProducts]);
  const kpiStockValue = useMemo(
    () => scopedProducts.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0),
    [scopedProducts]
  );
  const kpiOutOfStock = useMemo(
    () => managedProducts.filter((p) => p.currentStock === 0).length,
    [managedProducts]
  );

  const productMovements = useMemo(() => movements.filter((m) => m.itemType === 'Product'), [movements]);

  const stockAnalytics = useMemo(() => {
    const now = new Date();
    const lastMovementByProduct = new Map<string, string>();
    const soldInLast30ByProduct = new Map<string, number>();

    productMovements.forEach((movement) => {
      const currentLast = lastMovementByProduct.get(movement.itemId);
      if (!currentLast || new Date(movement.occurredAtUtc).getTime() > new Date(currentLast).getTime()) {
        lastMovementByProduct.set(movement.itemId, movement.occurredAtUtc);
      }

      if (movement.type === 'Sale') {
        const movementDate = new Date(movement.occurredAtUtc);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        if (movementDate >= thirtyDaysAgo) {
          soldInLast30ByProduct.set(
            movement.itemId,
            (soldInLast30ByProduct.get(movement.itemId) ?? 0) + movement.quantity
          );
        }
      }
    });

    const rows = scopedProducts.map((product) => {
      const soldIn30 = soldInLast30ByProduct.get(product.id) ?? 0;
      const dailyOutflow = soldIn30 / 30;
      const coverageDays = dailyOutflow > 0 ? product.currentStock / dailyOutflow : null;
      const lastMovement = lastMovementByProduct.get(product.id);
      const daysWithoutMovement = lastMovement
        ? Math.floor((now.getTime() - new Date(lastMovement).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        product,
        soldIn30,
        dailyOutflow,
        coverageDays,
        daysWithoutMovement,
        stockRisk: product.currentStock === 0 || (coverageDays !== null && coverageDays <= 15)
      };
    });

    return rows.sort((left, right) => {
      const leftCoverage = left.coverageDays ?? Number.MAX_SAFE_INTEGER;
      const rightCoverage = right.coverageDays ?? Number.MAX_SAFE_INTEGER;
      return leftCoverage - rightCoverage;
    });
  }, [productMovements, scopedProducts]);

  const kpiAtRisk = useMemo(
    () => stockAnalytics.filter((item) => item.stockRisk).length,
    [stockAnalytics]
  );
  const kpiIdle = useMemo(
    () => stockAnalytics.filter((item) => (item.daysWithoutMovement ?? 0) >= 30).length,
    [stockAnalytics]
  );

  const alerts = useMemo(() => {
    const classify = (item: (typeof stockAnalytics)[number]) => {
      if (item.product.currentStock === 0) {
        return {
          severity: 0,
          tone: 'out' as const,
          label: 'Sem estoque',
          reason: `Saída média ${item.dailyOutflow.toFixed(1)}/dia • vendeu ${item.soldIn30} em 30d`
        };
      }
      if (item.stockRisk && item.coverageDays !== null) {
        return {
          severity: 1,
          tone: 'low' as const,
          label: 'Cobertura baixa',
          reason: `Saldo ${item.product.currentStock} • cobertura ~${Math.floor(item.coverageDays)} dias`
        };
      }
      if ((item.daysWithoutMovement ?? 0) >= 30) {
        return {
          severity: 2,
          tone: 'idle' as const,
          label: `Parado ${item.daysWithoutMovement}d`,
          reason: `Saldo ${item.product.currentStock} • sem movimento há ${item.daysWithoutMovement} dias`
        };
      }
      return null;
    };

    return stockAnalytics
      .map((item) => {
        const alert = classify(item);
        return alert ? { product: item.product, ...alert } : null;
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .sort((left, right) => left.severity - right.severity)
      .slice(0, 8);
  }, [stockAnalytics]);

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase();
    return productMovements
      .filter((m) => !term || [m.itemName, m.notes, m.type].join(' ').toLowerCase().includes(term))
      .filter((m) => {
        const matchesScope = scopeFilter === 'all' ? true
          : scopeFilter === 'store' ? !m.supplierId
            : m.supplierId === scopeFilter;
        const at = new Date(m.occurredAtUtc);
        const matchesStart = !startDate || at >= new Date(`${startDate}T00:00:00`);
        const matchesEnd = !endDate || at <= new Date(`${endDate}T23:59:59`);
        return matchesScope && matchesStart && matchesEnd;
      });
  }, [productMovements, search, scopeFilter, startDate, endDate]);

  const entryMovements = useMemo(() => filteredMovements.filter((m) => m.type === 'Entry'), [filteredMovements]);
  const exitMovements = useMemo(
    () => filteredMovements.filter((m) => m.type === 'Exit' || m.type === 'Sale' || m.type === 'Adjustment'),
    [filteredMovements]
  );
  const pagedEntryMovements = entryMovements.slice(entryPage * movementRowsPerPage, entryPage * movementRowsPerPage + movementRowsPerPage);
  const pagedExitMovements = exitMovements.slice(exitPage * movementRowsPerPage, exitPage * movementRowsPerPage + movementRowsPerPage);

  const inStockProducts = useMemo(() => {
    const normalizedTerm = stockSearch.trim().toLowerCase();
    return scopedProducts.filter((product) => {
      if (product.currentStock <= 0) {
        return false;
      }

      const matchesText = normalizedTerm.length === 0
        || product.name.toLowerCase().includes(normalizedTerm)
        || product.sku.toLowerCase().includes(normalizedTerm);
      const matchesCategory = stockCategoryFilter === 'all' || product.categoryId === stockCategoryFilter;
      return matchesText && matchesCategory;
    });
  }, [scopedProducts, stockCategoryFilter, stockSearch]);

  const filteredStockAnalytics = useMemo(() => {
    const normalizedTerm = analysisSearch.trim().toLowerCase();

    return stockAnalytics.filter((item) => {
      const stockStatus = item.product.currentStock === 0
        ? 'out'
        : item.stockRisk
          ? 'low'
          : 'stable';
      const matchesStatus = analysisStatusFilter === 'all' || stockStatus === analysisStatusFilter;
      const matchesText = normalizedTerm.length === 0
        || item.product.name.toLowerCase().includes(normalizedTerm)
        || item.product.sku.toLowerCase().includes(normalizedTerm);

      return matchesStatus && matchesText;
    });
  }, [analysisSearch, analysisStatusFilter, stockAnalytics]);

  const pagedStockAnalytics = useMemo(
    () => filteredStockAnalytics.slice(analysisPage * analysisRowsPerPage, analysisPage * analysisRowsPerPage + analysisRowsPerPage),
    [analysisPage, analysisRowsPerPage, filteredStockAnalytics]
  );

  const pagedInStockProducts = useMemo(
    () => inStockProducts.slice(stockPage * stockRowsPerPage, stockPage * stockRowsPerPage + stockRowsPerPage),
    [inStockProducts, stockPage, stockRowsPerPage]
  );

  const stockTotalValue = useMemo(
    () => inStockProducts.reduce((sum, product) => sum + product.currentStock * product.costPrice, 0),
    [inStockProducts]
  );

  const categoryColorsById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.colorHex])),
    [categories]
  );

  const mutation = useMutation({
    mutationFn: async () => inventoryApi.createMovement(form),
    onSuccess: () => {
      setFeedback('Movimentação registrada.');
      setForm({ itemType: 'Product', itemId: '', type: 'Entry', quantity: 1, unitCost: 0, notes: '' });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => inventoryApi.deleteMovement(id),
    onSuccess: () => {
      setFeedback('Movimentação excluída com sucesso.');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => {
      setFeedback('Erro ao excluir a movimentação.');
      setDeleteTarget(null);
    }
  });

  const reverseMutation = useMutation({
    mutationFn: async (id: string) => inventoryApi.reverseMovement(id),
    onSuccess: () => {
      setFeedback('Estorno registrado com sucesso.');
      setReverseTarget(null);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => {
      setFeedback('Erro ao estornar a movimentação.');
      setReverseTarget(null);
    }
  });

  function handleCloseDialog() {
    setForm({ itemType: 'Product', itemId: '', type: 'Entry', quantity: 1, unitCost: 0, notes: '' });
    setIsDialogOpen(false);
  }

  function openRestockDialog(productId: string, costPrice: number) {
    setForm({ itemType: 'Product', itemId: productId, type: 'Entry', quantity: 1, unitCost: costPrice, notes: '' });
    setIsDialogOpen(true);
  }

  function renderCategoryWithColor(categoryId: string, categoryName: string) {
    const color = categoryColorsById.get(categoryId) ?? '#b7a094';
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
        <Typography>{categoryName}</Typography>
      </Stack>
    );
  }

  function renderDeleteButton(movement: InventoryMovement) {
    if (movement.type !== 'Entry') return null;
    return (
      <Tooltip title="Excluir movimentação">
        <IconButton size="small" color="error" onClick={() => setDeleteTarget(movement)}>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  function renderReverseButton(movement: InventoryMovement) {
    if (movement.type === 'Entry' || movement.type === 'Sale') return null;
    return (
      <Tooltip title="Estornar movimentação">
        <IconButton size="small" onClick={() => setReverseTarget(movement)}>
          <UndoRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  const alertToneStyles: Record<'out' | 'low' | 'idle', { color: string; backgroundColor: string }> = {
    out: { color: '#a54b62', backgroundColor: 'rgba(217, 107, 135, 0.16)' },
    low: { color: '#9a6b1f', backgroundColor: 'rgba(225, 166, 87, 0.22)' },
    idle: { color: '#7d6558', backgroundColor: 'rgba(71, 51, 40, 0.1)' }
  };

  const scopeFilterField = !isSupplier ? (
    <TextField
      select
      label="Lista"
      value={scopeFilter}
      onChange={(e) => { setScopeFilter(e.target.value); setEntryPage(0); setExitPage(0); setStockPage(0); setAnalysisPage(0); }}
      sx={{ minWidth: { xs: '100%', sm: 220 } }}
    >
      <MenuItem value="all">Todos</MenuItem>
      <MenuItem value="store">Lojinha Sem Nome</MenuItem>
      {(metadata?.suppliers ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
    </TextField>
  ) : null;

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h3">Estoque</Typography>
        <Typography color="text.secondary">Saldo, movimentações e cobertura em um só lugar — alertas sempre à vista, detalhe nas abas.</Typography>
      </Stack>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' } }}>
        <KpiCard label="Produtos em estoque" value={`${kpiInStock}`} caption={`de ${managedProducts.length} no catálogo`} />
        <KpiCard label="Sem estoque" value={`${kpiOutOfStock}`} caption="precisam de reposição" alert={kpiOutOfStock > 0} />
        <KpiCard label="Valor em estoque (custo)" value={formatCurrency(kpiStockValue)} caption="custo × saldo" />
        <KpiCard label="Itens críticos" value={`${kpiAtRisk}`} caption="cobertura ≤ 15 dias" alert={kpiAtRisk > 0} />
        <KpiCard label="Parados 30d+" value={`${kpiIdle}`} caption="sem nenhum movimento" />
      </Box>

      {feedback ? <Alert severity="success" onClose={() => setFeedback(null)}>{feedback}</Alert> : null}

      {alerts.length > 0 ? (
        <Paper sx={{ p: { xs: 2, md: 3 }, overflow: 'hidden', border: '1px solid rgba(217,107,135,0.4)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} mb={2}>
            <Box>
              <Typography variant="h5" sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, lineHeight: 1.2 }}>Alertas de estoque</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>O que precisa de atenção agora — ruptura, cobertura curta e itens parados.</Typography>
            </Box>
            <Button variant="text" onClick={() => setActiveTab(2)}>Ver análise completa</Button>
          </Stack>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
            {alerts.map((alert) => (
              <Paper key={alert.product.id} variant="outlined" sx={{ p: 1.75, borderColor: 'rgba(217,107,135,0.2)' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap title={alert.product.name}>{alert.product.name}</Typography>
                    <Typography color="text.secondary" fontSize={11.5}>{alert.reason}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                    <Chip label={alert.label} size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 800, ...alertToneStyles[alert.tone] }} />
                    <Button size="small" variant="outlined" onClick={() => openRestockDialog(alert.product.id, alert.product.costPrice)}>
                      {alert.tone === 'idle' ? 'Ajustar' : 'Repor'}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Box>
        </Paper>
      ) : null}

      <PageSection
        title="Movimentos e cobertura"
        subtitle="Saldo atual, histórico de movimentações e análise operacional em abas."
        action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setIsDialogOpen(true)}>Registrar movimentação</Button>}
      >
        <Tabs
          value={activeTab}
          onChange={(_event, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2.5, borderBottom: '1px solid rgba(217,107,135,0.18)' }}
        >
          <Tab label={`Saldo atual (${inStockProducts.length})`} />
          <Tab label={`Movimentações (${filteredMovements.length})`} />
          <Tab label="Análise operacional" />
        </Tabs>

        {activeTab === 0 ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap">
              {scopeFilterField}
              <TextField
                label="Buscar produto em estoque"
                value={stockSearch}
                onChange={(event) => { setStockSearch(event.target.value); setStockPage(0); }}
                placeholder="Nome ou SKU"
                sx={{ flex: 1, minWidth: { xs: '100%', md: 220 } }}
              />
              <TextField
                select
                label="Categoria"
                value={stockCategoryFilter}
                onChange={(event) => { setStockCategoryFilter(event.target.value); setStockPage(0); }}
                sx={{ minWidth: { xs: '100%', md: 220 } }}
              >
                <MenuItem value="all">Todas</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Typography color="text.secondary" fontSize={13}>
              {inStockProducts.length} produto(s) com saldo • valor total {formatCurrency(stockTotalValue)}
            </Typography>
            {isMobile ? (
              <Stack spacing={1.5}>
                {pagedInStockProducts.map((p) => (
                  <Paper key={p.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography fontWeight={700}>{p.name}</Typography>
                        <Typography sx={{ fontFamily: '"Baloo 2", "Nunito", sans-serif', fontWeight: 700, fontSize: '1.1rem' }}>{p.currentStock}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {renderCategoryWithColor(p.categoryId, p.category)}
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary" fontSize={13}>{p.supplier ?? 'Lojinha Sem Nome'} • {p.sku}</Typography>
                        <Typography color="text.secondary" fontSize={13}>{formatCurrency(p.currentStock * p.costPrice)}</Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Produto</TableCell>
                      <TableCell>Categoria</TableCell>
                      <TableCell>Fornecedor</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Saldo</TableCell>
                      <TableCell align="right">Custo unit.</TableCell>
                      <TableCell align="right">Valor em estoque</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedInStockProducts.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{renderCategoryWithColor(p.categoryId, p.category)}</TableCell>
                        <TableCell>{p.supplier ?? 'Lojinha Sem Nome'}</TableCell>
                        <TableCell>{p.sku}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{p.currentStock}</TableCell>
                        <TableCell align="right">{formatCurrency(p.costPrice)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(p.currentStock * p.costPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
            {pagedInStockProducts.length === 0 ? <Alert severity="info">Nenhum produto com estoque disponível.</Alert> : null}
            <TablePagination
              component="div"
              count={inStockProducts.length}
              page={stockPage}
              onPageChange={(_, v) => setStockPage(v)}
              rowsPerPage={stockRowsPerPage}
              onRowsPerPageChange={(event) => { setStockRowsPerPage(Number(event.target.value)); setStockPage(0); }}
              rowsPerPageOptions={[8, 16, 32]}
              labelRowsPerPage="Itens por página"
            />
          </Stack>
        ) : null}

        {activeTab === 1 ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap">
              {scopeFilterField}
              <TextField
                label="Buscar movimentação"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setEntryPage(0); setExitPage(0); }}
                placeholder="Produto, observação ou tipo"
                sx={{ flex: 1, minWidth: { xs: '100%', md: 220 } }}
              />
              <TextField label="De" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEntryPage(0); setExitPage(0); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: { xs: '100%', sm: 160 } }} />
              <TextField label="Até" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setEntryPage(0); setExitPage(0); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: { xs: '100%', sm: 160 } }} />
            </Stack>

            <Typography variant="h6">Entradas</Typography>
            {isMobile ? (
              <Stack spacing={1.5}>
                {pagedEntryMovements.map((m) => (
                  <Paper key={m.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(123, 207, 192, 0.18)' }}>
                    <Stack spacing={1.1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography fontWeight={700}>{m.itemName}</Typography>
                        {renderDeleteButton(m)}
                      </Stack>
                      <Typography color="text.secondary">Data: {formatUtcDate(m.occurredAtUtc)}</Typography>
                      <Typography color="text.secondary">Movimento: {inventoryMovementTypeLabel(m.type)}</Typography>
                      <Typography color="text.secondary">Quantidade: {m.quantity}</Typography>
                      <Typography color="text.secondary">Custo unitário: {formatCurrency(Number(m.unitCost ?? 0))}</Typography>
                      <Typography color="text.secondary">{m.notes || 'Sem observações'}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Table size="small" sx={{ minWidth: 800 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Data</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Item</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Movimento</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Qtd.</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Custo unitário</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Observação</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedEntryMovements.map((m) => (
                      <TableRow key={m.id} hover sx={{ backgroundColor: 'rgba(123, 207, 192, 0.12)' }}>
                        <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>{formatUtcDate(m.occurredAtUtc)}</TableCell>
                        <TableCell sx={{ py: 1.5, minWidth: 180 }}>{m.itemName}</TableCell>
                        <TableCell sx={{ py: 1.5 }}>{inventoryMovementTypeLabel(m.type)}</TableCell>
                        <TableCell sx={{ py: 1.5 }}>{m.quantity}</TableCell>
                        <TableCell sx={{ py: 1.5 }}>{formatCurrency(Number(m.unitCost ?? 0))}</TableCell>
                        <TableCell sx={{ py: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', pr: 3 }}>{m.notes || 'Sem observações'}</TableCell>
                        <TableCell sx={{ py: 1.5 }}>{renderDeleteButton(m)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
            {pagedEntryMovements.length === 0 ? <Alert severity="info">Nenhuma entrada encontrada.</Alert> : null}
            <TablePagination component="div" count={entryMovements.length} page={entryPage} onPageChange={(_, v) => setEntryPage(v)} rowsPerPage={movementRowsPerPage} rowsPerPageOptions={[movementRowsPerPage]} labelRowsPerPage="Itens por página" />

            <Typography variant="h6">Saídas</Typography>
            {isMobile ? (
              <Stack spacing={1.5}>
                {pagedExitMovements.map((m) => (
                  <Paper key={m.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(217, 107, 135, 0.16)' }}>
                    <Stack spacing={1.1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography fontWeight={700}>{m.itemName}</Typography>
                        {renderReverseButton(m)}
                      </Stack>
                      <Typography color="text.secondary">Data: {formatUtcDate(m.occurredAtUtc)}</Typography>
                      <Typography color="text.secondary">Movimento: <Chip label={inventoryMovementTypeLabel(m.type)} size="small" /></Typography>
                      <Typography color="text.secondary">Quantidade: {m.quantity}</Typography>
                      <Typography color="text.secondary">Custo unitário: {formatCurrency(Number(m.unitCost ?? 0))}</Typography>
                      <Typography color="text.secondary">{m.notes || 'Sem observações'}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Table size="small" sx={{ minWidth: 800 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Data</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Item</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Movimento</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Qtd.</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Custo unitário</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Observação</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedExitMovements.map((m) => (
                      <TableRow key={m.id} hover sx={{ backgroundColor: 'rgba(217, 107, 135, 0.11)' }}>
                        <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>{formatUtcDate(m.occurredAtUtc)}</TableCell>
                        <TableCell sx={{ py: 1.5, minWidth: 180 }}>{m.itemName}</TableCell>
                        <TableCell sx={{ py: 1.5 }}><Chip label={inventoryMovementTypeLabel(m.type)} size="small" variant="outlined" /></TableCell>
                        <TableCell sx={{ py: 1.5 }}>{m.quantity}</TableCell>
                        <TableCell sx={{ py: 1.5 }}>{formatCurrency(Number(m.unitCost ?? 0))}</TableCell>
                        <TableCell sx={{ py: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', pr: 3 }}>{m.notes || 'Sem observações'}</TableCell>
                        <TableCell sx={{ py: 1.5 }}>{renderReverseButton(m)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
            {pagedExitMovements.length === 0 ? <Alert severity="info">Nenhuma saída encontrada.</Alert> : null}
            <TablePagination component="div" count={exitMovements.length} page={exitPage} onPageChange={(_, v) => setExitPage(v)} rowsPerPage={movementRowsPerPage} rowsPerPageOptions={[movementRowsPerPage]} labelRowsPerPage="Itens por página" />
          </Stack>
        ) : null}

        {activeTab === 2 ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap">
              <TextField
                label="Buscar na análise"
                value={analysisSearch}
                onChange={(event) => { setAnalysisSearch(event.target.value); setAnalysisPage(0); }}
                placeholder="Nome ou SKU"
                sx={{ flex: 1, minWidth: { xs: '100%', md: 240 } }}
              />
              <TextField
                select
                label="Status operacional"
                value={analysisStatusFilter}
                onChange={(event) => { setAnalysisStatusFilter(event.target.value); setAnalysisPage(0); }}
                sx={{ minWidth: { xs: '100%', md: 220 } }}
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="out">Sem estoque</MenuItem>
                <MenuItem value="low">Cobertura baixa</MenuItem>
                <MenuItem value="stable">Estável</MenuItem>
              </TextField>
            </Stack>
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Produto</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell align="right">Estoque atual</TableCell>
                    <TableCell align="right">Vendido 30d</TableCell>
                    <TableCell align="right">Saída média/dia</TableCell>
                    <TableCell align="right">Cobertura estimada</TableCell>
                    <TableCell align="right">Dias sem movimento</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedStockAnalytics.map((item) => (
                    <TableRow key={item.product.id} hover>
                      <TableCell>{item.product.name}</TableCell>
                      <TableCell>{item.product.sku}</TableCell>
                      <TableCell align="right">{item.product.currentStock}</TableCell>
                      <TableCell align="right">{item.soldIn30}</TableCell>
                      <TableCell align="right">{item.dailyOutflow.toFixed(2)}</TableCell>
                      <TableCell align="right">{item.coverageDays === null ? 'Sem consumo recente' : `${Math.floor(item.coverageDays)} dia(s)`}</TableCell>
                      <TableCell align="right">{item.daysWithoutMovement === null ? 'Sem histórico' : `${item.daysWithoutMovement} dia(s)`}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={item.product.currentStock === 0 ? 'error' : item.stockRisk ? 'warning' : 'success'}
                          label={item.product.currentStock === 0 ? 'Sem estoque' : item.stockRisk ? 'Cobertura baixa' : 'Estável'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            {pagedStockAnalytics.length === 0 ? <Alert severity="info">Nenhum dado analítico de estoque encontrado para os filtros aplicados.</Alert> : null}
            <TablePagination
              component="div"
              count={filteredStockAnalytics.length}
              page={analysisPage}
              onPageChange={(_event, page) => setAnalysisPage(page)}
              rowsPerPage={analysisRowsPerPage}
              onRowsPerPageChange={(event) => { setAnalysisRowsPerPage(Number(event.target.value)); setAnalysisPage(0); }}
              rowsPerPageOptions={[8, 16, 32]}
              labelRowsPerPage="Itens por página"
            />
          </Stack>
        ) : null}
      </PageSection>

      {/* Dialog: nova movimentação */}
      <Dialog open={isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>Nova movimentação de produto</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <ProductLookupField
              label="Produto"
              value={form.itemId}
              products={managedProducts}
              onChange={(productId) => {
                const selected = managedProducts.find((p) => p.id === productId);
                setForm({ ...form, itemId: productId, unitCost: selected?.costPrice ?? 0 });
              }}
              helperText="Digite ao menos 2 caracteres para localizar o produto. O custo unitário é preenchido automaticamente e pode ser alterado."
            />
            <TextField select label="Movimento" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <MenuItem value="Entry">Entrada</MenuItem>
              <MenuItem value="Exit">Saída</MenuItem>
              <MenuItem value="Adjustment">Ajuste</MenuItem>
            </TextField>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              <TextField label="Quantidade" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} fullWidth />
              <CurrencyField label="Custo unitário" value={form.unitCost} onValueChange={(v) => setForm({ ...form, unitCost: v })} fullWidth />
              <TextField
                label="Valor sugerido (visual)"
                value={selectedMovementProduct ? formatCurrency(selectedMovementProduct.suggestedPrice) : ''}
                InputProps={{ readOnly: true }}
                placeholder="Selecione um produto"
                fullWidth
              />
              <TextField
                label="Valor de venda real (visual)"
                value={selectedMovementProduct ? formatCurrency(selectedMovementProduct.salePrice) : ''}
                InputProps={{ readOnly: true }}
                placeholder="Selecione um produto"
                fullWidth
              />
            </Box>
            <TextField label="Observação" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} multiline minRows={3} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isLoading || !form.itemId}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: confirmação de exclusão */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography>Deseja excluir a seguinte movimentação?</Typography>
            <Typography><strong>Item:</strong> {deleteTarget?.itemName}</Typography>
            <Typography><strong>Tipo:</strong> {deleteTarget ? inventoryMovementTypeLabel(deleteTarget.type) : ''}</Typography>
            <Typography><strong>Quantidade:</strong> {deleteTarget?.quantity}</Typography>
            <Typography><strong>Data:</strong> {deleteTarget ? formatUtcDate(deleteTarget.occurredAtUtc) : ''}</Typography>
            <Alert severity="warning" sx={{ mt: 1 }}>
              A movimentação será removida do histórico e não será gerada contra-movimentação.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isLoading}
          >
            Confirmar exclusão
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: confirmação de estorno */}
      <Dialog open={!!reverseTarget} onClose={() => setReverseTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar estorno</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography>Deseja estornar a seguinte movimentação?</Typography>
            <Typography><strong>Item:</strong> {reverseTarget?.itemName}</Typography>
            <Typography><strong>Tipo:</strong> {reverseTarget ? inventoryMovementTypeLabel(reverseTarget.type) : ''}</Typography>
            <Typography><strong>Quantidade:</strong> {reverseTarget?.quantity}</Typography>
            <Typography><strong>Data:</strong> {reverseTarget ? formatUtcDate(reverseTarget.occurredAtUtc) : ''}</Typography>
            <Alert severity="warning" sx={{ mt: 1 }}>
              Será registrada uma contra-movimentação automática para corrigir o estoque.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setReverseTarget(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => reverseTarget && reverseMutation.mutate(reverseTarget.id)}
            disabled={reverseMutation.isLoading}
          >
            Confirmar estorno
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
