import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CurrencyField } from '../components/CurrencyField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { fairsApi, financeApi, suppliersApi } from '../services/api';
import { financialClassificationLabel } from '../services/labels';

export function FinanceEntryFormPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const isReseller = session?.role === 'Reseller';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.getAll, enabled: !isSupplier && !isReseller });
  const { data: fairs = [] } = useQuery({ queryKey: ['fairs'], queryFn: fairsApi.getAll, enabled: isSupplier });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({ type: 'Expense', classification: 'Variable', category: '', description: '', amount: 0, supplierId: isSupplier ? (session?.supplierId ?? '') : '', referenceId: '' });
  const isSupplierFairQuotaPayment = isSupplier && form.type === 'Expense' && form.category === 'Pagamento de cota de feira';
  const supplierFairs = fairs.filter((fair) => fair.suppliers.some((supplier) => supplier.supplierId === session?.supplierId));

  const quickCategoryOptions = isSupplier && form.type === 'Expense'
    ? [
        'Pagamento de cota de feira',
        'Despesa operacional'
      ]
    : !isSupplier && form.type === 'Expense'
      ? [
          'Inscricao de feira',
          'Despesa operacional'
        ]
      : form.type === 'Income'
        ? [
            'Venda',
            'Receita extra'
          ]
        : [];

  const mutation = useMutation({
    mutationFn: async () => financeApi.create({ ...form, supplierId: form.supplierId || null, referenceId: form.referenceId || null }),
    onSuccess: async () => {
      setFeedback('Lançamento financeiro criado.');
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/financeiro');
    }
  });

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h4">Novo lançamento financeiro</Typography>
          <Typography color="text.secondary">Cadastro em tela separada para não misturar histórico com formulário.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/financeiro')}>
          Voltar para financeiro
        </Button>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title="Dados do lançamento" subtitle="Receitas extras e despesas fixas ou variáveis.">
            <Stack spacing={2}>
              {feedback ? <Alert severity="success">{feedback}</Alert> : null}
              <TextField select label="Tipo" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <MenuItem value="Income">Receita</MenuItem>
                <MenuItem value="Expense">Despesa</MenuItem>
              </TextField>
              <TextField select label="Classificação" value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })}>
                <MenuItem value="Fixed">{financialClassificationLabel('Fixed')}</MenuItem>
                <MenuItem value="Variable">{financialClassificationLabel('Variable')}</MenuItem>
              </TextField>
              <TextField label="Categoria" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
              {quickCategoryOptions.length > 0 ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  {quickCategoryOptions.map((option) => (
                    <Button key={option} variant="outlined" size="small" onClick={() => setForm((current) => ({ ...current, category: option }))}>
                      {option === 'Pagamento de cota de feira' ? 'Pagar cota da feira' : option}
                    </Button>
                  ))}
                </Stack>
              ) : null}
              <TextField label="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              {isSupplierFairQuotaPayment ? (
                <TextField
                  select
                  label="Feira referente à cota"
                  value={form.referenceId}
                  onChange={(event) => {
                    const fair = supplierFairs.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      referenceId: event.target.value,
                      description: fair ? `Pagamento da cota da feira ${fair.name}` : current.description
                    }));
                  }}
                  helperText="Selecione a feira para vincular este pagamento."
                >
                  <MenuItem value="">Selecione</MenuItem>
                  {supplierFairs.map((fair) => (
                    <MenuItem key={fair.id} value={fair.id}>{fair.name}</MenuItem>
                  ))}
                </TextField>
              ) : null}
              {!isSupplier && !isReseller ? (
                <TextField select label="Escopo do lançamento" value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}>
                  <MenuItem value="">Lojinha</MenuItem>
                  {suppliers.map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>)}
                </TextField>
              ) : (
                <TextField label="Escopo do lançamento" value="Meu financeiro" disabled helperText={isSupplier ? 'Este lançamento será vinculado ao seu fornecedor.' : 'Este lançamento ficará vinculado ao seu perfil de revendedor.'} />
              )}
              <CurrencyField label="Valor" value={form.amount} onValueChange={(value) => setForm({ ...form, amount: value })} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => mutation.mutate()} disabled={mutation.isLoading || (isSupplierFairQuotaPayment && !form.referenceId)}>
                  {mutation.isLoading ? 'Salvando...' : 'Salvar lançamento'}
                </Button>
                <Button variant="outlined" onClick={() => navigate('/financeiro')}>Cancelar</Button>
              </Stack>
            </Stack>
          </PageSection>
        </Grid>
      </Grid>
    </Stack>
  );
}