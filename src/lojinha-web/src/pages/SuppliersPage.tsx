import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, IconButton, Pagination, Paper, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { suppliersApi } from '../services/api';
import { capitalizeFirstLetter } from '../services/text';

export function SuppliersPage() {
  const pageSize = 8;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.getAll });
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'warning'; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

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

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h3">Fornecedores</Typography>
          <Typography color="text.secondary">Listagem separada do formulário para manter o fluxo consistente com produtos, feiras e insumos.</Typography>
        </div>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/fornecedores/novo')}>
          Novo fornecedor
        </Button>
      </Stack>

      <PageSection title="Fornecedores cadastrados" subtitle="Cadastre, edite e remova fornecedores vinculados aos produtos consignados.">
        <Stack spacing={1.5}>
          {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
          <TextField label="Buscar fornecedor" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, contato, telefone ou observação" />
          {visibleSuppliers.map((supplier) => (
            <Paper key={supplier.id} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.65)' }}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                <div>
                  <Typography fontWeight={700}>{capitalizeFirstLetter(supplier.name)}</Typography>
                  <Typography color="text.secondary">Contato: {capitalizeFirstLetter(supplier.contactName || 'Não informado')}</Typography>
                  <Typography color="text.secondary">Telefone: {supplier.phoneNumber || 'Não informado'}</Typography>
                </div>
                <Stack direction="row" spacing={1}>
                  <IconButton color="info" onClick={() => navigate(`/fornecedores/${supplier.id}`)}><VisibilityRoundedIcon /></IconButton>
                  <IconButton color="primary" onClick={() => navigate(`/fornecedores/${supplier.id}/editar`)}><EditRoundedIcon /></IconButton>
                  <IconButton color="error" onClick={() => deleteMutation.mutate(supplier.id)}><DeleteOutlineRoundedIcon /></IconButton>
                </Stack>
              </Stack>
            </Paper>
          ))}
          {visibleSuppliers.length === 0 ? <Alert severity="info">Nenhum fornecedor encontrado.</Alert> : null}
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
            <Typography color="text.secondary">Mostrando {visibleSuppliers.length} de {filteredSuppliers.length} fornecedores</Typography>
            <Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} />
          </Stack>
        </Stack>
      </PageSection>
    </Stack>
  );
}