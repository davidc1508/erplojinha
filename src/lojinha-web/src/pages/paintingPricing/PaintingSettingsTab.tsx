import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, MenuItem, Pagination, Paper, Stack, TextField, Typography } from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useEffect, useMemo, useState } from 'react';
import { CurrencyField } from '../../components/CurrencyField';
import { PageSection } from '../../components/PageSection';
import { paintingPricingApi } from '../../services/api';
import type { PaintingPriceRounding, PaintingSettings } from '../../services/types';
import {
  auditActionLabels,
  getErrorMessage,
  historyValueLabel,
  paintingHistoryQueryKey,
  paintingPricingQueryKey,
  roundingLabels,
  toOptionalNumber
} from './paintingPricingShared';

interface SettingsForm {
  defaultHourlyRate: number;
  defaultMaterialsPercentage: string;
  minimumMaterialsAmount: number;
  minimumPaintingPrice: number;
  defaultMarginPercentage: string;
  rounding: PaintingPriceRounding;
}

function toForm(settings: PaintingSettings): SettingsForm {
  return {
    defaultHourlyRate: settings.defaultHourlyRate,
    defaultMaterialsPercentage: String(settings.defaultMaterialsPercentage),
    minimumMaterialsAmount: settings.minimumMaterialsAmount,
    minimumPaintingPrice: settings.minimumPaintingPrice,
    defaultMarginPercentage: String(settings.defaultMarginPercentage),
    rounding: settings.rounding
  };
}

const historyPageSize = 10;

