import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Chip,
  Box,
  IconButton,
  MenuItem,
  Paper,
  TablePagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SyncAltRoundedIcon from '@mui/icons-material/SyncAltRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchSelectField } from '../components/SearchSelectField';
import { TableSkeleton } from '../components/TableSkeleton';
import { useAuth } from '../hooks/useAuth';
import { usePreservedListState } from '../hooks/useSessionState';
import { PageSection } from '../components/PageSection';
import { categoriesApi, productsApi } from '../services/api';
import { capitalizeFirstLetter } from '../services/text';
import type { Product } from '../services/types';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getEstimatedProfit(product: Product) {
  return product.salePrice - product.costPrice;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

type ProductSortField = 'name' | 'category' | 'supplier' | 'sku' | 'costPrice' | 'suggestedPrice' | 'salePrice' | 'profit';

const defaultListState = {
  search: '',
  scopeFilter: 'all',
  categoryFilter: 'all',
  page: 0,
  rowsPerPage: 10,
  sortField: 'name' as ProductSortField,
  sortDirection: 'asc' as 'asc' | 'desc'
};

export function ProductsPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const supplierId = session?.supplierId ?? '';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const isBudgetMode = location.pathname.startsWith('/orcamentos');
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [listState, setListState] = usePreservedListState(`products-page:${isBudgetMode ? 'budget' : 'product'}:${session?.role ?? 'guest'}:${session?.supplierId ?? 'store'}`, defaultListState);
  const { search, scopeFilter, categoryFilter, page, rowsPerPage, sortField, sortDirection } = listState;
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', isSupplier ? 'catalog' : 'all', isBudgetMode ? 'budget' : 'product'],
    queryFn: () => isSupplier ? productsApi.getAll({ isBudget: isBudgetMode }) : productsApi.getAll({ isBudget: isBudgetMode })
  });
  const { data: metadata } = useQuery({ queryKey: ['products-metadata'], queryFn: productsApi.getMetadata });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => productsApi.remove(id),
    onSuccess: () => {
      setFeedback('Produto excluido com sucesso.');
      setProductToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => {
      setFeedback('Nao foi possivel excluir o produto selecionado.');
    }
  });
  const convertMutation = useMutation({
    mutationFn: async (id: string) => productsApi.convertToProduct(id),
    onSuccess: () => {
      setFeedback('Orcamento transformado em produto com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => {
      setFeedback('Nao foi possivel transformar o orcamento em produto.');
    }
  });

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesText = normalized.length === 0
        || product.name.toLowerCase().includes(normalized)
        || product.sku.toLowerCase().includes(normalized)
        || product.category.toLowerCase().includes(normalized)
        || (product.supplier ?? '').toLowerCase().includes(normalized);
      const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter;
      const matchesScope = scopeFilter === 'all'
        ? true
        : scopeFilter === 'store'
          ? !product.supplierId
          : product.supplierId === scopeFilter;
      return matchesText && matchesCategory && matchesScope;
    });
  }, [categoryFilter, products, scopeFilter, search]);

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts];
    sorted.sort((left, right) => {
      const leftValue = sortField === 'profit'
        ? getEstimatedProfit(left)
        : sortField === 'supplier'
          ? left.supplier ?? 'Lojinha Sem Nome'
          : left[sortField];
      const rightValue = sortField === 'profit'
        ? getEstimatedProfit(right)
        : sortField === 'supplier'
          ? right.supplier ?? 'Lojinha Sem Nome'
          : right[sortField];

      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'pt-BR');

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredProducts, sortDirection, sortField]);

  const pagedProducts = useMemo(
    () => sortedProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [page, rowsPerPage, sortedProducts]
  );
  const categoryColorsById = useMemo(
    () => new Map(categories.map((item) => [item.id, item.colorHex])),
    [categories]
  );

  function canManageProduct(product: Product) {
    return !isSupplier || product.supplierId === supplierId;
  }

  function updateListState(patch: Partial<typeof defaultListState>) {
    setListState((current) => ({ ...current, ...patch }));
  }

  function handleSort(field: ProductSortField) {
    updateListState({
      sortField: field,
      sortDirection: sortField === field && sortDirection === 'asc' ? 'desc' : 'asc',
      page: 0
    });
  }

  function renderSortLabel(field: ProductSortField, label: string) {
    return (
      <TableSortLabel active={sortField === field} direction={sortField === field ? sortDirection : 'asc'} onClick={() => handleSort(field)}>
        {label}
      </TableSortLabel>
    );
  }

  function renderCategoryWithColor(product: Product) {
    const categoryColor = categoryColorsById.get(product.categoryId) ?? '#b7a094';

    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: categoryColor, flexShrink: 0 }} />
        <Typography>{capitalizeFirstLetter(product.category)}</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageSection title={isBudgetMode ? 'Orçamentos' : 'Produtos'} subtitle={isBudgetMode ? 'Orçamentos com estrutura de produto e conversão em um clique.' : 'Catálogo com busca, filtro por categoria e paginação.'}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flex: 1 }}>
            <TextField
              select
              label="Lista"
              value={scopeFilter}
              onChange={(event) => {
                updateListState({ scopeFilter: event.target.value, page: 0 });
              }}
              sx={{ minWidth: { xs: '100%', md: 220 } }}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="store">Lojinha Sem Nome</MenuItem>
              {(metadata?.suppliers ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
            </TextField>
            <TextField
              value={search}
              onChange={(event) => {
                updateListState({ search: event.target.value, page: 0 });
              }}
              placeholder="Buscar por nome, SKU ou categoria"
              fullWidth
              InputProps={{ startAdornment: <SearchRoundedIcon color="action" sx={{ mr: 1 }} /> }}
            />
            <Stack sx={{ minWidth: { xs: '100%', md: 220 } }}>
              <SearchSelectField
                label="Categoria"
                value={categoryFilter === 'all' ? '' : categoryFilter}
                options={(metadata?.categories ?? []).map((item) => ({ id: item.id, name: item.name }))}
                onChange={(value) => {
                  updateListState({ categoryFilter: value || 'all', page: 0 });
                }}
                helperText="Digite para filtrar por categoria."
                emptyText="Nenhuma categoria encontrada."
              />
            </Stack>
          </Stack>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate(isBudgetMode ? '/orcamentos/novo' : '/produtos/novo', { state: { preserveState: true } })}>
            {isBudgetMode ? 'Novo orçamento' : 'Novo produto'}
          </Button>
        </Stack>

        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {filteredProducts.length} {isBudgetMode ? 'orçamento(s)' : 'produto(s)'} encontrado(s)
        </Typography>

          {feedback ? <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert> : null}
          {isLoading ? <TableSkeleton rows={8} columns={7} /> : isMobile ? (
            <Stack spacing={1.5}>
              {pagedProducts.map((product) => (
                <Paper key={product.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                  <Stack spacing={1.2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography fontWeight={700}>{capitalizeFirstLetter(product.name)}</Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        <Chip label={product.supplier ?? 'Lojinha'} size="small" color={product.supplier ? 'default' : 'primary'} />
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap">
                      {renderCategoryWithColor(product)}
                    </Stack>
                    <Typography color="text.secondary">Custo / sugerido: {formatCurrency(product.costPrice)} / {formatCurrency(product.suggestedPrice)}</Typography>
                    <Typography color="text.secondary">Final: {formatCurrency(product.salePrice)}</Typography>
                    <Typography color="text.secondary">Lucro estimado: {formatCurrency(getEstimatedProfit(product))}</Typography>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {canManageProduct(product) ? (
                        <>
                          <IconButton color="default" onClick={() => navigate(`${isBudgetMode ? '/orcamentos/novo' : '/produtos/novo'}?clonar=${product.id}`, { state: { preserveState: true } })} title={isBudgetMode ? 'Duplicar orçamento' : 'Duplicar produto'}>
                            <ContentCopyRoundedIcon />
                          </IconButton>
                          <IconButton color="primary" onClick={() => navigate(`${isBudgetMode ? '/orcamentos' : '/produtos'}/${product.id}/editar`, { state: { preserveState: true } })}>
                            <EditRoundedIcon />
                          </IconButton>
                          {isBudgetMode ? (
                            <Tooltip title="Transformar em produto">
                              <span>
                                <IconButton color="success" onClick={() => convertMutation.mutate(product.id)} disabled={convertMutation.isLoading}>
                                  <SyncAltRoundedIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : null}
                          <IconButton color="error" onClick={() => setProductToDelete(product)}>
                            <DeleteOutlineRoundedIcon />
                          </IconButton>
                        </>
                      ) : null}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '24%' }}>{renderSortLabel('name', 'Produto')}</TableCell>
                    <TableCell sx={{ width: '12%', whiteSpace: 'nowrap' }}>{renderSortLabel('category', 'Categoria')}</TableCell>
                    <TableCell sx={{ width: '17%', whiteSpace: 'nowrap' }}>{renderSortLabel('supplier', 'Fornecedor')}</TableCell>
                    <TableCell sx={{ width: '16%', whiteSpace: 'nowrap' }}>Custo / sugerido</TableCell>
                    <TableCell sx={{ width: '11%', whiteSpace: 'nowrap' }}>{renderSortLabel('salePrice', 'Preço final')}</TableCell>
                    <TableCell sx={{ width: '11%', whiteSpace: 'nowrap' }}>{renderSortLabel('profit', 'Lucro estimado')}</TableCell>
                    <TableCell align="right" sx={{ width: '9%', whiteSpace: 'nowrap' }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedProducts.map((product) => (
                    <TableRow key={product.id} hover>
                      <TableCell sx={{ maxWidth: 0, pr: 1.5 }}>
                        <Stack spacing={0.5}>
                          <Typography fontWeight={700} noWrap title={product.name}>{truncateText(product.name, 34)}</Typography>
                          <Typography color="text.secondary" fontSize={13} noWrap title={`${capitalizeFirstLetter(product.printer ?? 'Sem impressora')} • ${(product.filaments ?? []).map((f) => capitalizeFirstLetter(f.filamentName)).join(', ') || 'Sem filamento'}`}>{truncateText(`${capitalizeFirstLetter(product.printer ?? 'Sem impressora')} • ${(product.filaments ?? []).map((f) => capitalizeFirstLetter(f.filamentName)).join(', ') || 'Sem filamento'}`, 44)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{renderCategoryWithColor(product)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }} title={capitalizeFirstLetter(product.supplier ?? 'Lojinha Sem Nome')}>{truncateText(capitalizeFirstLetter(product.supplier ?? 'Lojinha Sem Nome'), 22)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Stack spacing={0.15}>
                          <Typography fontSize={13}>C: {formatCurrency(product.costPrice)}</Typography>
                          <Typography fontSize={13} color="text.secondary">S: {formatCurrency(product.suggestedPrice)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(product.salePrice)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(getEstimatedProfit(product))}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', pl: 0.5, pr: 0.5 }}>
                        {canManageProduct(product) ? (
                          <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                            <IconButton size="small" color="default" onClick={() => navigate(`${isBudgetMode ? '/orcamentos/novo' : '/produtos/novo'}?clonar=${product.id}`, { state: { preserveState: true } })} title={isBudgetMode ? 'Duplicar orçamento' : 'Duplicar produto'}>
                              <ContentCopyRoundedIcon />
                            </IconButton>
                            <IconButton size="small" color="primary" onClick={() => navigate(`${isBudgetMode ? '/orcamentos' : '/produtos'}/${product.id}/editar`, { state: { preserveState: true } })}>
                              <EditRoundedIcon />
                            </IconButton>
                            {isBudgetMode ? (
                              <Tooltip title="Transformar em produto">
                                <span>
                                  <IconButton size="small" color="success" onClick={() => convertMutation.mutate(product.id)} disabled={convertMutation.isLoading}>
                                    <SyncAltRoundedIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : null}
                            <IconButton size="small" color="error" onClick={() => setProductToDelete(product)}>
                              <DeleteOutlineRoundedIcon />
                            </IconButton>
                          </Stack>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
          <TablePagination
            component="div"
            count={sortedProducts.length}
            page={page}
            onPageChange={(_event, nextPage) => updateListState({ page: nextPage })}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              updateListState({ rowsPerPage: Number(event.target.value), page: 0 });
            }}
            rowsPerPageOptions={[5, 10, 20, 50]}
            labelRowsPerPage="Itens por página"
          />
        </PageSection>
      <ConfirmDialog
        open={productToDelete !== null}
        title={isBudgetMode ? 'Excluir orçamento' : 'Excluir produto'}
        description={productToDelete ? `Deseja excluir o ${isBudgetMode ? 'orçamento' : 'produto'} ${productToDelete.name}? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteMutation.isLoading}
        onCancel={() => setProductToDelete(null)}
        onConfirm={() => {
          if (productToDelete) {
            deleteMutation.mutate(productToDelete.id);
          }
        }}
      />
    </Stack>
  );
}