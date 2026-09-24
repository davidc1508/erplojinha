import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import type { ProductPaintingRecalculation } from '../../services/types';
import { formatCurrency } from '../paintingPricing/paintingPricingShared';

interface PaintingRecalculationDialogProps {
  open: boolean;
  isLoading: boolean;
  error?: string | null;
  data?: ProductPaintingRecalculation | null;
  onCancel: () => void;
  onApply: () => void;
}

function signed(value: number) {
  return `${value >= 0 ? '+ ' : '− '}${formatCurrency(Math.abs(value))}`;
}

export function PaintingRecalculationDialog({ open, isLoading, error, data, onCancel, onApply }: PaintingRecalculationDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const stored = data?.stored;
  const next = data?.recalculated;
  const rows = stored && next ? [
    { label: 'Valor-hora', before: stored.details?.hourlyRate, after: next.details?.hourlyRate },
    { label: 'Horas utilizadas', before: stored.details?.totalHours, after: next.details?.totalHours, hours: true },
    { label: 'Mão de obra', before: stored.details?.laborAmount, after: next.details?.laborAmount },
    { label: 'Materiais', before: stored.details?.materialsAmount, after: next.details?.materialsAmount },
    { label: 'Preparação', before: stored.details?.preparationAmount, after: next.details?.preparationAmount },
    { label: 'Adicionais', before: stored.details?.addOnsAmount, after: next.details?.addOnsAmount },
    { label: 'Preço comercial sugerido', before: stored.suggestedPrice, after: next.suggestedPrice }
  ].filter((row) => row.before !== undefined && row.after !== undefined) : [];

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle>Recalcular pintura</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">Compara o que está salvo no produto com os parâmetros atuais do módulo. Nada muda até você aplicar.</Typography>
          {isLoading ? <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={28} /></Stack> : null}
          {error ? <Alert severity="warning">{error}</Alert> : null}
          {!isLoading && !error && !data ? <Alert severity="success">Nenhuma diferença: o cálculo exibido já usa os parâmetros atuais do módulo.</Alert> : null}
          {data && !data.hasDifferences ? <Alert severity="success">Nenhuma diferença: o produto já usa os parâmetros atuais.</Alert> : null}
          {data && data.hasDifferences ? (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', columnGap: 2, rowGap: 1, alignItems: 'baseline' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>Parâmetro</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textAlign="right">Atual</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700} textAlign="right">Novo</Typography>
                {rows.map((row) => {
                  const changed = row.before !== row.after;
                  const format = (value?: number) => value === undefined ? '—' : row.hours ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h` : formatCurrency(value);
                  return (
                    <Box key={row.label} sx={{ display: 'contents' }}>
                      <Typography variant="body2">{row.label}</Typography>
                      <Typography variant="body2" textAlign="right" noWrap>{format(row.before)}</Typography>
                      <Typography variant="body2" textAlign="right" noWrap fontWeight={changed ? 800 : 400} color={changed ? 'primary.dark' : 'text.primary'}>{format(row.after)}</Typography>
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', p: 1.5, borderRadius: 3, bgcolor: 'rgba(251,243,239,0.9)' }}>
                <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Custo atual</Typography><Typography fontWeight={800}>{formatCurrency(stored?.costAmount ?? 0)}</Typography></div>
                <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Novo cálculo</Typography><Typography fontWeight={800}>{formatCurrency(next?.costAmount ?? 0)}</Typography></div>
                <div><Typography variant="caption" color="text.secondary" fontWeight={700}>Diferença</Typography><Typography fontWeight={800} color="primary.dark">{signed(data.costDifference)}</Typography></div>
              </Box>
              {data.priceDifference !== 0 ? <Typography variant="body2" color="text.secondary">Preço de venda da pintura: {signed(data.priceDifference)}</Typography> : null}
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="outlined" onClick={onCancel}>{data?.hasDifferences ? 'Cancelar' : 'Fechar'}</Button>
        {data?.hasDifferences ? <Button variant="contained" onClick={onApply}>Aplicar novos valores</Button> : null}
      </DialogActions>
    </Dialog>
  );
}
