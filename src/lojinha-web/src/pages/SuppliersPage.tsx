import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageSection } from '../components/PageSection';
import { suppliersApi } from '../services/api';
import { capitalizeFirstLetter } from '../services/text';

export function SuppliersPage() {
  const pageSize = 8;
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.getAll });
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'warning'; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return suppliers;
    }

    return suppliers.filter((supplier) => [supplier.name, supplier.contactName, supplier.phoneNumber, supplier.notes].join(' ').toLowerCase().includes(term));
  }, [search, suppliers]);
  const pageCount = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  const visibleSuppliers = filteredSuppliers.slice((page - 1) * pageSize, page * pageSize);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => suppliersApi.remove(id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Fornecedor excluido.' });
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      await queryClient.invalidateQueries({ queryKey: ['products-metadata'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Nao foi possivel excluir o fornecedor.';
      setFeedback({ severity: 'warning', message });
    }
  });

  function renderActions(supplier: { id: string; name: string }) {
    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Tooltip title="Ver detalhes">
          <IconButton size="small" color="info" onClick={() => navigate(`/fornecedores/${supplier.id}`)}><VisibilityRoundedIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Editar">
          <IconButton size="small" color="primary" onClick={() => navigate(`/fornecedores/${supplier.id}/editar`)}><EditRoundedIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Excluir">
          <IconButton size="small" color="error" onClick={() => setSupplierToDelete({ id: supplier.id, name: supplier.name })}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h3">Fornecedores</Typography>
          <Typography color="text.secondary">Cadastre, edite e remova fornecedores vinculados aos produtos consignados.</Typography>
        </div>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/fornecedores/novo')} sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}>
          Novo fornecedor
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))' } }}>
        <Paper sx={{ p: 2 }}><Typography color="text.secondary">Fornecedores</Typography><Typography variant="h5">{suppliers.length}</Typography></Paper>
        <Paper sx={{ p: 2 }}><Typography color="text.secondary">Resultados filtrados</Typography><Typography variant="h5">{filteredSuppliers.length}</Typography></Paper>
      </Box>

      <PageSection title="Fornecedores cadastrados" subtitle="Busca por nome, contato, telefone ou observação.">
        <Stack spacing={2}>
          {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
          <TextField label="Buscar fornecedor" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, contato, telefone ou observação" />

          {isMobile ? (
            <Stack spacing={1.5}>
              {visibleSuppliers.map((supplier) => (
                <Paper key={supplier.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                  <Stack spacing={0.75}>
                    <Typography fontWeight={700}>{capitalizeFirstLetter(supplier.name)}</Typography>
                    <Typography color="text.secondary" fontSize={13}>Contato: {capitalizeFirstLetter(supplier.contactName || 'não informado')}</Typography>
                    <Typography color="text.secondary" fontSize={13}>Telefone: {supplier.phoneNumber || 'não informado'}</Typography>
                    {renderActions(supplier)}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Fornecedor</TableCell>
                    <TableCell>Contato</TableCell>
                    <TableCell>Telefone</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{capitalizeFirstLetter(supplier.name)}</TableCell>
                      <TableCell>{capitalizeFirstLetter(supplier.contactName || 'não informado')}</TableCell>
                      <TableCell>{supplier.phoneNumber || 'não informado'}</TableCell>
                      <TableCell align="right">{renderActions(supplier)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {visibleSuppliers.length === 0 ? <Alert severity="info">Nenhum fornecedor encontrado.</Alert> : null}
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
            <Typography color="text.secondary">Mostrando {visibleSuppliers.length} de {filteredSuppliers.length} fornecedores</Typography>
            <Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} />
          </Stack>
        </Stack>
      </PageSection>
      <ConfirmDialog
        open={Boolean(supplierToDelete)}
        title="Excluir fornecedor"
        description={`Deseja excluir o fornecedor ${capitalizeFirstLetter(supplierToDelete?.name ?? '')}?`}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteMutation.isLoading}
        onCancel={() => setSupplierToDelete(null)}
        onConfirm={() => {
          if (!supplierToDelete) {
            return;
          }

          deleteMutation.mutate(supplierToDelete.id, {
            onSuccess: () => setSupplierToDelete(null)
          });
        }}
      />
    </Stack>
  );
}