export function PaintingSettingsTab({ settings, canEdit }: { settings: PaintingSettings; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(() => toForm(settings));
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [historyType, setHistoryType] = useState('all');
  const [historyPage, setHistoryPage] = useState(1);
  const { data: history = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: paintingHistoryQueryKey,
    queryFn: () => paintingPricingApi.getHistory(),
    enabled: canEdit
  });

  useEffect(() => {
    setForm(toForm(settings));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const materialsPercentage = toOptionalNumber(form.defaultMaterialsPercentage) ?? 0;
      const marginPercentage = toOptionalNumber(form.defaultMarginPercentage) ?? 0;
      if (materialsPercentage < 0 || marginPercentage < 0) {
        throw new Error('Percentuais não podem ser negativos.');
      }

      return paintingPricingApi.updateSettings({
        defaultHourlyRate: form.defaultHourlyRate,
        defaultMaterialsPercentage: materialsPercentage,
        minimumMaterialsAmount: form.minimumMaterialsAmount,
        minimumPaintingPrice: form.minimumPaintingPrice,
        defaultMarginPercentage: marginPercentage,
        rounding: form.rounding
      });
    },
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Configurações de pintura salvas. Preços já definidos em produtos não são alterados.' });
      await queryClient.invalidateQueries({ queryKey: paintingPricingQueryKey });
      await queryClient.invalidateQueries({ queryKey: paintingHistoryQueryKey });
    },
    onError: (error) => setFeedback({ severity: 'error', message: error instanceof Error && !('response' in error) ? error.message : getErrorMessage(error, 'Não foi possível salvar as configurações.') })
  });

  const historyTypes = useMemo(() => Array.from(new Set(history.map((entry) => entry.entityType))).sort(), [history]);
  const filteredHistory = historyType === 'all' ? history : history.filter((entry) => entry.entityType === historyType);
  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const visibleHistory = filteredHistory.slice((currentHistoryPage - 1) * historyPageSize, currentHistoryPage * historyPageSize);

  return (
    <Stack spacing={3}>
      <PageSection title="Configurações gerais" subtitle="Valores usados quando nenhum nível ou simulação sobrescreve o parâmetro.">
        <Stack spacing={2.5}>
          {feedback ? <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>{feedback.message}</Alert> : null}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
            <CurrencyField label="Valor-hora padrão" value={form.defaultHourlyRate} onValueChange={(value) => setForm({ ...form, defaultHourlyRate: value })} helperText="Usado quando o nível não define valor-hora." disabled={!canEdit} fullWidth />
            <TextField label="Percentual de materiais" type="number" value={form.defaultMaterialsPercentage} onChange={(event) => setForm({ ...form, defaultMaterialsPercentage: event.target.value })} InputProps={{ endAdornment: <Typography color="text.secondary">%</Typography> }} helperText="Aplicado sobre a mão de obra." disabled={!canEdit} fullWidth />
            <CurrencyField label="Valor mínimo de materiais" value={form.minimumMaterialsAmount} onValueChange={(value) => setForm({ ...form, minimumMaterialsAmount: value })} helperText="Materiais nunca ficam abaixo deste valor." disabled={!canEdit} fullWidth />
            <CurrencyField label="Valor mínimo de pintura" value={form.minimumPaintingPrice} onValueChange={(value) => setForm({ ...form, minimumPaintingPrice: value })} helperText="Piso do preço calculado automaticamente." disabled={!canEdit} fullWidth />
            <TextField label="Margem adicional padrão" type="number" value={form.defaultMarginPercentage} onChange={(event) => setForm({ ...form, defaultMarginPercentage: event.target.value })} InputProps={{ endAdornment: <Typography color="text.secondary">%</Typography> }} helperText="0% = sem margem sobre o custo." disabled={!canEdit} fullWidth />
            <TextField select label="Arredondamento comercial" value={form.rounding} onChange={(event) => setForm({ ...form, rounding: event.target.value as PaintingPriceRounding })} helperText="Sempre para cima, só no preço sugerido." disabled={!canEdit} fullWidth>
              {(Object.keys(roundingLabels) as PaintingPriceRounding[]).map((rounding) => <MenuItem key={rounding} value={rounding}>{roundingLabels[rounding]}</MenuItem>)}
            </TextField>
          </Box>
          {canEdit ? (
            <Box>
              <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}>
                {saveMutation.isLoading ? 'Salvando...' : 'Salvar configurações'}
              </Button>
            </Box>
          ) : null}
        </Stack>
      </PageSection>

      {canEdit ? (
        <PageSection
          title="Histórico de alterações"
          subtitle="Valor anterior, valor novo, usuário e data de cada mudança nos parâmetros de pintura."
          action={(
            <TextField select size="small" label="Tipo" value={historyType} onChange={(event) => { setHistoryType(event.target.value); setHistoryPage(1); }} sx={{ minWidth: 220 }} fullWidth>
              <MenuItem value="all">Todos</MenuItem>
              {historyTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
            </TextField>
          )}
        >
          <Stack spacing={1.5}>
            {isHistoryLoading ? <Typography color="text.secondary">Carregando histórico...</Typography> : null}
            {!isHistoryLoading && visibleHistory.length === 0 ? <Alert severity="info">Nenhuma alteração registrada ainda.</Alert> : null}
            {visibleHistory.map((entry) => (
              <Paper key={entry.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Stack spacing={1}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={auditActionLabels[entry.action] ?? entry.action} color={entry.action === 'Deleted' ? 'error' : entry.action === 'Created' ? 'success' : 'primary'} />
                      <Typography fontWeight={700}>{entry.entityType}{entry.name ? ` · ${entry.name}` : ''}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{new Date(entry.changedAtUtc).toLocaleString('pt-BR')} · {entry.changedBy}</Typography>
                  </Stack>
                  {entry.changes.length > 0 ? (
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {entry.changes.map((change) => (
                        <Typography component="li" variant="body2" key={change.field} sx={{ overflowWrap: 'anywhere' }}>
                          <strong>{change.field}:</strong> {historyValueLabel(change.before)} → {historyValueLabel(change.after)}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                </Stack>
              </Paper>
            ))}
            {filteredHistory.length > historyPageSize ? (
              <Pagination page={currentHistoryPage} count={historyPageCount} onChange={(_, value) => setHistoryPage(value)} />
            ) : null}
          </Stack>
        </PageSection>
      ) : null}
    </Stack>
  );
}
