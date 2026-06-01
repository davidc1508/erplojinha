import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
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

  return (
    <Stack spacing={3}>
      {/* KPIs reais */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" variant="body2">Produtos em estoque</Typography>
            <Typography variant="h5">{kpiInStock}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" variant="body2">Sem estoque</Typography>
            <Typography variant="h5">{kpiOutOfStock}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" variant="body2">Valor estimado (custo)</Typography>
            <Typography variant="h5">{kpiStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" variant="body2">Itens críticos de estoque</Typography>
            <Typography variant="h5">{kpiAtRisk}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" variant="body2">Sem movimento há 30+ dias</Typography>
            <Typography variant="h5">{kpiIdle}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <PageSection
        title="Movimentações de produtos"
        subtitle="Entradas, saídas e baixas automáticas em uma tabela com leitura mais segura."
        action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setIsDialogOpen(true)}>Registrar movimentação</Button>}
      >
        <Stack spacing={2}>
          {feedback ? <Alert severity="success" onClose={() => setFeedback(null)}>{feedback}</Alert> : null}
          <Grid container spacing={1.5}>
            {!isSupplier ? (
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  label="Lista"
                  value={scopeFilter}
                  onChange={(e) => { setScopeFilter(e.target.value); setEntryPage(0); setExitPage(0); setStockPage(0); }}
                  fullWidth
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="store">Lojinha Sem Nome</MenuItem>
                  {(metadata?.suppliers ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              </Grid>
            ) : null}
            <Grid item xs={12} md={6}>
              <TextField label="Buscar movimentação" value={search} onChange={(e) => { setSearch(e.target.value); setEntryPage(0); setExitPage(0); }} placeholder="Produto, observação ou tipo" fullWidth />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="De" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEntryPage(0); setExitPage(0); }} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Até" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setEntryPage(0); setExitPage(0); }} InputLabelProps={{ shrink: true }} fullWidth />
            </Grid>
          </Grid>

          <Typography variant="h6">Entradas</Typography>
          {isMobile ? (
            <Stack spacing={1.5}>
              {pagedEntryMovements.map((m) => (
                <Paper key={m.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(123, 207, 192, 0.18)' }}>
                  <Stack spacing={1.1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography fontWeight={700}>{m.itemName}</Typography>
                      {renderReverseButton(m)}
                    </Stack>
                    <Typography color="text.secondary">Data: {formatUtcDate(m.occurredAtUtc)}</Typography>
                    <Typography color="text.secondary">Movimento: {inventoryMovementTypeLabel(m.type)}</Typography>
                    <Typography color="text.secondary">Quantidade: {m.quantity}</Typography>
                    <Typography color="text.secondary">Custo unitário: {Number(m.unitCost ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Typography>
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
                      <TableCell sx={{ py: 1.5 }}>{Number(m.unitCost ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell sx={{ py: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', pr: 3 }}>{m.notes || 'Sem observações'}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>{renderReverseButton(m)}</TableCell>
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
                      {renderDeleteButton(m)}
                    </Stack>
                    <Typography color="text.secondary">Data: {formatUtcDate(m.occurredAtUtc)}</Typography>
                    <Typography color="text.secondary">Movimento: <Chip label={inventoryMovementTypeLabel(m.type)} size="small" /></Typography>
                    <Typography color="text.secondary">Quantidade: {m.quantity}</Typography>
                    <Typography color="text.secondary">Custo unitário: {Number(m.unitCost ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Typography>
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
                      <TableCell sx={{ py: 1.5 }}>{Number(m.unitCost ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell sx={{ py: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', pr: 3 }}>{m.notes || 'Sem observações'}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>{renderDeleteButton(m)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
          {pagedExitMovements.length === 0 ? <Alert severity="info">Nenhuma saída encontrada.</Alert> : null}
          <TablePagination component="div" count={exitMovements.length} page={exitPage} onPageChange={(_, v) => setExitPage(v)} rowsPerPage={movementRowsPerPage} rowsPerPageOptions={[movementRowsPerPage]} labelRowsPerPage="Itens por página" />
        </Stack>
      </PageSection>

      <PageSection title="Produtos em estoque" subtitle="Lista paginada apenas com itens que ainda possuem saldo.">
        <Stack spacing={2}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={7}>
              <TextField
                label="Buscar produto em estoque"
                value={stockSearch}
                onChange={(event) => {
                  setStockSearch(event.target.value);
                  setStockPage(0);
                }}
                placeholder="Nome ou SKU"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                select
                label="Categoria"
                value={stockCategoryFilter}
                onChange={(event) => {
                  setStockCategoryFilter(event.target.value);
                  setStockPage(0);
                }}
                fullWidth
              >
                <MenuItem value="all">Todas</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          {isMobile ? (
            <Stack spacing={1.5}>
              {pagedInStockProducts.map((p) => (
                <Paper key={p.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                  <Stack spacing={1}>
                    <Typography fontWeight={700}>{p.name}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography color="text.secondary">Categoria:</Typography>
                      {renderCategoryWithColor(p.categoryId, p.category)}
                    </Stack>
                    <Typography color="text.secondary">Estoque: {p.currentStock}</Typography>
                    <Typography color="text.secondary">SKU: {p.sku}</Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Produto</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell>Fornecedor</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Estoque</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedInStockProducts.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{renderCategoryWithColor(p.categoryId, p.category)}</TableCell>
                      <TableCell>{p.supplier ?? 'Lojinha Sem Nome'}</TableCell>
                      <TableCell>{p.sku}</TableCell>
                      <TableCell>{p.currentStock}</TableCell>
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
            onRowsPerPageChange={(event) => {
              setStockRowsPerPage(Number(event.target.value));
              setStockPage(0);
            }}
            rowsPerPageOptions={[8, 16, 32]}
            labelRowsPerPage="Itens por página"
          />
        </Stack>
      </PageSection>

      <PageSection title="Análise operacional do estoque" subtitle="Cobertura estimada, giro recente e ociosidade por produto.">
        <Stack spacing={2}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={7}>
              <TextField
                label="Buscar na análise"
                value={analysisSearch}
                onChange={(event) => {
                  setAnalysisSearch(event.target.value);
                  setAnalysisPage(0);
                }}
                placeholder="Nome ou SKU"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                select
                label="Status operacional"
                value={analysisStatusFilter}
                onChange={(event) => {
                  setAnalysisStatusFilter(event.target.value);
                  setAnalysisPage(0);
                }}
                fullWidth
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="out">Sem estoque</MenuItem>
                <MenuItem value="low">Cobertura baixa</MenuItem>
                <MenuItem value="stable">Estável</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small" sx={{ minWidth: 960 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Produto</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Estoque atual</TableCell>
                  <TableCell>Vendido 30d</TableCell>
                  <TableCell>Saída média/dia</TableCell>
                  <TableCell>Cobertura estimada</TableCell>
                  <TableCell>Dias sem movimento</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedStockAnalytics.map((item) => (
                  <TableRow key={item.product.id} hover>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell>{item.product.sku}</TableCell>
                    <TableCell>{item.product.currentStock}</TableCell>
                    <TableCell>{item.soldIn30}</TableCell>
                    <TableCell>{item.dailyOutflow.toFixed(2)}</TableCell>
                    <TableCell>{item.coverageDays === null ? 'Sem consumo recente' : `${Math.floor(item.coverageDays)} dia(s)`}</TableCell>
                    <TableCell>{item.daysWithoutMovement === null ? 'Sem histórico' : `${item.daysWithoutMovement} dia(s)`}</TableCell>
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
            onRowsPerPageChange={(event) => {
              setAnalysisRowsPerPage(Number(event.target.value));
              setAnalysisPage(0);
            }}
            rowsPerPageOptions={[8, 16, 32]}
            labelRowsPerPage="Itens por página"
          />
        </Stack>
      </PageSection>

      {/* Dialog: nova movimentação */}
      <Dialog open={isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
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
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label="Quantidade" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <CurrencyField label="Custo unitário" value={form.unitCost} onValueChange={(v) => setForm({ ...form, unitCost: v })} fullWidth />
              </Grid>
            </Grid>
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
