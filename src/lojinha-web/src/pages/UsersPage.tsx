import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, IconButton, Pagination, Paper, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { usersApi } from '../services/api';
import { capitalizeFirstLetter } from '../services/text';

export function UsersPage() {
  const navigate = useNavigate();
  const pageSize = 8;
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.getAll });
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'warning'; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return users;
    }

    return users.filter((user) => [user.fullName, user.email, user.role, user.supplierName ?? ''].join(' ').toLowerCase().includes(term));
  }, [users, search]);
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const visibleUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => usersApi.remove(id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Usuario excluido.' });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Nao foi possivel excluir o usuario.';
      setFeedback({ severity: 'warning', message });
    }
  });

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <div>
            <Typography variant="h3">Usuários</Typography>
            <Typography color="text.secondary">Listagem separada do formulário para manter o padrão das outras telas de cadastro.</Typography>
          </div>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/usuarios/novo')}>
            Novo usuário
          </Button>
        </Stack>
      </Grid>
      <Grid item xs={12}>
        <Grid container spacing={2} sx={{ mb: 0.5 }}>
          <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Usuários cadastrados</Typography><Typography variant="h5">{users.length}</Typography></Paper></Grid>
          <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Perfis de fornecedor</Typography><Typography variant="h5">{users.filter((user) => user.role === 'Supplier').length}</Typography></Paper></Grid>
        </Grid>
        <PageSection title="Usuários cadastrados" subtitle="Controle administrativo de acesso à aplicação.">
          <Stack spacing={1.5}>
            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
            <TextField label="Buscar usuário" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, e-mail, perfil ou fornecedor" />
            {visibleUsers.map((user) => (
              <Paper key={user.id} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.65)' }}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <div>
                    <Typography fontWeight={700}>{capitalizeFirstLetter(user.fullName)}</Typography>
                    <Typography color="text.secondary">{user.email}</Typography>
                    <Typography color="text.secondary">Perfil: {capitalizeFirstLetter(user.role)}</Typography>
                    {user.supplierName ? <Typography color="text.secondary">Fornecedor: {capitalizeFirstLetter(user.supplierName)}</Typography> : null}
                  </div>
                  <Stack direction="row" spacing={1}>
                    <IconButton color="primary" onClick={() => navigate(`/usuarios/${user.id}/editar`)}><EditRoundedIcon /></IconButton>
                    <IconButton color="error" onClick={() => deleteMutation.mutate(user.id)}><DeleteOutlineRoundedIcon /></IconButton>
                  </Stack>
                </Stack>
              </Paper>
            ))}
            {visibleUsers.length === 0 ? <Alert severity="info">Nenhum usuário encontrado.</Alert> : null}
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1}>
              <Typography color="text.secondary">Mostrando {visibleUsers.length} de {filteredUsers.length} usuários</Typography>
              <Pagination page={page} count={pageCount} onChange={(_, value) => setPage(value)} />
            </Stack>
          </Stack>
        </PageSection>
      </Grid>
    </Grid>
  );
}