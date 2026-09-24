import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageSection } from '../../components/PageSection';
import { paintingPricingApi, type PaintingResource } from '../../services/api';
import { getErrorMessage, paintingHistoryQueryKey, paintingPricingQueryKey } from './paintingPricingShared';

export interface PaintingCrudColumn<T> {
  label: string;
  render: (item: T) => React.ReactNode;
  sortValue?: (item: T) => string | number;
  align?: 'left' | 'right';
}

interface PaintingCrudTabProps<T extends { id: string; name: string; isActive: boolean }, F extends { isActive: boolean }> {
  title: string;
  subtitle: string;
  resource: PaintingResource;
  itemLabel: string;
  newLabel: string;
  items: T[];
  columns: PaintingCrudColumn<T>[];
  searchText: (item: T) => string;
  emptyForm: F;
  toForm: (item: T) => F;
  toPayload: (form: F) => Record<string, unknown>;
  renderForm: (form: F, setForm: (form: F) => void) => React.ReactNode;
  validate?: (form: F) => string | null;
  canEdit: boolean;
  headerNote?: React.ReactNode;
}

type StatusFilter = 'all' | 'active' | 'inactive';

const pageSize = 8;

export function PaintingCrudTab<T extends { id: string; name: string; isActive: boolean }, F extends { isActive: boolean }>({
  title,
  subtitle,
  resource,
  itemLabel,
  newLabel,
  items,
  columns,
  searchText,
  emptyForm,
  toForm,
  toPayload,
  renderForm,
  validate,
  canEdit,
  headerNote
}: PaintingCrudTabProps<T, F>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ column: number; direction: 'asc' | 'desc' } | null>(null);
  const [form, setForm] = useState<F>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<T | null>(null);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'warning'; message: string } | null>(null);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (status === 'active' && !item.isActive) {
        return false;
      }

      if (status === 'inactive' && item.isActive) {
        return false;
      }

      return !term || searchText(item).toLowerCase().includes(term);
    });

    const sortValue = sort ? columns[sort.column]?.sortValue : undefined;
    if (!sort || !sortValue) {
      return filtered;
    }

    return [...filtered].sort((left, right) => {
      const a = sortValue(left);
      const b = sortValue(right);
      const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'pt-BR');
      return sort.direction === 'asc' ? result : -result;
    });
  }, [columns, items, search, searchText, sort, status]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: paintingPricingQueryKey });
    await queryClient.invalidateQueries({ queryKey: paintingHistoryQueryKey });
  }

  const saveMutation = useMutation({
    mutationFn: async () => editingId
      ? paintingPricingApi.update(resource, editingId, toPayload(form))
      : paintingPricingApi.create(resource, toPayload(form)),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: editingId ? `${itemLabel} atualizado.` : `${itemLabel} cadastrado.` });
      closeDialog();
      await refresh();
    },
    onError: (error) => setDialogError(getErrorMessage(error, `Não foi possível salvar o ${itemLabel.toLowerCase()}.`))
  });

  const toggleMutation = useMutation({
    mutationFn: async (item: T) => paintingPricingApi.update(resource, item.id, toPayload({ ...toForm(item), isActive: !item.isActive })),
    onSuccess: refresh,
    onError: (error) => setFeedback({ severity: 'warning', message: getErrorMessage(error, 'Não foi possível alterar o status.') })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => paintingPricingApi.remove(resource, id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: `${itemLabel} excluído.` });
      setItemToDelete(null);
      await refresh();
    },
    onError: (error) => {
      setItemToDelete(null);
      setFeedback({ severity: 'warning', message: getErrorMessage(error, `Não foi possível excluir o ${itemLabel.toLowerCase()}.`) });
    }
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogError(null);
    setIsDialogOpen(true);
  }

  function openEdit(item: T) {
    setEditingId(item.id);
    setForm(toForm(item));
    setDialogError(null);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setDialogError(null);
  }

  function handleSave() {
    const validationError = validate?.(form) ?? null;
    if (validationError) {
      setDialogError(validationError);
      return;
    }

    saveMutation.mutate();
  }

  function toggleSort(columnIndex: number) {
    setSort((current) => {
      if (!current || current.column !== columnIndex) {
        return { column: columnIndex, direction: 'asc' };
      }

      return current.direction === 'asc' ? { column: columnIndex, direction: 'desc' } : null;
    });
  }

  const statusSwitch = (item: T) => (
    <Switch
      checked={item.isActive}
      onChange={() => toggleMutation.mutate(item)}
      disabled={!canEdit || toggleMutation.isLoading}
      inputProps={{ 'aria-label': item.isActive ? `Inativar ${item.name}` : `Ativar ${item.name}` }}
    />
  );

  const actions = (item: T) => (
    <>
      <IconButton color="primary" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}><EditRoundedIcon /></IconButton>
      <IconButton color="error" onClick={() => setItemToDelete(item)} aria-label={`Excluir ${item.name}`}><DeleteOutlineRoundedIcon /></IconButton>
    </>
  );

  return (
    <PageSection
      title={title}
      subtitle={subtitle}
      action={canEdit ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>{newLabel}</Button> : undefined}
    >
      <Stack spacing={2}>
        {headerNote}
        {feedback ? <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.message}</Alert> : null}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 180px' } }}>
          <TextField label="Buscar" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome ou descrição" />
          <TextField select label="Status" value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }}>
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="active">Ativos</MenuItem>
            <MenuItem value="inactive">Inativos</MenuItem>
          </TextField>
        </Box>

        {isMobile ? (
          <Stack spacing={1.5}>
            {visibleItems.map((item) => (
              <Paper key={item.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)', opacity: item.isActive ? 1 : 0.7 }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography fontWeight={700}>{item.name}</Typography>
                    <Chip size="small" label={item.isActive ? 'Ativo' : 'Inativo'} color={item.isActive ? 'success' : 'default'} />
                  </Stack>
                  {columns.slice(1).map((column) => (
                    <Stack key={column.label} direction="row" justifyContent="space-between" spacing={2}>
                      <Typography color="text.secondary" variant="body2">{column.label}</Typography>
                      <Typography variant="body2" fontWeight={600} textAlign="right">{column.render(item)}</Typography>
                    </Stack>
                  ))}
                  {canEdit ? (
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      {statusSwitch(item)}
                      <Box>{actions(item)}</Box>
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  {columns.map((column, index) => (
                    <TableCell key={column.label} align={column.align} sx={{ whiteSpace: 'nowrap' }}>
                      {column.sortValue ? (
                        <TableSortLabel active={sort?.column === index} direction={sort?.column === index ? sort.direction : 'asc'} onClick={() => toggleSort(index)}>
                          {column.label}
                        </TableSortLabel>
                      ) : column.label}
                    </TableCell>
                  ))}
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Ativo</TableCell>
                  {canEdit ? <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 3 }}>Ações</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleItems.map((item) => (
                  <TableRow key={item.id} hover sx={{ opacity: item.isActive ? 1 : 0.6 }}>
                    {columns.map((column) => (
                      <TableCell key={column.label} align={column.align} sx={{ py: 1.25 }}>{column.render(item)}</TableCell>
                    ))}
                    <TableCell sx={{ py: 1.25 }}>{statusSwitch(item)}</TableCell>
                    {canEdit ? <TableCell align="right" sx={{ py: 1.25, pr: 2, whiteSpace: 'nowrap' }}>{actions(item)}</TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {visibleItems.length === 0 ? <Alert severity="info">Nenhum registro encontrado.</Alert> : null}
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
          <Typography color="text.secondary">Mostrando {visibleItems.length} de {filteredItems.length}</Typography>
          <Pagination page={currentPage} count={pageCount} onChange={(_, value) => setPage(value)} />
        </Stack>
      </Stack>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title={`Excluir ${itemLabel.toLowerCase()}`}
        description={`Deseja excluir "${itemToDelete?.name ?? ''}"? Para apenas deixar de usar em novos cálculos, prefira inativar.`}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteMutation.isLoading}
        onCancel={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
      />

      <Dialog open={isDialogOpen} onClose={closeDialog} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>{editingId ? `Editar ${itemLabel.toLowerCase()}` : newLabel}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {dialogError ? <Alert severity="warning">{dialogError}</Alert> : null}
            {renderForm(form, setForm)}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={closeDialog}>Cancelar</Button>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={handleSave} disabled={saveMutation.isLoading}>
            {saveMutation.isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageSection>
  );
}
