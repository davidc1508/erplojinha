import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import { useEffect, useMemo, useState } from 'react';
import { CurrencyField } from '../components/CurrencyField';
import { PageSection } from '../components/PageSection';
import { cardFeeSettingsApi } from '../services/api';

const emptyForm = {
  creditCardPercentage: '2',
  debitCardPercentage: '2',
  additionalPercentage: '0',
  additionalFixedAmount: '0'
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

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CardFeeSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const { data } = useQuery({
    queryKey: ['card-fee-settings'],
    queryFn: cardFeeSettingsApi.get
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    setForm({
      creditCardPercentage: String(data.creditCardPercentage),
      debitCardPercentage: String(data.debitCardPercentage),
      additionalPercentage: String(data.additionalPercentage),
      additionalFixedAmount: String(data.additionalFixedAmount)
    });
  }, [data]);

  const payload = useMemo(() => ({
    creditCardPercentage: Number(form.creditCardPercentage || 0),
    debitCardPercentage: Number(form.debitCardPercentage || 0),
    additionalPercentage: Number(form.additionalPercentage || 0),
    additionalFixedAmount: Number(form.additionalFixedAmount || 0)
  }), [form]);

  const simulatedCreditNet30 = 30 - ((30 * (payload.creditCardPercentage + payload.additionalPercentage)) / 100) - payload.additionalFixedAmount;
  const simulatedDebitNet25 = 25 - ((25 * (payload.debitCardPercentage + payload.additionalPercentage)) / 100) - payload.additionalFixedAmount;

  const saveMutation = useMutation({
    mutationFn: async () => cardFeeSettingsApi.update(payload),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Configuração de taxas salva.' });
      await queryClient.invalidateQueries({ queryKey: ['card-fee-settings'] });
    },
    onError: (error) => {
      setFeedback({ severity: 'error', message: getErrorMessage(error, 'Nao foi possivel salvar as taxas.') });
    }
  });

  const reprocessMutation = useMutation({
    mutationFn: cardFeeSettingsApi.reprocessSales,
    onSuccess: async (result) => {
      setFeedback({ severity: 'success', message: `${result.updatedSalesCount} venda(s) em cartao foram reprocessadas.` });
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
    },
    onError: (error) => {
      setFeedback({ severity: 'error', message: getErrorMessage(error, 'Nao foi possivel reprocessar as vendas em cartao.') });
    }
  });

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Configuração de taxas</Typography>
        <Typography color="text.secondary">Defina as taxas de cartao e reaplique o calculo nas vendas ja registradas quando precisar alinhar o cenário real.</Typography>
      </div>

      {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title="Taxas de cartao" subtitle="O lucro da venda passa a descontar primeiro as taxas, depois os demais custos.">
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField label="Taxa de credito (%)" type="number" value={form.creditCardPercentage} onChange={(event) => updateField('creditCardPercentage', event.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Taxa de debito (%)" type="number" value={form.debitCardPercentage} onChange={(event) => updateField('debitCardPercentage', event.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Taxa adicional (%)" type="number" value={form.additionalPercentage} onChange={(event) => updateField('additionalPercentage', event.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <CurrencyField label="Taxa adicional fixa" value={Number(form.additionalFixedAmount || 0)} onValueChange={(value) => updateField('additionalFixedAmount', String(value))} fullWidth />
                </Grid>
              </Grid>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}>
                  {saveMutation.isLoading ? 'Salvando...' : 'Salvar taxas'}
                </Button>
                <Button variant="outlined" color="secondary" startIcon={<AutorenewRoundedIcon />} onClick={() => reprocessMutation.mutate()} disabled={reprocessMutation.isLoading}>
                  {reprocessMutation.isLoading ? 'Reprocessando...' : 'Reaplicar nas vendas em cartao'}
                </Button>
              </Stack>
            </Stack>
          </PageSection>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <PageSection title="Simulação rápida" subtitle="Referência direta para o cenário real informado.">
              <Stack spacing={1.2}>
                <Typography>Venda de {formatCurrency(30)} em crédito: entra {formatCurrency(simulatedCreditNet30)}</Typography>
                <Typography>Venda de {formatCurrency(25)} em débito: entra {formatCurrency(simulatedDebitNet25)}</Typography>
                <Typography color="text.secondary">Com 2% total, os exemplos ficam em R$ 29,40 e R$ 24,50.</Typography>
              </Stack>
            </PageSection>

            <PageSection title="Como funciona" subtitle="Aplicação do cálculo no sistema.">
              <Stack spacing={1.2}>
                <Typography>O valor líquido recebido passa a alimentar o financeiro nas vendas em cartão.</Typography>
                <Typography>O lucro bruto da venda é recalculado a partir do valor líquido, antes de descontar custo do produto e demais composições.</Typography>
                <Typography>O botão de reaplicação atualiza retroativamente as vendas em crédito e débito já registradas.</Typography>
              </Stack>
            </PageSection>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}