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
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
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
import type { Product, ProductType } from '../services/types';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PRODUCT_TYPE_META: Record<ProductType, { label: string; color: string; background: string }> = {
  Impressao3D: { label: 'Impressão 3D', color: '#2f7d70', background: 'rgba(123, 207, 192, 0.22)' },
  Brinco: { label: 'Brinco', color: '#9a6b1f', background: 'rgba(225, 166, 87, 0.22)' },
  Botton: { label: 'Botton', color: '#a54b62', background: 'rgba(217, 107, 135, 0.18)' }
};

function TypeChip({ type }: { type: ProductType }) {
  const meta = PRODUCT_TYPE_META[type] ?? PRODUCT_TYPE_META.Impressao3D;
  return (
    <Chip
      label={meta.label}
      size="small"
      sx={{ height: 20, fontSize: 10.5, fontWeight: 800, color: meta.color, backgroundColor: meta.background, '& .MuiChip-label': { px: 0.75 } }}
    />
  );
}

function getProductTypeCaption(product: Product) {
  if (product.productType === 'Brinco') {
    return `Pingente: ${product.pingenteSupply ?? 'não definido'}`;
  }

  if (product.productType === 'Botton') {
    return `Tamanho: ${product.bottonSize ?? 'não definido'} • insumo em estoque: ${product.bottonSizeStockQuantity}`;
  }

  const printer = capitalizeFirstLetter(product.printer ?? 'Sem impressora');
  const filaments = (product.filaments ?? []).map((item) => capitalizeFirstLetter(item.filamentName)).join(', ') || 'Sem filamento';
  return `${printer} • ${filaments}`;
}

function getEstimatedProfit(product: Product) {
  return product.salePrice - product.costPrice;
}

function getMarginPercentage(product: Product) {
  if (product.salePrice <= 0) {
    return 0;
  }

  return ((product.salePrice - product.costPrice) / product.salePrice) * 100;
}

function getResellerCommissionPercentage(product: Product) {
  return product.commissionPercentage > 0 ? product.commissionPercentage : 20;
}

