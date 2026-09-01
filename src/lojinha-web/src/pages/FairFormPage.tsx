import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Slider,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { memo, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CurrencyField } from '../components/CurrencyField';
import { PageSection } from '../components/PageSection';
import { fairsApi, productsApi } from '../services/api';
import { formatCurrency } from '../services/labels';
import { getTodayDateInputValue, toUtcDateOnlyIso } from '../services/date';

const emptyForm = {
  name: '',
  eventDateUtc: getTodayDateInputValue(),
  endDateUtc: getTodayDateInputValue(),
  registrationPaymentStartDateUtc: getTodayDateInputValue(),
  location: '',
  registrationFee: 0,
  registrationFeeSplitCount: 1,
  storeFeePercentage: 50,
  registrationInstallments: [{ dueDateUtc: getTodayDateInputValue(), amount: 0 }],
  supplierIds: [] as string[],
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

interface InstallmentRowProps {
  index: number;
  installment: { dueDateUtc: string; amount: number };
  canRemove: boolean;
  onDueDateChange: (value: string) => void;
  onAmountChange: (value: number) => void;
  onRemove: () => void;
}

const InstallmentRow = memo(function InstallmentRow({
  index,
  installment,
  canRemove,
  onDueDateChange,
  onAmountChange,
  onRemove
}: InstallmentRowProps) {
  const [dueDateDraft, setDueDateDraft] = useState(installment.dueDateUtc);

  useEffect(() => {
    setDueDateDraft(installment.dueDateUtc);
  }, [installment.dueDateUtc]);

  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 44px', sm: 'minmax(0, 1fr) minmax(0, 1fr) 44px' }, alignItems: 'center' }}>
      <TextField
        label={`Vencimento parcela ${index + 1}`}
        type="date"
        value={dueDateDraft}
        onChange={(event) => setDueDateDraft(event.target.value)}
        onBlur={() => onDueDateChange(dueDateDraft)}
        InputLabelProps={{ shrink: true }}
        fullWidth
        sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
      />
      <CurrencyField
        label={`Valor parcela ${index + 1}`}
        value={installment.amount}
        onValueChange={onAmountChange}
        fullWidth
      />
      <IconButton color="error" onClick={onRemove} disabled={!canRemove}>
        <DeleteOutlineRoundedIcon />
      </IconButton>
    </Box>
  );
});

