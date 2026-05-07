import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useMemo, useState } from 'react';
import { CurrencyField } from '../components/CurrencyField';
import { ProductLookupField } from '../components/ProductLookupField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { categoriesApi, inventoryApi, productsApi } from '../services/api';
import { formatUtcDate } from '../services/date';
import { inventoryMovementTypeLabel } from '../services/labels';

export function InventoryPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const supplierId = session?.supplierId ?? '';
  const rowsPerPage = 8;
  const queryClient = useQueryClient();
  const { data: movements = [] } = useQuery({ queryKey: ['inventory'], queryFn: inventoryApi.getMovements });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.getAll() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });
  const { data: metadata } = useQuery({ queryKey: ['products-metadata'], queryFn: productsApi.getMetadata, enabled: !isSupplier });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryPage, setEntryPage] = useState(0);
  const [exitPage, setExitPage] = useState(0);
  const [stockPage, setStockPage] = useState(0);
  const [form, setForm] = useState({ itemType: 'Product', itemId: '', type: 'Entry', quantity: 1, unitCost: 0, notes: '' });
  const managedProducts = useMemo(() => isSupplier ? products.filter((product) => product.supplierId === supplierId) : products, [isSupplier, products, supplierId]);
  const productMovements = useMemo(() => movements.filter((movement) => movement.itemType === 'Product'), [movements]);
  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return productMovements;
    }

    return productMovements.filter((movement) => [movement.itemName, movement.notes, movement.type].join(' ').toLowerCase().includes(term));
  }, [productMovements, search]).filter((movement) => {
    const matchesScope = scopeFilter === 'all'
      ? true
      : scopeFilter === 'store'
        ? !movement.supplierId
        : movement.supplierId === scopeFilter;
    const occurredAt = new Date(movement.occurredAtUtc);
    const matchesStartDate = !startDate || occurredAt >= new Date(`${startDate}T00:00:00`);
    const matchesEndDate = !endDate || occurredAt <= new Date(`${endDate}T23:59:59`);
    return matchesScope && matchesStartDate && matchesEndDate;
  });
  const entryMovements = useMemo(
    () => filteredMovements.filter((movement) => movement.type === 'Entry'),
    [filteredMovements]
  );
  const exitMovements = useMemo(
    () => filteredMovements.filter((movement) => movement.type === 'Exit' || movement.type === 'Sale' || movement.type === 'Adjustment'),
    [filteredMovements]
  );
  const pagedEntryMovements = entryMovements.slice(entryPage * rowsPerPage, entryPage * rowsPerPage + rowsPerPage);
  const pagedExitMovements = exitMovements.slice(exitPage * rowsPerPage, exitPage * rowsPerPage + rowsPerPage);
  const inStockProducts = useMemo(
    () => managedProducts
      .filter((product) => product.currentStock > 0)
      .filter((product) => scopeFilter === 'all'
        ? true
        : scopeFilter === 'store'
          ? !product.supplierId
          : product.supplierId === scopeFilter),
    [managedProducts, scopeFilter]);
  const pagedInStockProducts = useMemo(() => inStockProducts.slice(stockPage * rowsPerPage, stockPage * rowsPerPage + rowsPerPage), [inStockProducts, rowsPerPage, stockPage]);
  const categoryColorsById = useMemo(
    () => new Map(categories.map((item) => [item.id, item.colorHex])),
    [categories]
  );
  const movementSummary = useMemo(() => ({
    total: productMovements.length,
    entries: productMovements.filter((movement) => movement.type === 'Entry').length,
    exits: productMovements.filter((movement) => movement.type === 'Exit' || movement.type === 'Sale').length
  }), [productMovements]);

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

  function handleCloseDialog() {
    setForm({ itemType: 'Product', itemId: '', type: 'Entry', quantity: 1, unitCost: 0, notes: '' });
    setIsDialogOpen(false);
  }

  function renderCategoryWithColor(categoryId: string, categoryName: string) {
    const categoryColor = categoryColorsById.get(categoryId) ?? '#b7a094';

    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: categoryColor, flexShrink: 0 }} />
        <Typography>{categoryName}</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Movimentações</Typography><Typography variant="h5">{movementSummary.total}</Typography></Paper></Grid>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Entradas</Typography><Typography variant="h5">{movementSummary.entries}</Typography></Paper></Grid>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Saídas</Typography><Typography variant="h5">{movementSummary.exits}</Typography></Paper></Grid>
      </Grid>

      <PageSection
        title="Movimentações de produtos"
        subtitle="Entradas, saídas e baixas automáticas em uma tabela com leitura mais segura."
        action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setIsDialogOpen(true)}>Registrar movimentação</Button>}
      >
        <Stack spacing={2}>
          {feedback ? <Alert severity="success">{feedback}</Alert> : null}
          <Grid container spacing={1.5}>
            {!isSupplier ? (
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  label="Lista"
                  value={scopeFilter}
                  onChange={(event) => {
                    setScopeFilter(event.target.value);
                    setEntryPage(0);
                    setExitPage(0);
                    setStockPage(0);
                  }}
                  fullWidth
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="store">Lojinha Sem Nome</MenuItem>
                  {(metadata?.suppliers ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                </TextField>
              </Grid>
            ) : null}
            <Grid item xs={12} md={6}><TextField label="Buscar movimentação" value={search} onChange={(event) => { setSearch(event.target.value); setEntryPage(0); setExitPage(0); }} placeholder="Produto, observação ou tipo" fullWidth /></Grid>
            <Grid item xs={12} md={3}><TextField label="De" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setEntryPage(0); setExitPage(0); }} InputLabelProps={{ shrink: true }} fullWidth /></Grid>
            <Grid item xs={12} md={3}><TextField label="Até" type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setEntryPage(0); setExitPage(0); }} InputLabelProps={{ shrink: true }} fullWidth /></Grid>
          </Grid>

          <Typography variant="h6">Entradas</Typography>
          {isMobile ? (
            <Stack spacing={1.5}>
              {pagedEntryMovements.map((movement) => (
                <Paper key={movement.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(123, 207, 192, 0.18)' }}>
                  <Stack spacing={1.1}>
                    <Typography fontWeight={700}>{movement.itemName}</Typography>
                    <Typography color="text.secondary">Data: {formatUtcDate(movement.occurredAtUtc)}</Typography>
                    <Typography color="text.secondary">Movimento: {inventoryMovementTypeLabel(movement.type)}</Typography>
                    <Typography color="text.secondary">Quantidade: {movement.quantity}</Typography>
                    <Typography color="text.secondary">Custo unitário: {Number(movement.unitCost ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Typography>
                    <Typography color="text.secondary">{movement.notes || 'Sem observações'}</Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Data</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Item</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Movimento</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Qtd.</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Custo unitário</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Observação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedEntryMovements.map((movement) => (
                    <TableRow key={movement.id} hover sx={{ backgroundColor: 'rgba(123, 207, 192, 0.12)' }}>
                      <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>{formatUtcDate(movement.occurredAtUtc)}</TableCell>
                      <TableCell sx={{ py: 1.5, minWidth: 180 }}>{movement.itemName}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>{inventoryMovementTypeLabel(movement.type)}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>{movement.quantity}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>{Number(movement.unitCost ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell sx={{ py: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', pr: 3 }}>{movement.notes || 'Sem observações'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
          {pagedEntryMovements.length === 0 ? <Alert severity="info">Nenhuma entrada encontrada.</Alert> : null}
          <TablePagination
            component="div"
            count={entryMovements.length}
            page={entryPage}
            onPageChange={(_, value) => setEntryPage(value)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[rowsPerPage]}
            labelRowsPerPage="Itens por página"
          />

          <Typography variant="h6">Saídas</Typography>
          {isMobile ? (
            <Stack spacing={1.5}>
              {pagedExitMovements.map((movement) => (
                <Paper key={movement.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(217, 107, 135, 0.16)' }}>
                  <Stack spacing={1.1}>
                    <Typography fontWeight={700}>{movement.itemName}</Typography>
                    <Typography color="text.secondary">Data: {formatUtcDate(movement.occurredAtUtc)}</Typography>
                    <Typography color="text.secondary">Movimento: {inventoryMovementTypeLabel(movement.type)}</Typography>
                    <Typography color="text.secondary">Quantidade: {movement.quantity}</Typography>
                    <Typography color="text.secondary">Custo unitário: {Number(movement.unitCost ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Typography>
                    <Typography color="text.secondary">{movement.notes || 'Sem observações'}</Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Data</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Item</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Movimento</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Qtd.</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Custo unitário</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Observação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedExitMovements.map((movement) => (
                    <TableRow key={movement.id} hover sx={{ backgroundColor: 'rgba(217, 107, 135, 0.11)' }}>
                      <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>{formatUtcDate(movement.occurredAtUtc)}</TableCell>
                      <TableCell sx={{ py: 1.5, minWidth: 180 }}>{movement.itemName}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>{inventoryMovementTypeLabel(movement.type)}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>{movement.quantity}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>{Number(movement.unitCost ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell sx={{ py: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', pr: 3 }}>{movement.notes || 'Sem observações'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
          {pagedExitMovements.length === 0 ? <Alert severity="info">Nenhuma saída encontrada.</Alert> : null}
          <TablePagination
            component="div"
            count={exitMovements.length}
            page={exitPage}
            onPageChange={(_, value) => setExitPage(value)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[rowsPerPage]}
            labelRowsPerPage="Itens por página"
          />
        </Stack>
      </PageSection>

      <PageSection title="Produtos em estoque" subtitle="Lista paginada apenas com itens que ainda possuem saldo.">
        <Stack spacing={2}>
          {isMobile ? (
            <Stack spacing={1.5}>
              {pagedInStockProducts.map((product) => (
                <Paper key={product.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                  <Stack spacing={1}>
                    <Typography fontWeight={700}>{product.name}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography color="text.secondary">Categoria:</Typography>
                      {renderCategoryWithColor(product.categoryId, product.category)}
                    </Stack>
                    <Typography color="text.secondary">Estoque: {product.currentStock}</Typography>
                    <Typography color="text.secondary">Mínimo: {product.minimumStock}</Typography>
                    <Typography color="text.secondary">SKU: {product.sku}</Typography>
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
                    <TableCell>Estoque mínimo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedInStockProducts.map((product) => (
                    <TableRow key={product.id} hover>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{renderCategoryWithColor(product.categoryId, product.category)}</TableCell>
                      <TableCell>{product.supplier ?? 'Lojinha Sem Nome'}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.currentStock}</TableCell>
                      <TableCell>{product.minimumStock}</TableCell>
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
            onPageChange={(_, value) => setStockPage(value)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[rowsPerPage]}
            labelRowsPerPage="Itens por página"
          />
        </Stack>
      </PageSection>

      <Dialog open={isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>Nova movimentação de produto</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <ProductLookupField
              label="Produto"
              value={form.itemId}
              products={managedProducts}
              onChange={(productId) => {
                const selectedProduct = managedProducts.find((product) => product.id === productId);
                setForm({
                  ...form,
                  itemId: productId,
                  unitCost: selectedProduct?.costPrice ?? 0
                });
              }}
              helperText="Digite ao menos 2 caracteres para localizar o produto da movimentação. O custo unitário é preenchido automaticamente e pode ser alterado."
            />
            <TextField select label="Movimento" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              <MenuItem value="Entry">Entrada</MenuItem>
              <MenuItem value="Exit">Saída</MenuItem>
              <MenuItem value="Adjustment">Ajuste</MenuItem>
            </TextField>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField label="Quantidade" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} fullWidth /></Grid>
              <Grid item xs={12} sm={6}><CurrencyField label="Custo unitário" value={form.unitCost} onValueChange={(value) => setForm({ ...form, unitCost: value })} fullWidth /></Grid>
            </Grid>
            <TextField label="Observação" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} multiline minRows={3} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isLoading || !form.itemId}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}