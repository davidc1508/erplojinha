import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, MenuItem, Pagination, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CurrencyField } from '../components/CurrencyField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { printersApi } from '../services/api';
import { capitalizeFirstLetter } from '../services/text';

const emptyForm = {
  id: '',
  name: '',
  brand: '',
  returnMonths: 12,
  machineCost: 0,
  workHoursPerDay: 8,
  workingDaysPerMonth: 22,
  powerKw: 0,
  usageLevel: 'medio',
  failureRate: 0
};

export function PrintersPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pageSize = 6;
  const queryClient = useQueryClient();
  const { data: printers = [] } = useQuery({ queryKey: ['printers'], queryFn: printersApi.getAll });
  const [form, setForm] = useState(emptyForm);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'warning'; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [printerToDelete, setPrinterToDelete] = useState<{ id: string; name: string } | null>(null);
  const isEditing = useMemo(() => Boolean(form.id), [form.id]);
  const filteredPrinters = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return printers;
    }

    return printers.filter((printer) => [printer.name, printer.brand, printer.usageLevel].join(' ').toLowerCase().includes(term));
  }, [printers, search]);
  const pageCount = Math.max(1, Math.ceil(filteredPrinters.length / pageSize));
  const visiblePrinters = filteredPrinters.slice((page - 1) * pageSize, page * pageSize);

  const saveMutation = useMutation({
    mutationFn: async () => isEditing ? printersApi.update(form.id, form) : printersApi.create(form),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: isEditing ? 'Impressora atualizada.' : 'Impressora cadastrada.' });
      setForm(emptyForm);
      setIsDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['printers'] });
      await queryClient.invalidateQueries({ queryKey: ['products-metadata'] });
    },
    onError: () => setFeedback({ severity: 'warning', message: 'Nao foi possivel salvar a impressora.' })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => printersApi.remove(id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Impressora excluida.' });
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['printers'] });
      await queryClient.invalidateQueries({ queryKey: ['products-metadata'] });
    },
    onError: () => setFeedback({ severity: 'warning', message: 'Nao foi possivel excluir a impressora. Verifique se existem produtos vinculados.' })
  });

  function handleOpenCreateDialog() {
    setForm(emptyForm);
    setIsDialogOpen(true);
  }

  function handleOpenEditDialog(printer: typeof emptyForm) {
    setForm(printer);
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setForm(emptyForm);
    setIsDialogOpen(false);
  }

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Perfis cadastrados</Typography><Typography variant="h5">{printers.length}</Typography></Paper></Grid>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Resultados filtrados</Typography><Typography variant="h5">{filteredPrinters.length}</Typography></Paper></Grid>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Modo atual</Typography><Typography variant="h5">{isEditing && isDialogOpen ? 'Edição' : 'Listagem'}</Typography></Paper></Grid>
      </Grid>

      <PageSection
        title="Impressoras"
        subtitle="Perfis de impressoras organizados em listagem, com cadastro aberto apenas quando necessário."
        action={!isSupplier ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleOpenCreateDialog}>Nova impressora</Button> : undefined}
      >
        <Stack spacing={2}>
          {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
          <TextField label="Buscar impressora" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, marca ou nível de uso" />
          {isMobile ? (
            <Stack spacing={1.5}>
              {visiblePrinters.map((printer) => (
                <Paper key={printer.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                  <Stack spacing={1.2}>
                    <Typography fontWeight={700}>{capitalizeFirstLetter(printer.name)}</Typography>
                    <Typography color="text.secondary">{capitalizeFirstLetter(printer.brand || '-')}</Typography>
                    <Typography color="text.secondary">Uso: {printer.usageLevel}</Typography>
                    <Typography color="text.secondary">Custo: {printer.machineCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Typography>
                    <Typography color="text.secondary">Retorno: {printer.returnMonths} meses</Typography>
                    <Typography color="text.secondary">Falha: {printer.failureRate}%</Typography>
                    {!isSupplier ? (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton color="primary" onClick={() => handleOpenEditDialog(printer)}><EditRoundedIcon /></IconButton>
                        <IconButton color="error" onClick={() => setPrinterToDelete({ id: printer.id, name: printer.name })}><DeleteOutlineRoundedIcon /></IconButton>
                      </Stack>
                    ) : null}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small" sx={{ minWidth: 920 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Perfil</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Marca</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Uso</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Custo máquina</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Retorno</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Falha</TableCell>
                  {!isSupplier ? <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 3 }}>Ações</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {visiblePrinters.map((printer) => (
                  <TableRow key={printer.id} hover>
                    <TableCell sx={{ py: 1.5 }}><Typography fontWeight={700}>{capitalizeFirstLetter(printer.name)}</Typography></TableCell>
                    <TableCell sx={{ py: 1.5 }}>{capitalizeFirstLetter(printer.brand || '-')}</TableCell>
                    <TableCell sx={{ py: 1.5, textTransform: 'capitalize' }}>{printer.usageLevel}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>{printer.machineCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>{printer.returnMonths} meses</TableCell>
                    <TableCell sx={{ py: 1.5 }}>{printer.failureRate}%</TableCell>
                    {!isSupplier ? <TableCell align="right" sx={{ py: 1.5, pr: 2, whiteSpace: 'nowrap' }}>
                      <IconButton color="primary" onClick={() => handleOpenEditDialog(printer)}><EditRoundedIcon /></IconButton>
                      <IconButton color="error" onClick={() => setPrinterToDelete({ id: printer.id, name: printer.name })}><DeleteOutlineRoundedIcon /></IconButton>
                    </TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          )}
          {visiblePrinters.length === 0 ? <Alert severity="info">Nenhuma impressora encontrada.</Alert> : null}
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
            <Typography color="text.secondary">Mostrando {visiblePrinters.length} de {filteredPrinters.length} perfis</Typography>
            <Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} />
          </Stack>
        </Stack>
      </PageSection>

      <ConfirmDialog
        open={Boolean(printerToDelete)}
        title="Excluir impressora"
        description={`Deseja excluir a impressora ${capitalizeFirstLetter(printerToDelete?.name ?? '')}?`}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteMutation.isLoading}
        onCancel={() => setPrinterToDelete(null)}
        onConfirm={() => {
          if (!printerToDelete) {
            return;
          }

          deleteMutation.mutate(printerToDelete.id, {
            onSuccess: () => setPrinterToDelete(null)
          });
        }}
      />

      <Dialog open={!isSupplier && isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{isEditing ? 'Editar impressora' : 'Nova impressora'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <TextField label="Marca" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField label="Meses de retorno" type="number" value={form.returnMonths} onChange={(event) => setForm({ ...form, returnMonths: Number(event.target.value) })} fullWidth /></Grid>
              <Grid item xs={12} sm={6}><CurrencyField label="Custo da máquina" value={form.machineCost} onValueChange={(value) => setForm({ ...form, machineCost: value })} fullWidth /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Horas/dia" type="number" value={form.workHoursPerDay} onChange={(event) => setForm({ ...form, workHoursPerDay: Number(event.target.value) })} fullWidth /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Dias/mês" type="number" value={form.workingDaysPerMonth} onChange={(event) => setForm({ ...form, workingDaysPerMonth: Number(event.target.value) })} fullWidth /></Grid>
              <Grid item xs={12} sm={6}><TextField label="Potência (kW)" type="number" value={form.powerKw} onChange={(event) => setForm({ ...form, powerKw: Number(event.target.value) })} fullWidth /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField select label="Nível de uso" value={form.usageLevel} onChange={(event) => setForm({ ...form, usageLevel: event.target.value })} fullWidth>
                  <MenuItem value="basico">Básico</MenuItem>
                  <MenuItem value="medio">Médio</MenuItem>
                  <MenuItem value="profissional">Profissional</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <TextField label="Taxa de falha" type="number" value={form.failureRate} onChange={(event) => setForm({ ...form, failureRate: Number(event.target.value) })} />
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