export function FairFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [equalInstallmentsCount, setEqualInstallmentsCount] = useState(1);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const { data: metadata } = useQuery({ queryKey: ['products-metadata'], queryFn: productsApi.getMetadata });

  const { data: fair } = useQuery({
    queryKey: ['fair', id],
    queryFn: () => fairsApi.getById(id!),
    enabled: isEditing
  });

  useEffect(() => {
    if (!fair) {
      return;
    }

    setForm({
      name: fair.name,
      eventDateUtc: fair.eventDateUtc.slice(0, 10),
      endDateUtc: fair.endDateUtc.slice(0, 10),
      registrationPaymentStartDateUtc: fair.eventDateUtc.slice(0, 10),
      location: fair.location,
      registrationFee: fair.registrationFee,
      registrationFeeSplitCount: fair.registrationFeeSplitCount,
      storeFeePercentage: fair.storeFeePercentage,
      registrationInstallments: [{ dueDateUtc: fair.eventDateUtc.slice(0, 10), amount: fair.registrationFee }],
      supplierIds: fair.suppliers.map((item) => item.supplierId),
      notes: fair.notes
    });
    setEqualInstallmentsCount(1);
  }, [fair]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        eventDateUtc: toUtcDateOnlyIso(form.eventDateUtc),
        endDateUtc: toUtcDateOnlyIso(form.endDateUtc),
        registrationPaymentStartDateUtc: toUtcDateOnlyIso(form.registrationPaymentStartDateUtc),
        registrationInstallments: form.registrationInstallments.map((installment) => ({
          dueDateUtc: toUtcDateOnlyIso(installment.dueDateUtc),
          amount: Number(installment.amount)
        })),
        storeFeePercentage: Number(form.storeFeePercentage),
        registrationFeeSplitCount: Math.max(1, form.supplierIds.length + 1)
      };
      return isEditing ? fairsApi.update(id!, payload) : fairsApi.create(payload);
    },
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Feira salva com sucesso.' });
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['fair', id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/feiras', { state: { preserveState: true } });
    },
    onError: (error) => {
      setFeedback({ severity: 'error', message: getErrorMessage(error, 'Nao foi possivel salvar a feira.') });
    }
  });

  function updateField(field: keyof typeof emptyForm, value: string | number | string[]) {
    setForm((current) => {
      if (field === 'eventDateUtc' && typeof value === 'string') {
        const adjustedEndDate = current.endDateUtc < value ? value : current.endDateUtc;
        return {
          ...current,
          eventDateUtc: value,
          endDateUtc: adjustedEndDate
        };
      }

      if (field === 'endDateUtc' && typeof value === 'string') {
        return {
          ...current,
          endDateUtc: value < current.eventDateUtc ? current.eventDateUtc : value
        };
      }

      return { ...current, [field]: value };
    });
  }

  function updateSupplierIds(value: string | string[]) {
    const supplierIds = Array.isArray(value) ? value : value.split(',').filter(Boolean);
    updateField('supplierIds', supplierIds);
  }

  function updateInstallment(index: number, field: 'dueDateUtc' | 'amount', value: string | number) {
    setForm((current) => {
      const installments = [...current.registrationInstallments];
      installments[index] = {
        ...installments[index],
        [field]: field === 'amount' ? Number(value) : value
      };

      return { ...current, registrationInstallments: installments };
    });
  }

  function addInstallment() {
    setForm((current) => ({
      ...current,
      registrationInstallments: [...current.registrationInstallments, { dueDateUtc: current.registrationPaymentStartDateUtc, amount: 0 }]
    }));
  }

  function removeInstallment(index: number) {
    setForm((current) => {
      if (current.registrationInstallments.length === 1) {
        return current;
      }

      return {
        ...current,
        registrationInstallments: current.registrationInstallments.filter((_item, itemIndex) => itemIndex !== index)
      };
    });
  }

  function generateEqualInstallments() {
    const count = Math.max(1, Math.floor(equalInstallmentsCount || 1));
    const baseAmount = count === 0 ? form.registrationFee : Number((form.registrationFee / count).toFixed(2));
    const generated = Array.from({ length: count }, (_item, index) => {
      const dueDate = new Date(`${form.registrationPaymentStartDateUtc}T00:00:00`);
      dueDate.setMonth(dueDate.getMonth() + index);
      const isLast = index === count - 1;
      const usedAmount = baseAmount * index;
      const amount = isLast ? Number((form.registrationFee - usedAmount).toFixed(2)) : baseAmount;

      return {
        dueDateUtc: dueDate.toISOString().slice(0, 10),
        amount
      };
    });

    setForm((current) => ({ ...current, registrationInstallments: generated }));
  }

  const selectedSuppliers = (metadata?.suppliers ?? []).filter((item) => form.supplierIds.includes(item.id));
  const installmentsTotal = form.registrationInstallments.reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const installmentDifference = Number((form.registrationFee - installmentsTotal).toFixed(2));
  const storeRegistrationShare = Number((form.registrationFee * (form.storeFeePercentage / 100)).toFixed(2));
  const supplierRegistrationShare = Number((form.registrationFee - storeRegistrationShare).toFixed(2));
  const supplierMonthlyEstimate = selectedSuppliers.length > 0
    ? supplierRegistrationShare / selectedSuppliers.length
    : 0;
  const hasBlockingError = form.endDateUtc < form.eventDateUtc || (form.registrationFee > 0 && installmentDifference !== 0);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h3">{isEditing ? 'Editar feira' : 'Nova feira'}</Typography>
          <Typography color="text.secondary">Blocos numerados; o rateio da inscrição é calculado ao lado em tempo real.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/feiras', { state: { preserveState: true } })} sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}>
          Voltar para listagem
        </Button>
      </Stack>

      {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <PageSection title="1 · Identificação" subtitle="Nome, local e período do evento.">
            <Stack spacing={2}>
              <TextField label="Nome da feira" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              <TextField label="Local" value={form.location} onChange={(event) => updateField('location', event.target.value)} />
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                <TextField
                  label="Data inicial"
                  type="date"
                  value={form.eventDateUtc}
                  onChange={(event) => updateField('eventDateUtc', event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Data final"
                  type="date"
                  value={form.endDateUtc}
                  onChange={(event) => updateField('endDateUtc', event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: form.eventDateUtc }}
                  fullWidth
                />
              </Box>
              {form.endDateUtc < form.eventDateUtc ? <Alert severity="error">A data final nao pode ser anterior a data inicial.</Alert> : null}
            </Stack>
          </PageSection>

          <PageSection title="2 · Custos e fornecedores" subtitle="Inscrição paga pela lojinha, rateio e parcelas.">
            <Stack spacing={2}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                <CurrencyField label="Taxa de inscrição" value={form.registrationFee} onValueChange={(value) => updateField('registrationFee', value)} fullWidth />
                <TextField
                  label="Início do pagamento da inscrição"
                  type="date"
                  value={form.registrationPaymentStartDateUtc}
                  onChange={(event) => updateField('registrationPaymentStartDateUtc', event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>

              <Stack spacing={2} sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.62)', borderRadius: 2 }}>
                <Stack>
                  <Typography variant="body2" fontWeight={600}>Rateio da inscrição</Typography>
                  <Typography variant="caption" color="text.secondary">{form.storeFeePercentage.toFixed(0)}% lojinha • {(100 - form.storeFeePercentage).toFixed(0)}% fornecedores</Typography>
                </Stack>

                <Box>
                  <Box sx={{ display: 'flex', height: 24, borderRadius: 1, overflow: 'hidden', mb: 1.5, border: '1px solid rgba(0,0,0,0.12)' }}>
                    <Box sx={{ flex: form.storeFeePercentage, backgroundColor: form.storeFeePercentage === 0 ? 'rgba(156, 39, 176, 0.12)' : form.storeFeePercentage < 30 ? 'rgba(156, 39, 176, 0.3)' : form.storeFeePercentage < 70 ? 'rgba(76, 175, 80, 0.3)' : form.storeFeePercentage < 100 ? 'rgba(33, 150, 243, 0.3)' : 'rgba(33, 150, 243, 0.6)', transition: 'all 200ms' }} />
                    <Box sx={{ flex: 100 - form.storeFeePercentage, backgroundColor: form.storeFeePercentage === 100 ? 'rgba(255, 193, 7, 0.12)' : form.storeFeePercentage > 70 ? 'rgba(255, 193, 7, 0.3)' : form.storeFeePercentage > 30 ? 'rgba(255, 152, 0, 0.3)' : form.storeFeePercentage > 0 ? 'rgba(255, 152, 0, 0.3)' : 'rgba(244, 67, 54, 0.3)', transition: 'all 200ms' }} />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    <Box sx={{ flex: form.storeFeePercentage, textAlign: 'center' }}>Lojinha</Box>
                    <Box sx={{ flex: 100 - form.storeFeePercentage, textAlign: 'center' }}>Fornecedores</Box>
                  </Stack>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant={form.storeFeePercentage === 0 ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => updateField('storeFeePercentage', 0)}
                    sx={{ flex: 1 }}
                    color={form.storeFeePercentage === 0 ? 'error' : 'inherit'}
                  >
                    Fornecedores
                  </Button>
                  <Button
                    variant={form.storeFeePercentage === 50 ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => updateField('storeFeePercentage', 50)}
                    sx={{ flex: 1 }}
                    color={form.storeFeePercentage === 50 ? 'success' : 'inherit'}
                  >
                    Meio a meio
                  </Button>
                  <Button
                    variant={form.storeFeePercentage === 100 ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => updateField('storeFeePercentage', 100)}
                    sx={{ flex: 1 }}
                    color={form.storeFeePercentage === 100 ? 'info' : 'inherit'}
                  >
                    Lojinha
                  </Button>
                </Stack>

                <Slider
                  aria-label="Percentual da inscricao pago pela lojinha"
                  value={form.storeFeePercentage}
                  onChange={(_, value) => updateField('storeFeePercentage', value as number)}
                  min={0}
                  max={100}
                  step={5}
                  marks={[{ value: 0, label: '0%' }, { value: 50, label: '50%' }, { value: 100, label: '100%' }]}
                />
              </Stack>

              <Stack spacing={1}>
                <FormControl fullWidth>
                  <InputLabel id="fair-suppliers-label">Fornecedores participantes</InputLabel>
                  <Select
                    labelId="fair-suppliers-label"
                    multiple
                    value={form.supplierIds}
                    onChange={(event) => updateSupplierIds(event.target.value)}
                    input={<OutlinedInput label="Fornecedores participantes" />}
                    label="Fornecedores participantes"
                    renderValue={(selected) => {
                      const values = selected as string[];
                      if (values.length === 0) {
                        return 'Nenhum fornecedor selecionado';
                      }

                      return (metadata?.suppliers ?? [])
                        .filter((item) => values.includes(item.id))
                        .map((item) => item.name)
                        .join(', ');
                    }}
                  >
                    {(metadata?.suppliers ?? []).map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        <Checkbox checked={form.supplierIds.includes(item.id)} />
                        <ListItemText primary={item.name} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedSuppliers.length > 0 ? (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {selectedSuppliers.map((item) => <Chip key={item.id} label={item.name} size="small" />)}
                  </Stack>
                ) : null}
              </Stack>

              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">Composição de parcelas da inscrição</Typography>
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '160px 1fr' }, alignItems: 'center' }}>
                  <TextField
                    label="Qtd. parcelas iguais"
                    type="number"
                    value={equalInstallmentsCount}
                    onChange={(event) => setEqualInstallmentsCount(Number(event.target.value))}
                    fullWidth
                  />
                  <Button variant="outlined" onClick={generateEqualInstallments}>Gerar parcelas iguais</Button>
                </Box>
                {form.registrationInstallments.map((installment, index) => (
                  <InstallmentRow
                    key={index}
                    index={index}
                    installment={installment}
                    canRemove={form.registrationInstallments.length > 1}
                    onDueDateChange={(value) => updateInstallment(index, 'dueDateUtc', value)}
                    onAmountChange={(value) => updateInstallment(index, 'amount', value)}
                    onRemove={() => removeInstallment(index)}
                  />
                ))}
                <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={addInstallment} sx={{ alignSelf: 'flex-start' }}>
                  Adicionar parcela
                </Button>
                {form.registrationFee > 0 && installmentDifference !== 0 ? <Alert severity="error">A soma das parcelas precisa fechar exatamente em {formatCurrency(form.registrationFee)}.</Alert> : null}
              </Stack>
            </Stack>
          </PageSection>

          <PageSection title="3 · Observações" subtitle="Notas internas do evento, opcional.">
            <TextField label="Observações" multiline minRows={4} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} fullWidth />
          </PageSection>
        </Stack>

        <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <PageSection title="Resumo" subtitle="">
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Inscrição total</Typography>
                <Typography>{formatCurrency(form.registrationFee)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Parte da lojinha ({form.storeFeePercentage.toFixed(0)}%)</Typography>
                <Typography>{formatCurrency(storeRegistrationShare)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Cota dos fornecedores</Typography>
                <Typography>{formatCurrency(supplierRegistrationShare)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Por fornecedor ({selectedSuppliers.length || '—'})</Typography>
                <Typography>{selectedSuppliers.length === 0 ? '—' : formatCurrency(supplierMonthlyEstimate)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, mt: 0.5, borderTop: '1px dashed rgba(217,107,135,0.3)' }}>
                <Typography variant="h6">Soma das parcelas</Typography>
                <Typography variant="h6" sx={{ color: installmentDifference === 0 ? 'inherit' : 'error.main' }}>{formatCurrency(installmentsTotal)}</Typography>
              </Stack>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} spacing={1.5} sx={{ mt: 2 }}>
              <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => mutation.mutate()} disabled={mutation.isLoading || hasBlockingError} fullWidth>
                {mutation.isLoading ? 'Salvando...' : isEditing ? 'Atualizar feira' : 'Cadastrar feira'}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/feiras', { state: { preserveState: true } })} fullWidth>
                Cancelar
              </Button>
            </Stack>
          </PageSection>
        </Stack>
      </Box>
    </Stack>
  );
}