function getResellerPrice(product: Product) {
  const commissionRate = getResellerCommissionPercentage(product) / 100;
  if (product.salePrice <= 0 || commissionRate >= 1) {
    return 0;
  }

  return Number((product.salePrice / (1 - commissionRate)).toFixed(2));
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function MarginBar({ product }: { product: Product }) {
  const margin = getMarginPercentage(product);
  const profit = getEstimatedProfit(product);
  const width = Math.max(4, Math.min(100, Math.round(margin)));
  const barColor = profit < 0 ? '#d96b87' : margin < 35 ? '#e1a657' : '#7bcfc0';

  return (
    <Stack spacing={0.4} sx={{ minWidth: 116 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography fontSize={13} fontWeight={700} sx={{ color: profit < 0 ? '#c0566e' : '#4e7a34' }}>{formatCurrency(profit)}</Typography>
        <Typography fontSize={12} color="text.secondary">{Math.round(margin)}%</Typography>
      </Stack>
      <Box sx={{ height: 6, borderRadius: 999, backgroundColor: 'rgba(217,107,135,0.12)', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${width}%`, backgroundColor: barColor, borderRadius: 999 }} />
      </Box>
    </Stack>
  );
}

function KpiCard({ label, value, caption, alert }: { label: string; value: string; caption?: string; alert?: boolean }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderColor: alert ? 'rgba(217,107,135,0.4)' : 'rgba(217,107,135,0.16)', backgroundColor: 'rgba(255,255,255,0.6)' }}
    >
      <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'block' }}>{label}</Typography>
      <Typography sx={{ fontFamily: '"Baloo 2", "Nunito", sans-serif', fontWeight: 700, fontSize: '1.35rem', color: alert ? '#c0566e' : 'inherit' }}>{value}</Typography>
      {caption ? <Typography color="text.secondary" fontSize={11.5}>{caption}</Typography> : null}
    </Paper>
  );
}

type ProductSortField = 'name' | 'category' | 'supplier' | 'sku' | 'costPrice' | 'suggestedPrice' | 'salePrice' | 'profit';

const defaultListState = {
  search: '',
  scopeFilter: 'all',
  categoryFilter: 'all',
  typeFilter: 'all',
  page: 0,
  rowsPerPage: 10,
  sortField: 'name' as ProductSortField,
  sortDirection: 'asc' as 'asc' | 'desc'
};

export function ProductsPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const isReseller = session?.role === 'Reseller';
  const supplierId = session?.supplierId ?? '';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const isBudgetMode = location.pathname.startsWith('/orcamentos');
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [listState, setListState] = usePreservedListState(`products-page:${isBudgetMode ? 'budget' : 'product'}:${session?.role ?? 'guest'}:${session?.supplierId ?? 'store'}`, defaultListState);
  const { search, scopeFilter, categoryFilter, typeFilter, page, rowsPerPage, sortField, sortDirection } = listState;
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', isSupplier ? 'catalog' : 'all', isBudgetMode ? 'budget' : 'product'],
    queryFn: () => productsApi.getAll({ isBudget: isBudgetMode, includeAllForSupplier: isSupplier || undefined })
  });
  const { data: metadata } = useQuery({ queryKey: ['products-metadata'], queryFn: productsApi.getMetadata });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => productsApi.remove(id),
    onSuccess: (_result, deletedId) => {
      queryClient.setQueriesData(
        { queryKey: ['products'] },
        (current: Product[] | undefined) => (current ?? []).filter((product) => product.id !== deletedId)
      );
      setFeedback({ message: 'Produto excluido com sucesso.', severity: 'success' });
      setProductToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => {
      setFeedback({ message: 'Nao foi possivel excluir o produto selecionado.', severity: 'error' });
      setProductToDelete(null);
    }
  });
  const convertMutation = useMutation({
    mutationFn: async (id: string) => productsApi.convertToProduct(id),
    onSuccess: () => {
      setFeedback({ message: 'Orcamento transformado em produto com sucesso.', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => {
      setFeedback({ message: 'Nao foi possivel transformar o orcamento em produto.', severity: 'error' });
    }
  });

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesText = normalized.length === 0
        || product.name.toLowerCase().includes(normalized)
        || product.sku.toLowerCase().includes(normalized);
      const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter;
      const matchesType = !typeFilter || typeFilter === 'all' || product.productType === typeFilter;
      const matchesScope = scopeFilter === 'all'
        ? true
        : scopeFilter === 'store'
          ? !product.supplierId
          : product.supplierId === scopeFilter;
      return matchesText && matchesCategory && matchesType && matchesScope;
    });
  }, [categoryFilter, products, scopeFilter, search, typeFilter]);

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

  const showCatalogKpis = !isReseller && !isBudgetMode;
  const catalogKpis = useMemo(() => {
    const priced = products.filter((product) => product.salePrice > 0);
    return {
      active: products.length,
      stockValue: products.reduce((sum, product) => sum + product.currentStock * product.costPrice, 0),
      avgMargin: priced.length > 0 ? priced.reduce((sum, product) => sum + getMarginPercentage(product), 0) / priced.length : 0,
      withoutPrice: products.filter((product) => product.salePrice <= 0).length
    };
  }, [products]);

  function canManageProduct(product: Product) {
    if (isReseller) {
      return false;
    }

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
      {showCatalogKpis ? (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
          <KpiCard label="Produtos ativos" value={`${catalogKpis.active}`} caption={`${(metadata?.suppliers ?? []).length} fornecedores no catálogo`} />
          <KpiCard label="Valor de catálogo (custo)" value={formatCurrency(catalogKpis.stockValue)} caption="custo × estoque atual" />
          <KpiCard label="Margem média" value={`${Math.round(catalogKpis.avgMargin)}%`} caption="preço final vs. custo" />
          <KpiCard label="Sem preço definido" value={`${catalogKpis.withoutPrice}`} caption="usando preço sugerido" alert={catalogKpis.withoutPrice > 0} />
        </Box>
      ) : null}

      <PageSection title={isBudgetMode ? 'Orçamentos' : 'Produtos'} subtitle={isBudgetMode ? 'Orçamentos com estrutura de produto e conversão em um clique.' : 'Catálogo com custo, preço, margem e tipo de produção em uma leitura.'}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flex: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              label="Lista"
              value={scopeFilter}
              onChange={(event) => {
                updateListState({ scopeFilter: event.target.value, page: 0 });
              }}
              sx={{ minWidth: { xs: '100%', md: 180 } }}
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
              placeholder="Buscar por nome ou SKU"
              sx={{ flex: 1, minWidth: { xs: '100%', md: 200 } }}
              InputProps={{ startAdornment: <SearchRoundedIcon color="action" sx={{ mr: 1 }} /> }}
            />
            <Stack sx={{ minWidth: { xs: '100%', md: 200 } }}>
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
            <TextField
              select
              label="Tipo"
              value={typeFilter}
              onChange={(event) => {
                updateListState({ typeFilter: event.target.value, page: 0 });
              }}
              sx={{ minWidth: { xs: '100%', md: 160 } }}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="Impressao3D">Impressão 3D</MenuItem>
              <MenuItem value="Brinco">Brinco</MenuItem>
              <MenuItem value="Botton">Botton</MenuItem>
            </TextField>
          </Stack>
          {!isReseller ? (
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate(isBudgetMode ? '/orcamentos/novo' : '/produtos/novo', { state: { preserveState: true } })} sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}>
              {isBudgetMode ? 'Novo orçamento' : 'Novo produto'}
            </Button>
          ) : null}
        </Stack>

        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {filteredProducts.length} {isBudgetMode ? 'orçamento(s)' : 'produto(s)'} encontrado(s)
        </Typography>

        {feedback ? <Alert severity={feedback.severity} sx={{ mb: 2 }}>{feedback.message}</Alert> : null}
        {isLoading ? <TableSkeleton rows={8} columns={7} /> : isMobile ? (
          <Stack spacing={1.5}>
            {pagedProducts.map((product) => (
              <Paper key={product.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Stack spacing={1.2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={700}>{capitalizeFirstLetter(product.name)}</Typography>
                      <TypeChip type={product.productType} />
                    </Stack>
                    <Chip label={product.supplier ?? 'Lojinha'} size="small" color={product.supplier ? 'default' : 'primary'} />
                  </Stack>
                  <Typography color="text.secondary" fontSize={12.5}>{getProductTypeCaption(product)}</Typography>
                  <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap">
                    {renderCategoryWithColor(product)}
                  </Stack>
                  {isReseller ? (
                    <>
                      <Typography color="text.secondary">Preço para revenda: {formatCurrency(getResellerPrice(product))}</Typography>
                      <Typography color="text.secondary">Comissão aplicada: {getResellerCommissionPercentage(product).toFixed(2)}%</Typography>
                    </>
                  ) : (
                    <>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, textAlign: 'center' }}>
                        {[
                          { label: 'Custo', value: formatCurrency(product.costPrice) },
                          { label: 'Preço final', value: formatCurrency(product.salePrice), highlight: true },
                          { label: 'Comiss.', value: formatCurrency(product.commissionedSalePrice) }
                        ].map((cell) => (
                          <Box key={cell.label} sx={{ border: '1px solid rgba(217,107,135,0.14)', borderRadius: 2, p: 0.75, backgroundColor: 'rgba(255,255,255,0.6)' }}>
                            <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: 9.5, lineHeight: 1.4, display: 'block' }}>{cell.label}</Typography>
                            <Typography sx={{ fontFamily: '"Baloo 2", "Nunito", sans-serif', fontWeight: 700, fontSize: 14, color: cell.highlight ? '#a54b62' : 'inherit' }}>{cell.value}</Typography>
                          </Box>
                        ))}
                      </Box>
                      <MarginBar product={product} />
                    </>
                  )}
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {!isBudgetMode ? (
                      <IconButton color="default" onClick={() => navigate(`/produtos/${product.id}`, { state: { preserveState: true } })} title="Ver detalhes">
                        <OpenInNewRoundedIcon />
                      </IconButton>
                    ) : null}
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
          <Paper sx={{ overflowX: 'hidden', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '26%' }}>{renderSortLabel('name', 'Produto')}</TableCell>
                  <TableCell sx={{ width: '12%', whiteSpace: 'nowrap' }}>{renderSortLabel('category', 'Categoria')}</TableCell>
                  <TableCell sx={{ width: '14%', whiteSpace: 'nowrap' }}>{renderSortLabel('supplier', 'Fornecedor')}</TableCell>
                  {isReseller ? (
                    <TableCell sx={{ width: '16%', whiteSpace: 'nowrap' }}>Preço revenda</TableCell>
                  ) : (
                    <>
                      <TableCell sx={{ width: '15%', whiteSpace: 'nowrap' }}>Custo / sugerido</TableCell>
                      <TableCell sx={{ width: '10%', whiteSpace: 'nowrap' }}>{renderSortLabel('salePrice', 'Preço final')}</TableCell>
                      <TableCell sx={{ width: '10%', whiteSpace: 'nowrap' }}>Preço comiss.</TableCell>
                      <TableCell sx={{ width: '13%', whiteSpace: 'nowrap' }}>{renderSortLabel('profit', 'Lucro & margem')}</TableCell>
                    </>
                  )}
                  {!isReseller ? <TableCell align="right" sx={{ width: '14%', whiteSpace: 'nowrap' }}>Ações</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedProducts.map((product) => {
                  const caption = getProductTypeCaption(product);
                  return (
                    <TableRow key={product.id} hover>
                      <TableCell sx={{ maxWidth: 0, pr: 1.5 }}>
                        <Stack spacing={0.5}>
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                            <Typography fontWeight={700} noWrap title={product.name}>{truncateText(product.name, 26)}</Typography>
                            <TypeChip type={product.productType} />
                          </Stack>
                          <Typography color="text.secondary" fontSize={13} noWrap title={caption}>{caption}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{renderCategoryWithColor(product)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }} title={capitalizeFirstLetter(product.supplier ?? 'Lojinha Sem Nome')}>{truncateText(capitalizeFirstLetter(product.supplier ?? 'Lojinha Sem Nome'), 20)}</TableCell>
                      {isReseller ? (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(getResellerPrice(product))}</TableCell>
                      ) : (
                        <>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Stack spacing={0.15}>
                              <Typography fontSize={13}>C: {formatCurrency(product.costPrice)}</Typography>
                              <Typography fontSize={13} color="text.secondary">S: {formatCurrency(product.suggestedPrice)}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(product.salePrice)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(product.commissionedSalePrice)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}><MarginBar product={product} /></TableCell>
                        </>
                      )}
                      {!isReseller ? (
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', pl: 0.5, pr: 0.5 }}>
                          {canManageProduct(product) ? (
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ flexWrap: 'nowrap' }}>
                              {!isBudgetMode ? (
                                <Tooltip title="Ver detalhes">
                                  <IconButton
                                    size="small"
                                    color="default"
                                    onClick={() => navigate(`/produtos/${product.id}`, { state: { preserveState: true } })}
                                    sx={{ border: '1px solid rgba(121, 99, 88, 0.25)', borderRadius: 1.5 }}
                                  >
                                    <OpenInNewRoundedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                              <Tooltip title={isBudgetMode ? 'Duplicar orçamento' : 'Duplicar produto'}>
                                <IconButton
                                  size="small"
                                  color="default"
                                  onClick={() => navigate(`${isBudgetMode ? '/orcamentos/novo' : '/produtos/novo'}?clonar=${product.id}`, { state: { preserveState: true } })}
                                  sx={{ border: '1px solid rgba(121, 99, 88, 0.25)', borderRadius: 1.5 }}
                                >
                                  <ContentCopyRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Editar">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => navigate(`${isBudgetMode ? '/orcamentos' : '/produtos'}/${product.id}/editar`, { state: { preserveState: true } })}
                                  sx={{ border: '1px solid rgba(217, 107, 135, 0.35)', borderRadius: 1.5 }}
                                >
                                  <EditRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {isBudgetMode ? (
                                <Tooltip title="Transformar em produto">
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="success"
                                      onClick={() => convertMutation.mutate(product.id)}
                                      disabled={convertMutation.isLoading}
                                      sx={{ border: '1px solid rgba(123, 207, 192, 0.45)', borderRadius: 1.5 }}
                                    >
                                      <SyncAltRoundedIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : null}
                              <Tooltip title="Excluir">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setProductToDelete(product)}
                                  sx={{ border: '1px solid rgba(211, 47, 47, 0.3)', borderRadius: 1.5 }}
                                >
                                  <DeleteOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
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
