import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Pagination, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CurrencyField } from '../components/CurrencyField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { bottonSizesApi } from '../services/api';
import { capitalizeFirstLetter } from '../services/text';

const emptyForm = {
  id: '',
  name: '',
  costPerUnit: 0,
  stockQuantity: 0,
  minimumStock: 0,
  notes: ''
};

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function BottonSizesPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pageSize = 6;
  const queryClient = useQueryClient();
  const { data: bottonSizes = [] } = useQuery({ queryKey: ['botton-sizes'], queryFn: bottonSizesApi.getAll });
  const [form, setForm] = useState(emptyForm);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'warning'; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sizeToDelete, setSizeToDelete] = useState<{ id: string; name: string } | null>(null);
  const isEditing = useMemo(() => Boolean(form.id), [form.id]);

  const filteredSizes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return bottonSizes;
    }

    return bottonSizes.filter((size) => [size.name, size.notes].join(' ').toLowerCase().includes(term));
  }, [bottonSizes, search]);
  const pageCount = Math.max(1, Math.ceil(filteredSizes.length / pageSize));
  const visibleSizes = filteredSizes.slice((page - 1) * pageSize, page * pageSize);

  const saveMutation = useMutation({
    mutationFn: async () => isEditing ? bottonSizesApi.update(form.id, form) : bottonSizesApi.create(form),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: isEditing ? 'Tamanho de botton atualizado.' : 'Tamanho de botton cadastrado.' });
      setForm(emptyForm);
      setIsDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['botton-sizes'] });
      await queryClient.invalidateQueries({ queryKey: ['products-metadata'] });
    },
    onError: () => setFeedback({ severity: 'warning', message: 'Nao foi possivel salvar o tamanho de botton.' })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => bottonSizesApi.remove(id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Tamanho de botton excluido.' });
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['botton-sizes'] });
      await queryClient.invalidateQueries({ queryKey: ['products-metadata'] });
    },
    onError: () => setFeedback({ severity: 'warning', message: 'Nao foi possivel excluir. Verifique se existem produtos vinculados.' })
  });

  function handleOpenCreateDialog() {
    setForm(emptyForm);
    setIsDialogOpen(true);
  }

  function handleOpenEditDialog(size: typeof emptyForm) {
    setForm(size);
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setForm(emptyForm);
    setIsDialogOpen(false);
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } }}>
        <Paper sx={{ p: 2 }}><Typography color="text.secondary">Tamanhos cadastrados</Typography><Typography variant="h5">{bottonSizes.length}</Typography></Paper>
        <Paper sx={{ p: 2 }}><Typography color="text.secondary">Resultados filtrados</Typography><Typography variant="h5">{filteredSizes.length}</Typography></Paper>
        <Paper sx={{ p: 2 }}><Typography color="text.secondary">Abaixo do mínimo</Typography><Typography variant="h5">{bottonSizes.filter((size) => size.minimumStock > 0 && size.stockQuantity <= size.minimumStock).length}</Typography></Paper>
      </Box>

      <PageSection
        title="Tamanhos de botton"
        subtitle="Insumo dos produtos do tipo Botton. Cada entrada em estoque de um botton baixa o estoque do tamanho utilizado."
        action={!isSupplier ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleOpenCreateDialog}>Novo tamanho</Button> : undefined}
      >
        <Stack spacing={2}>
          {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
          <TextField label="Buscar tamanho" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome ou observações" />
          {isMobile ? (
            <Stack spacing={1.5}>
              {visibleSizes.map((size) => (
                <Paper key={size.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                  <Stack spacing={1.2}>
                    <Typography fontWeight={700}>{capitalizeFirstLetter(size.name)}</Typography>
                    <Typography color="text.secondary">Custo unitário: {formatCurrency(size.costPerUnit)}</Typography>
                    <Typography color="text.secondary">Estoque: {size.stockQuantity}</Typography>
                    <Typography color="text.secondary">Estoque mínimo: {size.minimumStock}</Typography>
                    {!isSupplier ? (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton color="primary" onClick={() => handleOpenEditDialog(size)}><EditRoundedIcon /></IconButton>
                        <IconButton color="error" onClick={() => setSizeToDelete({ id: size.id, name: size.name })}><DeleteOutlineRoundedIcon /></IconButton>
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Tamanho</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Custo unitário</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Estoque</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Estoque mínimo</TableCell>
                  {!isSupplier ? <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 3 }}>Ações</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleSizes.map((size) => (
                  <TableRow key={size.id} hover>
                    <TableCell sx={{ py: 1.5 }}><Typography fontWeight={700}>{capitalizeFirstLetter(size.name)}</Typography></TableCell>
                    <TableCell sx={{ py: 1.5 }}>{formatCurrency(size.costPerUnit)}</TableCell>
                    <TableCell sx={{ py: 1.5, color: size.minimumStock > 0 && size.stockQuantity <= size.minimumStock ? 'error.main' : undefined }}>{size.stockQuantity}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>{size.minimumStock}</TableCell>
                    {!isSupplier ? <TableCell align="right" sx={{ py: 1.5, pr: 2, whiteSpace: 'nowrap' }}>
                      <IconButton color="primary" onClick={() => handleOpenEditDialog(size)}><EditRoundedIcon /></IconButton>
                      <IconButton color="error" onClick={() => setSizeToDelete({ id: size.id, name: size.name })}><DeleteOutlineRoundedIcon /></IconButton>
                    </TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          )}
          {visibleSizes.length === 0 ? <Alert severity="info">Nenhum tamanho de botton encontrado.</Alert> : null}
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
            <Typography color="text.secondary">Mostrando {visibleSizes.length} de {filteredSizes.length} tamanhos</Typography>
            <Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} />
          </Stack>
        </Stack>
      </PageSection>

      <ConfirmDialog
        open={Boolean(sizeToDelete)}
        title="Excluir tamanho de botton"
        description={`Deseja excluir o tamanho ${capitalizeFirstLetter(sizeToDelete?.name ?? '')}?`}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteMutation.isLoading}
        onCancel={() => setSizeToDelete(null)}
        onConfirm={() => {
          if (!sizeToDelete) {
            return;
          }

          deleteMutation.mutate(sizeToDelete.id, {
            onSuccess: () => setSizeToDelete(null)
          });
        }}
      />

      <Dialog open={!isSupplier && isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{isEditing ? 'Editar tamanho de botton' : 'Novo tamanho de botton'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} helperText="Ex.: Botton 45 mm" />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' } }}>
              <CurrencyField label="Custo unitário" value={form.costPerUnit} onValueChange={(value) => setForm({ ...form, costPerUnit: value })} fullWidth />
              <TextField label="Estoque atual" type="number" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: Number(event.target.value) })} fullWidth />
              <TextField label="Estoque mínimo" type="number" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: Number(event.target.value) })} fullWidth />
            </Box>
            <TextField label="Observações" multiline minRows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
