import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Tooltip, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchSelectField } from '../components/SearchSelectField';
import { TableSkeleton } from '../components/TableSkeleton';
import { useAuth } from '../hooks/useAuth';
import { usePreservedListState } from '../hooks/useSessionState';
import { PageSection } from '../components/PageSection';
import { productsApi, salesApi } from '../services/api';
import { formatUtcDate } from '../services/date';
import { formatCurrency, paymentMethodLabel } from '../services/labels';

type SalesSortField = 'soldAtUtc' | 'fairName' | 'paymentMethod' | 'totalAmount' | 'profitAmount';

const defaultListState = {
  search: '',
  startDate: '',
  endDate: '',
  categoryFilter: 'all',
  productSearch: '',
  fairSearch: '',
  paymentFilter: 'all',
  page: 0,
  rowsPerPage: 10,
  sortField: 'soldAtUtc' as SalesSortField,
  sortDirection: 'desc' as 'asc' | 'desc'
};

export function SalesPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const isReseller = session?.role === 'Reseller';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [listState, setListState] = usePreservedListState(`sales-page:${session?.role ?? 'guest'}:${session?.supplierId ?? 'store'}`, defaultListState);
  const { search, startDate, endDate, categoryFilter, productSearch, fairSearch, paymentFilter, page, rowsPerPage, sortField, sortDirection } = listState;
  const { data: sales = [], isLoading: isLoadingSales } = useQuery({ queryKey: ['sales'], queryFn: salesApi.getAll });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.getAll() });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<(typeof sales)[number] | null>(null);

  const productCategoryMap = useMemo(() => new Map(products.map((product) => [product.name, product.category])), [products]);
  const categoryOptions = useMemo(() => Array.from(new Set(products.map((product) => product.category))).sort((left, right) => left.localeCompare(right)), [products]);

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    const productTerm = productSearch.trim().toLowerCase();
    const fairTerm = fairSearch.trim().toLowerCase();
    return sales.filter((sale) => {
      const soldAt = new Date(sale.soldAtUtc);
      const products = sale.items.map((item) => item.productName).join(' ');
      const matchesText = !term || [sale.fairName ?? '', sale.notes, products, sale.paymentMethod]
        .join(' ')
        .toLowerCase()
        .includes(term);
      const matchesStartDate = !startDate || soldAt >= new Date(`${startDate}T00:00:00`);
      const matchesEndDate = !endDate || soldAt <= new Date(`${endDate}T23:59:59`);
      const matchesCategory = categoryFilter === 'all' || sale.items.some((item) => productCategoryMap.get(item.productName) === categoryFilter);
      const matchesProduct = !productTerm || sale.items.some((item) => item.productName.toLowerCase().includes(productTerm));
      const matchesFair = !fairTerm || (sale.fairName ?? 'Venda direta').toLowerCase().includes(fairTerm);
      const matchesPayment = paymentFilter === 'all' || sale.paymentMethod === paymentFilter;
      return matchesText && matchesStartDate && matchesEndDate && matchesCategory && matchesProduct && matchesFair && matchesPayment;
    });
  }, [categoryFilter, endDate, fairSearch, paymentFilter, productCategoryMap, productSearch, sales, search, startDate]);

  const sortedSales = useMemo(() => {
    const sorted = [...filteredSales];
    sorted.sort((left, right) => {
      const leftValue = sortField === 'fairName' ? left.fairName ?? 'Venda direta' : left[sortField];
      const rightValue = sortField === 'fairName' ? right.fairName ?? 'Venda direta' : right[sortField];
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : sortField === 'soldAtUtc'
          ? new Date(String(leftValue)).getTime() - new Date(String(rightValue)).getTime()
          : String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'pt-BR');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredSales, sortDirection, sortField]);

  const visibleSales = sortedSales.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profitAmount, 0);

  const deleteMutation = useMutation({
    mutationFn: async (saleId: string) => salesApi.remove(saleId),
    onSuccess: async () => {
      setFeedback('Venda removida. Estoque e financeiro recalculados.');
      setSaleToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
    }
  });

  function updateListState(patch: Partial<typeof defaultListState>) {
    setListState((current) => ({ ...current, ...patch }));
  }

  function handleSort(field: SalesSortField) {
    updateListState({
      sortField: field,
      sortDirection: sortField === field && sortDirection === 'asc' ? 'desc' : 'asc',
      page: 0
    });
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <div>
            <Typography variant="h4">{isSupplier || isReseller ? 'Minhas vendas' : 'Vendas'}</Typography>
            <Typography color="text.secondary">Histórico separado do formulário para deixar o fluxo mais direto.</Typography>
          </div>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/vendas/nova', { state: { preserveState: true } })}>
            Nova venda
          </Button>
        </Stack>
      </Grid>
      <Grid item xs={12}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Vendas registradas</Typography><Typography variant="h5">{sales.length}</Typography></Paper></Grid>
          <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Faturamento acumulado</Typography><Typography variant="h5">{formatCurrency(totalRevenue)}</Typography></Paper></Grid>
          <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Lucro acumulado</Typography><Typography variant="h5">{formatCurrency(totalProfit)}</Typography></Paper></Grid>
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <PageSection title="Vendas recentes" subtitle="Resumo das últimas operações concluídas.">
          <Stack spacing={1.5}>
            {feedback ? <Alert severity="success">{feedback}</Alert> : null}
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Buscar no histórico"
                  value={search}
                  onChange={(event) => {
                    updateListState({ search: event.target.value, page: 0 });
                  }}
                  placeholder="Produto, feira, observação ou pagamento"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="De" type="date" value={startDate} onChange={(event) => { updateListState({ startDate: event.target.value, page: 0 }); }} InputLabelProps={{ shrink: true }} fullWidth />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="Até" type="date" value={endDate} onChange={(event) => { updateListState({ endDate: event.target.value, page: 0 }); }} InputLabelProps={{ shrink: true }} fullWidth />
              </Grid>
              <Grid item xs={12} md={2}>
                <SearchSelectField
                  label="Categoria"
                  value={categoryFilter === 'all' ? '' : categoryFilter}
                  options={categoryOptions.map((category) => ({ id: category, name: category }))}
                  onChange={(value) => { updateListState({ categoryFilter: value || 'all', page: 0 }); }}
                  helperText="Digite para filtrar por categoria."
                  emptyText="Nenhuma categoria encontrada."
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="Produto" value={productSearch} onChange={(event) => { updateListState({ productSearch: event.target.value, page: 0 }); }} placeholder="Nome do produto" fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="Feira" value={fairSearch} onChange={(event) => { updateListState({ fairSearch: event.target.value, page: 0 }); }} placeholder="Nome da feira" fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField select label="Pagamento" value={paymentFilter} onChange={(event) => { updateListState({ paymentFilter: event.target.value, page: 0 }); }} fullWidth>
                  <MenuItem value="all">Todos</MenuItem>
                  {['Pix', 'CreditCard', 'DebitCard', 'Cash', 'Transfer'].map((method) => <MenuItem key={method} value={method}>{paymentMethodLabel(method)}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              {isLoadingSales ? <TableSkeleton rows={8} columns={7} /> : (
              <Table size="small" sx={{ minWidth: 920 }}>
                <TableHead>
                  <TableRow>
                    <TableCell><TableSortLabel active={sortField === 'soldAtUtc'} direction={sortField === 'soldAtUtc' ? sortDirection : 'asc'} onClick={() => handleSort('soldAtUtc')}>Data</TableSortLabel></TableCell>
                    <TableCell><TableSortLabel active={sortField === 'fairName'} direction={sortField === 'fairName' ? sortDirection : 'asc'} onClick={() => handleSort('fairName')}>Feira</TableSortLabel></TableCell>
                    <TableCell><TableSortLabel active={sortField === 'paymentMethod'} direction={sortField === 'paymentMethod' ? sortDirection : 'asc'} onClick={() => handleSort('paymentMethod')}>Pagamento</TableSortLabel></TableCell>
                    <TableCell>Itens</TableCell>
                    <TableCell><TableSortLabel active={sortField === 'totalAmount'} direction={sortField === 'totalAmount' ? sortDirection : 'asc'} onClick={() => handleSort('totalAmount')}>Total</TableSortLabel></TableCell>
                    <TableCell><TableSortLabel active={sortField === 'profitAmount'} direction={sortField === 'profitAmount' ? sortDirection : 'asc'} onClick={() => handleSort('profitAmount')}>Lucro</TableSortLabel></TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleSales.map((sale) => (
                    <TableRow key={sale.id} hover>
                      <TableCell>{formatUtcDate(sale.soldAtUtc)}</TableCell>
                      <TableCell>{sale.fairName ?? 'Venda direta'}</TableCell>
                      <TableCell>{paymentMethodLabel(sale.paymentMethod)}</TableCell>
                      <TableCell sx={{ maxWidth: 320, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {sale.items.map((item) => `${item.productName} x${item.quantity}`).join(', ')}
                      </TableCell>
                      <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                      <TableCell>{formatCurrency(sale.profitAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Detalhes">
                          <IconButton size="small" onClick={() => navigate(`/vendas/${sale.id}`, { state: { preserveState: true } })}>
                            <VisibilityRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {sale.canDelete ? (
                          <Tooltip title="Excluir">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setSaleToDelete(sale)}
                              disabled={deleteMutation.isLoading}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </Paper>
            {visibleSales.length === 0 ? <Alert severity="info">Nenhuma venda encontrada para o filtro informado.</Alert> : null}
            <TablePagination
              component="div"
              count={sortedSales.length}
              page={page}
              onPageChange={(_event, nextPage) => updateListState({ page: nextPage })}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                updateListState({ rowsPerPage: Number(event.target.value), page: 0 });
              }}
              rowsPerPageOptions={[5, 10, 20, 50]}
              labelRowsPerPage="Itens por página"
            />
          </Stack>
        </PageSection>
      </Grid>
      <ConfirmDialog
        open={saleToDelete !== null}
        title="Excluir venda"
        description={saleToDelete ? `Deseja excluir a venda de ${formatUtcDate(saleToDelete.soldAtUtc)} no valor de ${formatCurrency(saleToDelete.totalAmount)}?` : ''}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteMutation.isLoading}
        onCancel={() => setSaleToDelete(null)}
        onConfirm={() => {
          if (saleToDelete) {
            deleteMutation.mutate(saleToDelete.id);
          }
        }}
      />
    </Grid>
  );
}