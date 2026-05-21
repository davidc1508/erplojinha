import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { suppliersApi, usersApi } from '../services/api';

const emptyForm = { email: '', fullName: '', password: '', role: 'Admin', supplierId: '' };

export function UserFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.getById(id!),
    enabled: isEditing
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.getAll });

  useEffect(() => {
    if (!user) {
      return;
    }

    setForm({
      email: user.email,
      fullName: user.fullName,
      password: '',
      role: user.role,
      supplierId: user.supplierId ?? ''
    });
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        email: form.email,
        fullName: form.fullName,
        password: isEditing ? (form.password.trim() === '' ? null : form.password) : form.password,
        role: form.role,
        supplierId: form.role === 'Supplier' ? (form.supplierId || null) : null
      };

      return isEditing
        ? usersApi.update(id!, payload)
        : usersApi.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      navigate('/usuarios');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Nao foi possivel salvar o usuario.';
      setFeedback(message);
    }
  });

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h4">{isEditing ? 'Editar usuário' : 'Novo usuário'}</Typography>
          <Typography color="text.secondary">A senha é enviada apenas na criação ou quando você quiser redefini-la.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/usuarios')}>
          Voltar para listagem
        </Button>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title={isEditing ? 'Editar usuário' : 'Dados do usuário'} subtitle="Perfil administrativo ou perfil vinculado a um fornecedor já cadastrado.">
            <Stack spacing={2}>
              {feedback ? <Alert severity="warning">{feedback}</Alert> : null}
              <TextField label="Nome completo" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
              <TextField label="E-mail" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              <TextField
                label={isEditing ? 'Nova senha (opcional)' : 'Senha'}
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                helperText={isEditing ? 'Preencha apenas se quiser trocar a senha atual.' : 'Minimo de 6 caracteres.'}
              />
              <TextField
                select
                label="Perfil"
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value, supplierId: event.target.value === 'Supplier' ? current.supplierId : '' }))}
              >
                <MenuItem value="Admin">Administrador</MenuItem>
                <MenuItem value="Supplier">Fornecedor</MenuItem>
                <MenuItem value="Reseller">Revendedor</MenuItem>
              </TextField>
              {form.role === 'Supplier' ? (
                <TextField
                  select
                  label="Fornecedor vinculado"
                  value={form.supplierId}
                  onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))}
                  helperText="Obrigatório para usuários com perfil de fornecedor."
                >
                  {suppliers.map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>)}
                </TextField>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading || (!isEditing && form.password.trim().length < 6) || (form.role === 'Supplier' && form.supplierId === '')}>
                  {saveMutation.isLoading ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button variant="outlined" onClick={() => navigate('/usuarios')}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </PageSection>
        </Grid>
      </Grid>
    </Stack>
  );
}
