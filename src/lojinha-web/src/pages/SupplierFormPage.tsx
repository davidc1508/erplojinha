import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { suppliersApi } from '../services/api';

const emptyForm = {
  name: '',
  contactName: '',
  phoneNumber: '',
  notes: ''
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return fallback;
}

export function SupplierFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const { data: supplier } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => suppliersApi.getById(id!),
    enabled: isEditing
  });

  useEffect(() => {
    if (!supplier) {
      return;
    }

    setForm({
      name: supplier.name,
      contactName: supplier.contactName,
      phoneNumber: supplier.phoneNumber,
      notes: supplier.notes
    });
  }, [supplier]);

  const mutation = useMutation({
    mutationFn: async () => (isEditing ? suppliersApi.update(id!, form) : suppliersApi.create(form)),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Fornecedor salvo com sucesso.' });
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      await queryClient.invalidateQueries({ queryKey: ['supplier', id] });
      await queryClient.invalidateQueries({ queryKey: ['products-metadata'] });
      navigate('/fornecedores');
    },
    onError: (error) => {
      setFeedback({ severity: 'error', message: getErrorMessage(error, 'Nao foi possivel salvar o fornecedor.') });
    }
  });

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h4">{isEditing ? 'Editar fornecedor' : 'Novo fornecedor'}</Typography>
          <Typography color="text.secondary">Cadastro em tela separada para manter o mesmo padrão das outras áreas operacionais.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/fornecedores')}>
          Voltar para listagem
        </Button>
      </Stack>

      {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title="Dados do fornecedor" subtitle="Informações básicas para vincular produtos e acompanhar consignados.">
            <Stack spacing={2}>
              <TextField label="Nome" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField label="Contato" value={form.contactName} onChange={(event) => updateField('contactName', event.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Telefone" value={form.phoneNumber} onChange={(event) => updateField('phoneNumber', event.target.value)} fullWidth />
                </Grid>
              </Grid>
              <TextField label="Observações" multiline minRows={4} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => mutation.mutate()} disabled={mutation.isLoading || form.name.trim().length === 0}>
                  {mutation.isLoading ? 'Salvando...' : isEditing ? 'Atualizar fornecedor' : 'Cadastrar fornecedor'}
                </Button>
                <Button variant="outlined" onClick={() => navigate('/fornecedores')}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </PageSection>
        </Grid>

        <Grid item xs={12} lg={4}>
          <PageSection title="Resumo" subtitle="O vínculo com produtos continua sendo feito pelo cadastro do produto.">
            <Stack spacing={1.2}>
              <Typography>Use a listagem para localizar rapidamente o fornecedor por nome, contato ou telefone.</Typography>
              <Typography>Edite aqui os dados cadastrais sem misturar formulário e listagem na mesma tela.</Typography>
            </Stack>
          </PageSection>
        </Grid>
      </Grid>
    </Stack>
  );
}