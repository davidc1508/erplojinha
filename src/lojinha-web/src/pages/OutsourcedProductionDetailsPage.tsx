import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import InventoryRoundedIcon from '@mui/icons-material/InventoryRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { CurrencyField } from '../components/CurrencyField';
import { outsourcedProductionsApi } from '../services/api';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" py={0.5}>
      <Typography fontSize={13} color="text.secondary">{label}</Typography>
      <Typography fontSize={13} fontWeight={600}>{value}</Typography>
    </Stack>
  );
}

interface ConvertDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    salePrice: number | null;
    finishingPercentage: number | null;
    commissionPercentage: number | null;
    desiredMarkup: number | null;
    includeProductionFeeAsAdditionalCost: boolean;
  }) => void;
  isPending: boolean;
  supplierCost: number;
  productionCost: number;
  defaultMarkup: number;
  defaultFinishing: number;
}

function ConvertDialog({ open, onClose, onConfirm, isPending, supplierCost, productionCost, defaultMarkup, defaultFinishing }: ConvertDialogProps) {
  const [salePrice, setSalePrice] = useState<number | null>(null);
  const [finishingPercentage, setFinishingPercentage] = useState<number>(defaultFinishing);
  const [commissionPercentage, setCommissionPercentage] = useState<number>(20);
  const [desiredMarkup, setDesiredMarkup] = useState<number>(defaultMarkup);
  const [includeProductionFee, setIncludeProductionFee] = useState(true);

  const fee = supplierCost - productionCost;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Converter em Produto</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Alert severity="info" icon={false}>
            O produto será criado com todos os dados de custo desta produção. O fornecedor destinatário poderá definir o preço de venda.
          </Alert>

          <FormControlLabel
            control={
              <Checkbox
                checked={includeProductionFee}
                onChange={(e) => setIncludeProductionFee(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography fontSize={14}>Incluir taxa de produção como custo adicional</Typography>
                <Typography fontSize={12} color="text.secondary">
                  Taxa: {formatCurrency(fee)} (diferença entre custo fornecedor e custo de produção)
                </Typography>
              </Box>
            }
          />

          <Divider />
          <Typography variant="subtitle2">Campos editáveis no produto (opcionais)</Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Acabamento (%)"
                type="number"
                fullWidth
                size="small"
                value={finishingPercentage}
                onChange={(e) => setFinishingPercentage(Number(e.target.value))}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Comissão (%)"
                type="number"
                fullWidth
                size="small"
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(Number(e.target.value))}
                inputProps={{ min: 0, max: 100, step: 0.5 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Markup"
                type="number"
                fullWidth
                size="small"
                value={desiredMarkup}
                onChange={(e) => setDesiredMarkup(Number(e.target.value))}
                inputProps={{ min: 1, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <CurrencyField
                label="Preço de venda (R$)"
                value={salePrice ?? 0}
                onValueChange={(v) => setSalePrice(v > 0 ? v : null)}
                size="small"
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={isPending}
          onClick={() => onConfirm({
            salePrice,
            finishingPercentage: finishingPercentage || null,
            commissionPercentage: commissionPercentage || null,
            desiredMarkup: desiredMarkup || null,
            includeProductionFeeAsAdditionalCost: includeProductionFee
          })}
        >
          {isPending ? 'Convertendo...' : 'Converter em Produto'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function OutsourcedProductionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [convertOpen, setConvertOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const { data: production, isLoading } = useQuery({
    queryKey: ['outsourced-production', id],
    queryFn: () => outsourcedProductionsApi.getById(id!)
  });

  const convertMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      outsourcedProductionsApi.convertToProduct(id!, payload),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['outsourced-productions'] });
      queryClient.invalidateQueries({ queryKey: ['outsourced-production', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setConvertOpen(false);
      setFeedback({ type: 'success', msg: `Produto "${product.name}" criado com sucesso!` });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFeedback({ type: 'error', msg: msg ?? 'Erro ao converter em produto.' });
    }
  });

  if (isLoading) {
    return <Box p={3}><Typography>Carregando...</Typography></Box>;
  }

  if (!production) {
    return <Box p={3}><Typography>Produção não encontrada.</Typography></Box>;
  }

  const isPending = production.status === 'Pendente';
  const isConverted = production.status === 'ConvertidoEmProduto';

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <IconButton onClick={() => navigate('/producao-terceirizada')}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>{production.name}</Typography>
          {production.category && (
            <Typography color="text.secondary" fontSize={13}>{production.category}</Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          {isPending && (
            <>
              <Button
                component={RouterLink}
                to={`/producao-terceirizada/${id}/editar`}
                variant="outlined"
                startIcon={<EditRoundedIcon />}
              >
                Editar
              </Button>
              <Button
                variant="contained"
                startIcon={<InventoryRoundedIcon />}
                onClick={() => setConvertOpen(true)}
              >
                Converter em Produto
              </Button>
            </>
          )}
          {isConverted && production.convertedProductId && (
            <Button
              component={RouterLink}
              to={`/produtos/${production.convertedProductId}`}
              variant="outlined"
              startIcon={<OpenInNewRoundedIcon />}
            >
              Ver Produto
            </Button>
          )}
        </Stack>
      </Stack>

      {isConverted && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Esta produção foi convertida em produto.
          {production.convertedProductId && (
            <> <RouterLink to={`/produtos/${production.convertedProductId}`}>Ver produto →</RouterLink></>
          )}
        </Alert>
      )}

      {feedback && (
        <Alert severity={feedback.type} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>
          {feedback.msg}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Fluxo de Produção */}
        <PageSection title="Fluxo de Produção">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography fontSize={12} color="text.secondary" mb={0.5}>Produtor (quem fabrica)</Typography>
              <Typography fontWeight={700} fontSize={16}>{production.producerSupplier}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography fontSize={12} color="text.secondary" mb={0.5}>Destinatário (quem vai vender)</Typography>
              <Typography fontWeight={700} fontSize={16}>{production.ownerSupplier}</Typography>
            </Grid>
          </Grid>
        </PageSection>

        {/* Custos */}
        <PageSection title="Custos de Produção">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Box p={2} bgcolor="action.hover" borderRadius={1}>
                <Typography fontSize={12} color="text.secondary">Custo de Produção</Typography>
                <Typography variant="h6" fontWeight={700}>{formatCurrency(production.productionCost)}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box p={2} bgcolor="action.hover" borderRadius={1}>
                <Typography fontSize={12} color="text.secondary">Taxa de Produção</Typography>
                <Typography variant="h6" fontWeight={700}>{production.productionFeePercentage}%</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box p={2} bgcolor="primary.light" borderRadius={1}>
                <Typography fontSize={12} color="primary.contrastText">Custo para o Fornecedor</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.contrastText">
                  {formatCurrency(production.supplierCost)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </PageSection>

        {/* Parâmetros Técnicos */}
        <PageSection title="Parâmetros Técnicos">
          <Grid container spacing={0}>
            <Grid item xs={12} sm={6}>
              <InfoRow label="Impressora" value={production.printer ?? '—'} />
              <InfoRow label="Marketplace" value={production.marketplace ?? '—'} />
              <InfoRow label="Itens por placa" value={production.itemsPerPlate} />
              <InfoRow label="Tempo de impressão" value={`${Math.floor(production.estimatedPrintTimeMinutes / 60)}h ${Math.round(production.estimatedPrintTimeMinutes % 60)}min`} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <InfoRow label="Tarifa kWh" value={formatCurrency(production.tariffPerKwh)} />
              <InfoRow label="Acabamento" value={`${production.finishingPercentage}%`} />
              <InfoRow label="Custo adicional" value={formatCurrency(production.additionalCost)} />
              <InfoRow label="Markup" value={`${production.desiredMarkup}x`} />
            </Grid>
          </Grid>
        </PageSection>

        {/* Filamentos */}
        {production.filaments.length > 0 && (
          <PageSection title="Filamentos">
            {production.filaments.map((f, i) => (
              <Stack key={i} direction="row" justifyContent="space-between" py={0.5}>
                <Typography fontSize={13}>{f.filamentName}</Typography>
                <Typography fontSize={13} fontWeight={600}>{f.weightGrams}g</Typography>
              </Stack>
            ))}
          </PageSection>
        )}
      </Stack>

      <ConvertDialog
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConfirm={(payload) => convertMutation.mutate(payload as Record<string, unknown>)}
        isPending={convertMutation.isLoading}
        supplierCost={production.supplierCost}
        productionCost={production.productionCost}
        defaultMarkup={production.desiredMarkup}
        defaultFinishing={production.finishingPercentage}
      />
    </Box>
  );
}
