import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, Pagination, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { categoriesApi } from '../services/api';

const emptyForm = { id: '', name: '', description: '', colorHex: '#f5b2c5' };

function formatCategoryIdentifier(value: number) {
  return String(value).padStart(5, '0');
}

export function CategoriesPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pageSize = 8;
  const queryClient = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });
  const [form, setForm] = useState(emptyForm);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'warning'; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const isEditing = useMemo(() => Boolean(form.id), [form.id]);
  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return categories;
    }

    return categories.filter((category) => [category.name, category.description].join(' ').toLowerCase().includes(term));
  }, [categories, search]);
  const pageCount = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const visibleCategories = filteredCategories.slice((page - 1) * pageSize, page * pageSize);

  const saveMutation = useMutation({
    mutationFn: async () => isEditing ? categoriesApi.update(form.id, form) : categoriesApi.create(form),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: isEditing ? 'Categoria atualizada.' : 'Categoria cadastrada.' });
      setForm(emptyForm);
      setIsDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['products-metadata'] });
    },
    onError: () => setFeedback({ severity: 'warning', message: 'Nao foi possivel salvar a categoria.' })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => categoriesApi.remove(id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Categoria excluida.' });
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['products-metadata'] });
    },
    onError: () => setFeedback({ severity: 'warning', message: 'Nao foi possivel excluir a categoria. Verifique se existem produtos vinculados.' })
  });

  function handleOpenCreateDialog() {
    setForm(emptyForm);
    setIsDialogOpen(true);
  }

  function handleOpenEditDialog(category: typeof emptyForm) {
    setForm(category);
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setForm(emptyForm);
    setIsDialogOpen(false);
  }

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Categorias cadastradas</Typography><Typography variant="h5">{categories.length}</Typography></Paper></Grid>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Resultados filtrados</Typography><Typography variant="h5">{filteredCategories.length}</Typography></Paper></Grid>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Modo atual</Typography><Typography variant="h5">{isEditing && isDialogOpen ? 'Edição' : 'Listagem'}</Typography></Paper></Grid>
      </Grid>

      <PageSection
        title="Categorias"
        subtitle="Mantenha as categorias dos produtos sem misturar listagem com cadastro na mesma área."
        action={!isSupplier ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleOpenCreateDialog}>Nova categoria</Button> : undefined}
      >
        <Stack spacing={2}>
          {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
          <TextField label="Buscar categoria" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome ou descrição" />
          {isMobile ? (
            <Stack spacing={1.5}>
              {visibleCategories.map((category) => (
                <Paper key={category.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                  <Stack spacing={1.2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <Paper sx={{ width: 18, height: 18, backgroundColor: category.colorHex, borderRadius: 99, flexShrink: 0 }} />
                        <Typography fontWeight={700}>{category.name}</Typography>
                      </Stack>
                      <Chip label={formatCategoryIdentifier(category.numericIdentifier)} size="small" />
                    </Stack>
                    <Typography color="text.secondary">{category.description || 'Sem descrição'}</Typography>
                    <Typography color="text.secondary">Cor: {category.colorHex}</Typography>
                    {!isSupplier ? (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton color="primary" onClick={() => handleOpenEditDialog(category)}><EditRoundedIcon /></IconButton>
                        <IconButton color="error" onClick={() => deleteMutation.mutate(category.id)}><DeleteOutlineRoundedIcon /></IconButton>
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Código</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Categoria</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Descrição</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Cor</TableCell>
                    {!isSupplier ? <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 3 }}>Ações</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleCategories.map((category) => (
                  <TableRow key={category.id} hover>
                    <TableCell sx={{ py: 1.5 }}>{formatCategoryIdentifier(category.numericIdentifier)}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Paper sx={{ width: 18, height: 18, backgroundColor: category.colorHex, borderRadius: 99, flexShrink: 0 }} />
                        <Typography fontWeight={700}>{category.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, whiteSpace: 'normal', wordBreak: 'break-word' }}>{category.description || 'Sem descrição'}</TableCell>
                    <TableCell sx={{ py: 1.5 }}><Chip label={category.colorHex} size="small" sx={{ backgroundColor: 'rgba(217,107,135,0.12)' }} /></TableCell>
                    {!isSupplier ? <TableCell align="right" sx={{ py: 1.5, pr: 2, whiteSpace: 'nowrap' }}>
                      <IconButton color="primary" onClick={() => handleOpenEditDialog(category)}><EditRoundedIcon /></IconButton>
                      <IconButton color="error" onClick={() => deleteMutation.mutate(category.id)}><DeleteOutlineRoundedIcon /></IconButton>
                    </TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          )}
          {visibleCategories.length === 0 ? <Alert severity="info">Nenhuma categoria encontrada.</Alert> : null}
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
            <Typography color="text.secondary">Mostrando {visibleCategories.length} de {filteredCategories.length} categorias</Typography>
            <Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} />
          </Stack>
        </Stack>
      </PageSection>

      <Dialog open={!isSupplier && isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{isEditing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {isEditing ? <TextField label="Identificador" value={formatCategoryIdentifier((categories.find((category) => category.id === form.id)?.numericIdentifier) ?? 0)} disabled /> : null}
            <TextField label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <TextField label="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <TextField label="Cor" value={form.colorHex} onChange={(event) => setForm({ ...form, colorHex: event.target.value })} />
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