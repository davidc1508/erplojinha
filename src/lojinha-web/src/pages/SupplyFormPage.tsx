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
import { CurrencyField } from '../components/CurrencyField';
import { PageSection } from '../components/PageSection';
import { suppliesApi } from '../services/api';

const emptyForm = {
  name: '',
  unit: 'g',
  costPerUnit: 0,
  stockQuantity: 0,
  minimumStock: 0,
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

function formatEquivalentSupplyCost(costPerUnit: number, unit: string) {
  if (unit === 'g' && costPerUnit > 0 && costPerUnit < 1) {
    return `${(costPerUnit * 1000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por kg`;
  }

  return null;
}

export function SupplyFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const { data: supply } = useQuery({
    queryKey: ['supply', id],
    queryFn: () => suppliesApi.getById(id!),
    enabled: isEditing
  });

  useEffect(() => {
    if (!supply) {
      return;
    }

    setForm({
      name: supply.name,
      unit: supply.unit,
      costPerUnit: supply.costPerUnit,
      stockQuantity: supply.stockQuantity,
      minimumStock: supply.minimumStock,
      notes: supply.notes
    });
  }, [supply]);

  const mutation = useMutation({
    mutationFn: async () => (isEditing ? suppliesApi.update(id!, form) : suppliesApi.create(form)),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Insumo salvo com sucesso.' });
      await queryClient.invalidateQueries({ queryKey: ['supplies'] });
      await queryClient.invalidateQueries({ queryKey: ['supply', id] });
      navigate('/insumos');
    },
    onError: (error) => {
      setFeedback({ severity: 'error', message: getErrorMessage(error, 'Nao foi possivel salvar o insumo.') });
    }
  });

  function updateField(field: keyof typeof emptyForm, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const equivalentCost = formatEquivalentSupplyCost(form.costPerUnit, form.unit);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h4">{isEditing ? 'Editar insumo' : 'Novo insumo'}</Typography>
          <Typography color="text.secondary">Cadastro em tela separada para manter o mesmo padrão da área de produtos.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/insumos')}>
          Voltar para listagem
        </Button>
      </Stack>

      {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title="Dados do insumo" subtitle="Matéria-prima, embalagem ou custo físico usado na produção.">
            <Stack spacing={2}>
              <TextField label="Nome" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField label="Unidade" value={form.unit} onChange={(event) => updateField('unit', event.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <CurrencyField
                    label="Custo por unidade"
                    value={form.costPerUnit}
                    onValueChange={(value) => updateField('costPerUnit', value)}
                    helperText={equivalentCost ? `Equivalente exibido na listagem: ${equivalentCost}` : 'Informe o custo na unidade cadastrada.'}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Estoque" type="number" value={form.stockQuantity} onChange={(event) => updateField('stockQuantity', Number(event.target.value))} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Estoque mínimo" type="number" value={form.minimumStock} onChange={(event) => updateField('minimumStock', Number(event.target.value))} fullWidth />
                </Grid>
              </Grid>
              <TextField label="Observações" multiline minRows={4} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => mutation.mutate()} disabled={mutation.isLoading}>
                  {mutation.isLoading ? 'Salvando...' : isEditing ? 'Atualizar insumo' : 'Cadastrar insumo'}
                </Button>
                <Button variant="outlined" onClick={() => navigate('/insumos')}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </PageSection>
        </Grid>

        <Grid item xs={12} lg={4}>
          <PageSection title="Resumo" subtitle="O estoque atual e o mínimo continuam visíveis na listagem principal para facilitar o filtro.">
            <Stack spacing={1.2}>
              <Typography>Use a listagem para localizar o insumo por nome ou unidade.</Typography>
              <Typography>Edite aqui custo, estoque e observações sem misturar formulário e grade na mesma tela.</Typography>
              {equivalentCost ? <Typography>Para filamentos em gramas, a listagem também mostra o valor equivalente em kg: {equivalentCost}.</Typography> : null}
            </Stack>
          </PageSection>
        </Grid>
      </Grid>
    </Stack>
  );
}
