import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageSection } from '../components/PageSection';
import { TableSkeleton } from '../components/TableSkeleton';
import { usePreservedListState } from '../hooks/useSessionState';
import { outsourcedProductionsApi } from '../services/api';
import type { OutsourcedProduction } from '../services/types';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type SortField = 'name' | 'producerSupplier' | 'ownerSupplier' | 'productionCost' | 'supplierCost' | 'productionFeePercentage';

const defaultListState = {
  search: '',
  statusFilter: 'all',
  page: 0,
  rowsPerPage: 10,
  sortField: 'name' as SortField,
  sortDirection: 'asc' as 'asc' | 'desc'
};

export function OutsourcedProductionListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [toDelete, setToDelete] = useState<OutsourcedProduction | null>(null);

  const [listState, setListState] = usePreservedListState('outsourced-productions-page', defaultListState);
  const { search, statusFilter, page, rowsPerPage, sortField, sortDirection } = listState;

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['outsourced-productions'],
    queryFn: outsourcedProductionsApi.getAll
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => outsourcedProductionsApi.remove(id),
    onSuccess: (_r, deletedId) => {
      queryClient.setQueryData<OutsourcedProduction[]>(['outsourced-productions'], (cur) => (cur ?? []).filter((p) => p.id !== deletedId));
      setFeedback({ msg: 'Produção excluída com sucesso.', type: 'success' });
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['outsourced-productions'] });
    },
    onError: () => {
      setFeedback({ msg: 'Não foi possível excluir a produção.', type: 'error' });
      setToDelete(null);
    }
  });

  function updateListState(patch: Partial<typeof defaultListState>) {
    setListState((cur) => ({ ...cur, ...patch }));
  }

  function handleSort(field: SortField) {
    updateListState({
      sortField: field,
      sortDirection: sortField === field && sortDirection === 'asc' ? 'desc' : 'asc',
      page: 0
    });
  }

  function sortLabel(field: SortField, label: string) {
    return (
      <TableSortLabel active={sortField === field} direction={sortField === field ? sortDirection : 'asc'} onClick={() => handleSort(field)}>
        {label}
      </TableSortLabel>
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productions.filter((p) => {
      const matchesText = !q || p.name.toLowerCase().includes(q) || (p.producerSupplier ?? '').toLowerCase().includes(q) || (p.ownerSupplier ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [productions, search, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'pt-BR');
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDirection]);

  const paged = useMemo(() => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [sorted, page, rowsPerPage]);

  return (
    <Stack spacing={3}>
      <PageSection title="Produção Terceirizada" subtitle="Produções com custo compartilhado entre fornecedores.">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flex: 1 }}>
            <TextField
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => updateListState({ statusFilter: e.target.value, page: 0 })}
              sx={{ minWidth: { xs: '100%', md: 180 } }}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="Pendente">Pendente</MenuItem>
              <MenuItem value="ConvertidoEmProduto">Convertido em produto</MenuItem>
              <MenuItem value="Cancelado">Cancelado</MenuItem>
            </TextField>
            <TextField
              value={search}
              onChange={(e) => updateListState({ search: e.target.value, page: 0 })}
              placeholder="Buscar por nome, produtor ou destinatário"
              fullWidth
              InputProps={{ startAdornment: <SearchRoundedIcon color="action" sx={{ mr: 1 }} /> }}
            />
          </Stack>
          <Button component={RouterLink} to="/producao-terceirizada/nova" variant="contained" startIcon={<AddRoundedIcon />}>
            Nova Produção
          </Button>
        </Stack>

        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {filtered.length} produção(ões) encontrada(s)
        </Typography>

        {feedback && <Alert severity={feedback.type} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>{feedback.msg}</Alert>}

        {isLoading ? <TableSkeleton rows={6} columns={7} /> : isMobile ? (
          <Stack spacing={1.5}>
            {paged.map((p) => (
              <Paper key={p.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Stack spacing={1}>
                  <Typography fontWeight={700}>{p.name}</Typography>
                  {p.category && <Typography fontSize={13} color="text.secondary">{p.category}</Typography>}
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Typography fontSize={13} color="text.secondary">Produtor: {p.producerSupplier}</Typography>
                    <Typography fontSize={13} color="text.secondary">Destinatário: {p.ownerSupplier}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Typography fontSize={13}>Custo produção: {formatCurrency(p.productionCost)}</Typography>
                    <Typography fontSize={13} fontWeight={600} color="primary.main">Custo fornecedor: {formatCurrency(p.supplierCost)}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Ver detalhes">
                      <IconButton size="small" onClick={() => navigate(`/producao-terceirizada/${p.id}`)} sx={{ border: '1px solid rgba(121,99,88,0.25)', borderRadius: 1.5 }}>
                        <OpenInNewRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {p.status === 'Pendente' && (
                      <>
                        <Tooltip title="Editar">
                          <IconButton size="small" color="primary" onClick={() => navigate(`/producao-terceirizada/${p.id}/editar`)} sx={{ border: '1px solid rgba(217,107,135,0.35)', borderRadius: 1.5 }}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton size="small" color="error" onClick={() => setToDelete(p)} sx={{ border: '1px solid rgba(211,47,47,0.3)', borderRadius: 1.5 }}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
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
                  <TableCell sx={{ width: '26%' }}>{sortLabel('name', 'Produção')}</TableCell>
                  <TableCell sx={{ width: '17%' }}>{sortLabel('producerSupplier', 'Produtor')}</TableCell>
                  <TableCell sx={{ width: '17%' }}>{sortLabel('ownerSupplier', 'Destinatário')}</TableCell>
                  <TableCell sx={{ width: '14%', whiteSpace: 'nowrap' }} align="right">{sortLabel('productionCost', 'Custo produção')}</TableCell>
                  <TableCell sx={{ width: '14%', whiteSpace: 'nowrap' }} align="right">{sortLabel('supplierCost', 'Custo fornecedor')}</TableCell>
                  <TableCell sx={{ width: '8%', whiteSpace: 'nowrap' }} align="center">{sortLabel('productionFeePercentage', 'Taxa')}</TableCell>
                  <TableCell sx={{ width: '4%' }} align="right"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Box py={4} textAlign="center">
                        <Typography color="text.secondary">Nenhuma produção terceirizada encontrada.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : paged.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ maxWidth: 0, pr: 1.5 }}>
                      <Typography fontWeight={700} noWrap title={p.name}>{p.name}</Typography>
                      {p.category && <Typography fontSize={12} color="text.secondary" noWrap>{p.category}</Typography>}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }} title={p.producerSupplier}>{p.producerSupplier}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }} title={p.ownerSupplier}>{p.ownerSupplier}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(p.productionCost)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700, color: 'primary.main' }}>{formatCurrency(p.supplierCost)}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{p.productionFeePercentage}%</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', pl: 0.5, pr: 0.5 }}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ flexWrap: 'nowrap' }}>
                        <Tooltip title="Ver detalhes">
                          <IconButton size="small" onClick={() => navigate(`/producao-terceirizada/${p.id}`)} sx={{ border: '1px solid rgba(121,99,88,0.25)', borderRadius: 1.5 }}>
                            <OpenInNewRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {p.status === 'Pendente' && (
                          <>
                            <Tooltip title="Editar">
                              <IconButton size="small" color="primary" onClick={() => navigate(`/producao-terceirizada/${p.id}/editar`)} sx={{ border: '1px solid rgba(217,107,135,0.35)', borderRadius: 1.5 }}>
                                <EditRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Excluir">
                              <IconButton size="small" color="error" onClick={() => setToDelete(p)} sx={{ border: '1px solid rgba(211,47,47,0.3)', borderRadius: 1.5 }}>
                                <DeleteOutlineRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        <TablePagination
          component="div"
          count={sorted.length}
          page={page}
          onPageChange={(_e, next) => updateListState({ page: next })}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => updateListState({ rowsPerPage: Number(e.target.value), page: 0 })}
          rowsPerPageOptions={[5, 10, 20, 50]}
          labelRowsPerPage="Itens por página"
        />
      </PageSection>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir produção"
        description={toDelete ? `Deseja excluir "${toDelete.name}"? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteMutation.isLoading}
        onCancel={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) deleteMutation.mutate(toDelete.id); }}
      />
    </Stack>
  );
}
