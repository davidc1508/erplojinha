import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useMemo, useState } from 'react';
import { PageSection } from '../components/PageSection';
import { useAuth } from '../hooks/useAuth';
import { personalizadosApi, productsApi } from '../services/api';
import { formatCurrency, paymentMethodLabel } from '../services/labels';
import { PersonalizedPricingTier, PersonalizedProject } from '../services/types';

const defaultRanges: Omit<PersonalizedPricingTier, 'id'>[] = [
  { order: 1, minSizeCm: 0, maxSizeCm: 5, finishedPriceBRL: 0, unpaintedPriceBRL: 0, isActive: true },
  { order: 2, minSizeCm: 6, maxSizeCm: 10, finishedPriceBRL: 0, unpaintedPriceBRL: 0, isActive: true },
  { order: 3, minSizeCm: 11, maxSizeCm: 15, finishedPriceBRL: 0, unpaintedPriceBRL: 0, isActive: true },
  { order: 4, minSizeCm: 16, maxSizeCm: 20, finishedPriceBRL: 0, unpaintedPriceBRL: 0, isActive: true },
  { order: 5, minSizeCm: 21, maxSizeCm: 25, finishedPriceBRL: 0, unpaintedPriceBRL: 0, isActive: true },
  { order: 6, minSizeCm: 26, maxSizeCm: undefined, finishedPriceBRL: 0, unpaintedPriceBRL: 0, isActive: true }
];

function stepDone(project: PersonalizedProject, name: string) {
  return project.project.steps.some((step) => step.name === name && step.status === 'Concluida');
}

const PERSONALIZADOS_STAGES = [
  { key: 'orcamento', label: 'Orçamento' },
  { key: 'modelagem', label: 'Modelagem 3D' },
  { key: 'aprovacao', label: 'Aprovação' },
  { key: 'producao', label: 'Impressão' },
  { key: 'acabamento', label: 'Acabamento' },
  { key: 'pronto', label: 'Pronto p/ venda' },
  { key: 'vendido', label: 'Vendido' }
] as const;

function getPersonalizadoStage(item: PersonalizedProject): string {
  if (item.project.status === 'Cancelado') return 'cancelado';
  if (item.saleId) return 'vendido';
  if (stepDone(item, 'Acabamento')) return 'pronto';
  if (stepDone(item, 'Impressão')) return 'acabamento';
  if (stepDone(item, 'Aprovação do projeto')) return 'producao';
  if (stepDone(item, 'Elaboração modelo 3D')) return 'aprovacao';
  if (stepDone(item, 'Orçamento')) return 'modelagem';
  return 'orcamento';
}

export function PersonalizadosPage() {
  const { session } = useAuth();
  const isAdmin = session?.role === 'Admin';
  const queryClient = useQueryClient();

  const [feedback, setFeedback] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', description: '', sizeMinCm: 10, sizeMaxCm: 15, isPainted: true });

  const [budgetDialog, setBudgetDialog] = useState<{ open: boolean; projectId: string; sizeMinCm: number; sizeMaxCm: number; isPainted: boolean }>({
    open: false,
    projectId: '',
    sizeMinCm: 10,
    sizeMaxCm: 15,
    isPainted: true
  });

  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; projectId: string; reason: string }>({
    open: false,
    projectId: '',
    reason: ''
  });

  const [printProductDialog, setPrintProductDialog] = useState({
    open: false,
    projectId: '',
    realSizeCm: 10,
    name: '',
    sku: '',
    description: '',
    supplierId: '',
    itemsPerPlate: 1,
    estimatedPrintTimeMinutes: 0,
    heightCentimeters: 0,
    lengthMetersUsed: 0,
    tariffPerKwh: 1,
    finishingPercentage: 0,
    commissionPercentage: 0,
    printerProfileId: '',
    marketplaceFeeId: '',
    additionalCost: 0,
    desiredMarkup: 2,
    costPrice: '',
    salePrice: ''
  });

  const [printFinishDialog, setPrintFinishDialog] = useState({ open: false, projectId: '', timeRealMinutes: 0, producedQuantity: 1 });
  const [finishingDialog, setFinishingDialog] = useState({ open: false, projectId: '', timeRealMinutes: 0 });
  const [finalizeDialog, setFinalizeDialog] = useState({ open: false, projectId: '', paymentMethod: 'Pix', quantity: 1, notes: '' });

  const { data: pricingData = [] } = useQuery({ queryKey: ['personalizados-pricing'], queryFn: personalizadosApi.getPricing });
  const { data: projects = [] } = useQuery({ queryKey: ['personalizados-projects'], queryFn: personalizadosApi.getAll });
  const { data: metadata } = useQuery({ queryKey: ['products-metadata'], queryFn: productsApi.getMetadata });

  const [pricingDraft, setPricingDraft] = useState<PersonalizedPricingTier[]>([]);

  const noneMarketplaceId = useMemo(() => {
    const none = (metadata?.marketplaces ?? []).find((item) => item.name.trim().toLowerCase() === 'nenhum');
    return none?.id ?? '';
  }, [metadata?.marketplaces]);

  const effectivePricing = useMemo(() => {
    if (pricingDraft.length > 0) {
      return pricingDraft;
    }

    if (pricingData.length > 0) {
      return pricingData;
    }

    return defaultRanges.map((item, index) => ({ ...item, id: `draft-${index}` }));
  }, [pricingData, pricingDraft]);

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: ['personalizados-pricing'] });
    await queryClient.invalidateQueries({ queryKey: ['personalizados-projects'] });
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    await queryClient.invalidateQueries({ queryKey: ['products-sales-catalog'] });
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    await queryClient.invalidateQueries({ queryKey: ['sales'] });
    await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
    await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
  };

  const savePricingMutation = useMutation({
    mutationFn: async () => personalizadosApi.savePricing(
      effectivePricing
        .sort((left, right) => left.order - right.order)
        .map((item) => ({
          order: item.order,
          minSizeCm: Number(item.minSizeCm),
          maxSizeCm: item.maxSizeCm === undefined || item.maxSizeCm === null || item.maxSizeCm === ('' as unknown as number) ? null : Number(item.maxSizeCm),
          finishedPriceBRL: Number(item.finishedPriceBRL),
          unpaintedPriceBRL: Number(item.unpaintedPriceBRL),
          isActive: item.isActive
        }))
    ),
    onSuccess: async (data) => {
      setPricingDraft(data);
      setFeedback('Tabela de valores de personalizados salva.');
      await reload();
    },
    onError: () => setFeedback('Nao foi possivel salvar a tabela de personalizados.')
  });

  const createMutation = useMutation({
    mutationFn: async () => personalizadosApi.create({
      name: createForm.name,
      description: createForm.description,
      sizeMinCm: Number(createForm.sizeMinCm),
      sizeMaxCm: Number(createForm.sizeMaxCm),
      isPainted: createForm.isPainted
    }),
    onSuccess: async () => {
      setFeedback('Pedido personalizado criado com etapas fixas.');
      setCreateForm({ name: '', description: '', sizeMinCm: 10, sizeMaxCm: 15, isPainted: true });
      await reload();
    },
    onError: () => setFeedback('Nao foi possivel criar o personalizado. Verifique a tabela de valores.')
  });

  const simpleActionMutation = useMutation({
    mutationFn: async ({ action, projectId }: { action: 'advanceBudget' | 'advanceModeling' | 'approve'; projectId: string }) => {
      if (action === 'advanceBudget') return personalizadosApi.advanceBudget(projectId);
      if (action === 'advanceModeling') return personalizadosApi.advanceModeling(projectId);
      return personalizadosApi.approve(projectId);
    },
    onSuccess: async () => { await reload(); },
    onError: () => setFeedback('Acao nao concluida para o projeto personalizado.')
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async () => personalizadosApi.updateBudget(budgetDialog.projectId, {
      sizeMinCm: Number(budgetDialog.sizeMinCm),
      sizeMaxCm: Number(budgetDialog.sizeMaxCm),
      isPainted: budgetDialog.isPainted
    }),
    onSuccess: async () => {
      setBudgetDialog({ open: false, projectId: '', sizeMinCm: 10, sizeMaxCm: 15, isPainted: true });
      await reload();
    },
    onError: () => setFeedback('Nao foi possivel atualizar o orçamento.')
  });

  const rejectBudgetMutation = useMutation({
    mutationFn: async () => personalizadosApi.rejectBudget(rejectDialog.projectId, { reason: rejectDialog.reason || null }),
    onSuccess: async () => {
      setRejectDialog({ open: false, projectId: '', reason: '' });
      await reload();
    },
    onError: () => setFeedback('Nao foi possivel rejeitar o orçamento.')
  });

  const configurePrintProductMutation = useMutation({
    mutationFn: async () => personalizadosApi.configurePrintProduct(printProductDialog.projectId, {
      realSizeCm: Number(printProductDialog.realSizeCm),
      name: printProductDialog.name,
      sku: printProductDialog.sku || null,
      description: printProductDialog.description || null,
      supplierId: printProductDialog.supplierId || null,
      generateProductionExpenseOnStockEntry: false,
      itemsPerPlate: Number(printProductDialog.itemsPerPlate),
      estimatedPrintTimeMinutes: Number(printProductDialog.estimatedPrintTimeMinutes),
      heightCentimeters: Number(printProductDialog.heightCentimeters),
      lengthMetersUsed: Number(printProductDialog.lengthMetersUsed),
      tariffPerKwh: Number(printProductDialog.tariffPerKwh),
      finishingPercentage: Number(printProductDialog.finishingPercentage),
      commissionPercentage: Number(printProductDialog.commissionPercentage),
      printerProfileId: printProductDialog.printerProfileId || null,
      filaments: [],
      marketplaceFeeId: printProductDialog.marketplaceFeeId || null,
      additionalCost: Number(printProductDialog.additionalCost),
      desiredMarkup: Number(printProductDialog.desiredMarkup),
      costPrice: printProductDialog.costPrice === '' ? null : Number(printProductDialog.costPrice),
      salePrice: printProductDialog.salePrice === '' ? null : Number(printProductDialog.salePrice)
    }),
    onSuccess: async () => {
      setPrintProductDialog({
        open: false,
        projectId: '',
        realSizeCm: 10,
        name: '',
        sku: '',
        description: '',
        supplierId: '',
        itemsPerPlate: 1,
        estimatedPrintTimeMinutes: 0,
        heightCentimeters: 0,
        lengthMetersUsed: 0,
        tariffPerKwh: 1,
        finishingPercentage: 0,
        commissionPercentage: 0,
        printerProfileId: '',
        marketplaceFeeId: '',
        additionalCost: 0,
        desiredMarkup: 2,
        costPrice: '',
        salePrice: ''
      });
      await reload();
    },
    onError: () => setFeedback('Nao foi possivel configurar o produto da impressão.')
  });

  const completePrintingMutation = useMutation({
    mutationFn: async () => personalizadosApi.completePrinting(printFinishDialog.projectId, {
      timeRealMinutes: Number(printFinishDialog.timeRealMinutes),
      producedQuantity: Number(printFinishDialog.producedQuantity)
    }),
    onSuccess: async () => {
      setPrintFinishDialog({ open: false, projectId: '', timeRealMinutes: 0, producedQuantity: 1 });
      await reload();
    },
    onError: () => setFeedback('Nao foi possivel finalizar a etapa de impressão.')
  });

  const completeFinishingMutation = useMutation({
    mutationFn: async () => personalizadosApi.completeFinishing(finishingDialog.projectId, {
      timeRealMinutes: Number(finishingDialog.timeRealMinutes)
    }),
    onSuccess: async () => {
      setFinishingDialog({ open: false, projectId: '', timeRealMinutes: 0 });
      await reload();
    },
    onError: () => setFeedback('Nao foi possivel finalizar a etapa de acabamento.')
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => personalizadosApi.finalize(finalizeDialog.projectId, {
      paymentMethod: finalizeDialog.paymentMethod,
      soldAtUtc: null,
      quantity: Number(finalizeDialog.quantity),
      notes: finalizeDialog.notes || null
    }),
    onSuccess: async () => {
      setFinalizeDialog({ open: false, projectId: '', paymentMethod: 'Pix', quantity: 1, notes: '' });
      await reload();
    },
    onError: () => setFeedback('Nao foi possivel finalizar e vender o personalizado.')
  });

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h3">Personalizados</Typography>
        <Typography color="text.secondary">Tabela de valores por centímetro e fluxo completo: orçamento, modelagem, aprovação, impressão, acabamento e venda final.</Typography>
      </Stack>

      {feedback ? <Alert severity="info">{feedback}</Alert> : null}

      <PageSection title="Tabela por tamanho" subtitle="Valores por centímetro da peça finalizada e da peça sem pintura.">
        <Stack spacing={2}>
          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ordem</TableCell>
                  <TableCell>De (cm)</TableCell>
                  <TableCell>Até (cm)</TableCell>
                  <TableCell>Valor por cm (finalizada)</TableCell>
                  <TableCell>Valor por cm (sem pintura)</TableCell>
                  <TableCell>Ativa</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {effectivePricing.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell>{item.order}</TableCell>
                    <TableCell><TextField size="small" type="number" value={item.minSizeCm} disabled={!isAdmin} onChange={(event) => {
                      const next = [...effectivePricing];
                      next[index] = { ...item, minSizeCm: Number(event.target.value) };
                      setPricingDraft(next as PersonalizedPricingTier[]);
                    }} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={item.maxSizeCm ?? ''} disabled={!isAdmin} onChange={(event) => {
                      const next = [...effectivePricing];
                      next[index] = { ...item, maxSizeCm: event.target.value === '' ? undefined : Number(event.target.value) };
                      setPricingDraft(next as PersonalizedPricingTier[]);
                    }} placeholder="Sem limite" /></TableCell>
                    <TableCell><TextField size="small" type="number" value={item.finishedPriceBRL} disabled={!isAdmin} onChange={(event) => {
                      const next = [...effectivePricing];
                      next[index] = { ...item, finishedPriceBRL: Number(event.target.value) };
                      setPricingDraft(next as PersonalizedPricingTier[]);
                    }} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={item.unpaintedPriceBRL} disabled={!isAdmin} onChange={(event) => {
                      const next = [...effectivePricing];
                      next[index] = { ...item, unpaintedPriceBRL: Number(event.target.value) };
                      setPricingDraft(next as PersonalizedPricingTier[]);
                    }} /></TableCell>
                    <TableCell><Switch checked={item.isActive} disabled={!isAdmin} onChange={(event) => {
                      const next = [...effectivePricing];
                      next[index] = { ...item, isActive: event.target.checked };
                      setPricingDraft(next as PersonalizedPricingTier[]);
                    }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={() => savePricingMutation.mutate()} disabled={!isAdmin || savePricingMutation.isLoading}>
              {savePricingMutation.isLoading ? 'Salvando...' : 'Salvar tabela'}
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      <PageSection title="Novo pedido personalizado" subtitle="Cria um pedido de personalizado com faixa de tamanho inicial e orçamento automático.">
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: '2fr 1fr 1fr 1.2fr 1fr' }, alignItems: 'center' }}>
            <TextField fullWidth label="Nome" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} />
            <TextField fullWidth label="De (cm)" type="number" value={createForm.sizeMinCm} onChange={(event) => setCreateForm((current) => ({ ...current, sizeMinCm: Number(event.target.value) }))} />
            <TextField fullWidth label="Até (cm)" type="number" value={createForm.sizeMaxCm} onChange={(event) => setCreateForm((current) => ({ ...current, sizeMaxCm: Number(event.target.value) }))} />
            <TextField fullWidth select label="Pintura" value={createForm.isPainted ? 'yes' : 'no'} onChange={(event) => setCreateForm((current) => ({ ...current, isPainted: event.target.value === 'yes' }))}><MenuItem value="yes">Com pintura</MenuItem><MenuItem value="no">Sem pintura</MenuItem></TextField>
            <Button fullWidth variant="contained" onClick={() => createMutation.mutate()} disabled={createMutation.isLoading || !createForm.name.trim()}>Criar</Button>
          </Box>
          <TextField fullWidth label="Descrição" value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} />
        </Stack>
      </PageSection>

      <PageSection title="Esteira de pedidos" subtitle="Do pedido à venda: orçamento, modelagem, aprovação, impressão, acabamento e venda final.">
        {projects.length === 0 ? (
          <Typography color="text.secondary">Nenhum pedido personalizado criado.</Typography>
        ) : (
          <>
            <Box sx={{ overflowX: { md: 'auto' } }}>
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(7, minmax(230px, 1fr))' } }}>
                {PERSONALIZADOS_STAGES.map((stage) => {
                  const stageItems = projects.filter((item) => getPersonalizadoStage(item) === stage.key);
                  return (
                    <Box key={stage.key} sx={{ backgroundColor: 'rgba(255,244,240,0.7)', borderRadius: 3, p: 1.25 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0.5, pb: 1 }}>
                        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800 }}>{stage.label}</Typography>
                        <Chip size="small" label={stageItems.length} sx={{ backgroundColor: 'rgba(217,107,135,0.14)', color: 'primary.main', fontWeight: 800 }} />
                      </Stack>
                      <Stack spacing={1}>
                        {stageItems.map((item) => (
                          <Paper key={item.project.id} variant="outlined" sx={{ p: 1.5, borderColor: 'rgba(217,107,135,0.16)' }}>
                            <Typography fontWeight={700} fontSize={13.5}>{item.project.name}</Typography>
                            <Typography color="text.secondary" fontSize={11.5}>
                              {item.project.personalizedSizeCm
                                ? `${item.project.personalizedSizeCm.toFixed(1)} cm`
                                : `${(item.project.personalizedSizeMinCm ?? 0).toFixed(1)}–${(item.project.personalizedSizeMaxCm ?? 0).toFixed(1)} cm`}
                              {' · '}
                              {item.project.personalizedIsPainted ? 'com pintura' : 'sem pintura'}
                            </Typography>
                            <Typography sx={{ fontFamily: '"Baloo 2", "Nunito", sans-serif', fontWeight: 700, fontSize: 13, color: 'primary.main', mt: 0.25 }}>
                              {formatCurrency(item.project.personalizedQuotedPriceBRL ?? 0)}
                            </Typography>
                            {item.product ? <Typography color="text.secondary" fontSize={11}>{item.product.name}</Typography> : null}
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                              <Button size="small" variant="outlined" onClick={() => setBudgetDialog({
                                open: true,
                                projectId: item.project.id,
                                sizeMinCm: item.project.personalizedSizeMinCm ?? 10,
                                sizeMaxCm: item.project.personalizedSizeMaxCm ?? 15,
                                isPainted: item.project.personalizedIsPainted ?? true
                              })}>Orçamento</Button>
                              {!stepDone(item, 'Orçamento') ? <Button size="small" variant="contained" onClick={() => simpleActionMutation.mutate({ action: 'advanceBudget', projectId: item.project.id })}>Avançar orçamento</Button> : null}
                              {!stepDone(item, 'Orçamento') ? <Button size="small" color="error" onClick={() => setRejectDialog({ open: true, projectId: item.project.id, reason: '' })}>Rejeitar</Button> : null}
                              {stepDone(item, 'Orçamento') && !stepDone(item, 'Elaboração modelo 3D') ? <Button size="small" variant="contained" onClick={() => simpleActionMutation.mutate({ action: 'advanceModeling', projectId: item.project.id })}>Avançar modelagem</Button> : null}
                              {stepDone(item, 'Elaboração modelo 3D') && !stepDone(item, 'Aprovação do projeto') ? <Button size="small" variant="contained" onClick={() => simpleActionMutation.mutate({ action: 'approve', projectId: item.project.id })}>Aprovar</Button> : null}
                              {stepDone(item, 'Aprovação do projeto') && !stepDone(item, 'Impressão') ? <Button size="small" variant={item.product ? 'outlined' : 'contained'} onClick={() => setPrintProductDialog((current) => ({ ...current, open: true, projectId: item.project.id, realSizeCm: item.project.personalizedSizeCm ?? item.project.personalizedSizeMaxCm ?? 10, name: item.product?.name ?? item.project.name, salePrice: String(item.project.personalizedQuotedPriceBRL ?? 0), marketplaceFeeId: current.marketplaceFeeId || noneMarketplaceId }))}>Produto impressão</Button> : null}
                              {item.product && !stepDone(item, 'Impressão') ? <Button size="small" variant="contained" onClick={() => setPrintFinishDialog({ open: true, projectId: item.project.id, timeRealMinutes: 0, producedQuantity: 1 })}>Finalizar impressão</Button> : null}
                              {stepDone(item, 'Impressão') && !stepDone(item, 'Acabamento') ? <Button size="small" variant="contained" onClick={() => setFinishingDialog({ open: true, projectId: item.project.id, timeRealMinutes: 0 })}>Finalizar acabamento</Button> : null}
                              {stepDone(item, 'Acabamento') && !item.saleId ? <Button size="small" variant="contained" color="success" onClick={() => setFinalizeDialog({ open: true, projectId: item.project.id, paymentMethod: 'Pix', quantity: 1, notes: '' })}>Finalizar e vender</Button> : null}
                            </Stack>
                          </Paper>
                        ))}
                        {stageItems.length === 0 ? <Typography color="text.secondary" fontSize={11.5} sx={{ px: 0.5, py: 0.5 }}>—</Typography> : null}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </Box>
            {projects.some((item) => getPersonalizadoStage(item) === 'cancelado') ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800 }}>Cancelados</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {projects.filter((item) => getPersonalizadoStage(item) === 'cancelado').map((item) => (
                    <Chip key={item.project.id} label={`${item.project.name} · ${formatCurrency(item.project.personalizedQuotedPriceBRL ?? 0)}`} variant="outlined" />
                  ))}
                </Stack>
              </Box>
            ) : null}
          </>
        )}
      </PageSection>

      <Dialog open={budgetDialog.open} onClose={() => setBudgetDialog({ open: false, projectId: '', sizeMinCm: 10, sizeMaxCm: 15, isPainted: true })}>
        <DialogTitle>Atualizar orçamento</DialogTitle>
        <DialogContent sx={{ minWidth: 360, pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField type="number" label="Tamanho mínimo (cm)" value={budgetDialog.sizeMinCm} onChange={(event) => setBudgetDialog((current) => ({ ...current, sizeMinCm: Number(event.target.value) }))} />
            <TextField type="number" label="Tamanho máximo (cm)" value={budgetDialog.sizeMaxCm} onChange={(event) => setBudgetDialog((current) => ({ ...current, sizeMaxCm: Number(event.target.value) }))} />
            <TextField select label="Pintura" value={budgetDialog.isPainted ? 'yes' : 'no'} onChange={(event) => setBudgetDialog((current) => ({ ...current, isPainted: event.target.value === 'yes' }))}>
              <MenuItem value="yes">Com pintura</MenuItem>
              <MenuItem value="no">Sem pintura</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBudgetDialog({ open: false, projectId: '', sizeMinCm: 10, sizeMaxCm: 15, isPainted: true })}>Cancelar</Button>
          <Button variant="contained" onClick={() => updateBudgetMutation.mutate()} disabled={updateBudgetMutation.isLoading}>Salvar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, projectId: '', reason: '' })}>
        <DialogTitle>Rejeitar orçamento</DialogTitle>
        <DialogContent sx={{ minWidth: 360, pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography color="text.secondary">Este pedido será cancelado e não seguirá para modelagem.</Typography>
            <TextField
              label="Motivo (opcional)"
              value={rejectDialog.reason}
              onChange={(event) => setRejectDialog((current) => ({ ...current, reason: event.target.value }))}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, projectId: '', reason: '' })}>Voltar</Button>
          <Button color="error" variant="contained" onClick={() => rejectBudgetMutation.mutate()} disabled={rejectBudgetMutation.isLoading}>Rejeitar orçamento</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={printProductDialog.open} onClose={() => setPrintProductDialog((current) => ({ ...current, open: false }))} maxWidth="md" fullWidth>
        <DialogTitle>Configurar produto da impressão</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, mt: 1 }}>
            <TextField fullWidth label="Tamanho real (cm)" type="number" value={printProductDialog.realSizeCm} onChange={(event) => setPrintProductDialog((current) => ({ ...current, realSizeCm: Number(event.target.value) }))} />
            <TextField sx={{ gridColumn: { sm: '1 / -1', md: 'span 2' } }} fullWidth label="Nome" value={printProductDialog.name} onChange={(event) => setPrintProductDialog((current) => ({ ...current, name: event.target.value }))} />
            <TextField fullWidth label="SKU" value={printProductDialog.sku} onChange={(event) => setPrintProductDialog((current) => ({ ...current, sku: event.target.value }))} />
            <TextField fullWidth select label="Fornecedor" value={printProductDialog.supplierId} onChange={(event) => setPrintProductDialog((current) => ({ ...current, supplierId: event.target.value }))}><MenuItem value="">Lojinha</MenuItem>{(metadata?.suppliers ?? []).map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>)}</TextField>
            <TextField sx={{ gridColumn: '1 / -1' }} fullWidth label="Descrição" value={printProductDialog.description} onChange={(event) => setPrintProductDialog((current) => ({ ...current, description: event.target.value }))} />
            <TextField fullWidth type="number" label="Preço de custo" value={printProductDialog.costPrice} onChange={(event) => setPrintProductDialog((current) => ({ ...current, costPrice: event.target.value }))} />
            <TextField fullWidth type="number" label="Preço de venda" value={printProductDialog.salePrice} onChange={(event) => setPrintProductDialog((current) => ({ ...current, salePrice: event.target.value }))} />
            <TextField fullWidth type="number" label="Markup desejado" value={printProductDialog.desiredMarkup} onChange={(event) => setPrintProductDialog((current) => ({ ...current, desiredMarkup: Number(event.target.value) }))} />
            <TextField fullWidth type="number" label="Tempo estimado (min)" value={printProductDialog.estimatedPrintTimeMinutes} onChange={(event) => setPrintProductDialog((current) => ({ ...current, estimatedPrintTimeMinutes: Number(event.target.value) }))} />
            <TextField fullWidth type="number" label="Altura (cm)" value={printProductDialog.heightCentimeters} onChange={(event) => setPrintProductDialog((current) => ({ ...current, heightCentimeters: Number(event.target.value) }))} />
            <TextField fullWidth type="number" label="Metros usados" value={printProductDialog.lengthMetersUsed} onChange={(event) => setPrintProductDialog((current) => ({ ...current, lengthMetersUsed: Number(event.target.value) }))} />
            <TextField fullWidth type="number" label="Tarifa kWh" value={printProductDialog.tariffPerKwh} onChange={(event) => setPrintProductDialog((current) => ({ ...current, tariffPerKwh: Number(event.target.value) }))} />
            <TextField fullWidth type="number" label="Acabamento (%)" value={printProductDialog.finishingPercentage} onChange={(event) => setPrintProductDialog((current) => ({ ...current, finishingPercentage: Number(event.target.value) }))} />
            <TextField fullWidth type="number" label="Comissão (%)" value={printProductDialog.commissionPercentage} onChange={(event) => setPrintProductDialog((current) => ({ ...current, commissionPercentage: Number(event.target.value) }))} />
            <TextField fullWidth type="number" label="Itens por placa" value={printProductDialog.itemsPerPlate} onChange={(event) => setPrintProductDialog((current) => ({ ...current, itemsPerPlate: Number(event.target.value) }))} />
            <TextField fullWidth type="number" label="Custo adicional" value={printProductDialog.additionalCost} onChange={(event) => setPrintProductDialog((current) => ({ ...current, additionalCost: Number(event.target.value) }))} />
            <TextField sx={{ gridColumn: { sm: '1 / -1', md: 'auto' } }} fullWidth select label="Impressora" value={printProductDialog.printerProfileId} onChange={(event) => setPrintProductDialog((current) => ({ ...current, printerProfileId: event.target.value }))}><MenuItem value="">Sem impressora</MenuItem>{(metadata?.printers ?? []).map((printer) => <MenuItem key={printer.id} value={printer.id}>{printer.name}</MenuItem>)}</TextField>
            <TextField sx={{ gridColumn: { sm: '1 / -1', md: 'span 2' } }} fullWidth select label="Marketplace" value={printProductDialog.marketplaceFeeId} onChange={(event) => setPrintProductDialog((current) => ({ ...current, marketplaceFeeId: event.target.value }))}>{printProductDialog.marketplaceFeeId === '' ? <MenuItem value="">— Sem marketplace —</MenuItem> : null}{(metadata?.marketplaces ?? []).map((marketplace) => <MenuItem key={marketplace.id} value={marketplace.id}>{marketplace.name}</MenuItem>)}</TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintProductDialog((current) => ({ ...current, open: false }))}>Cancelar</Button>
          <Button variant="contained" onClick={() => configurePrintProductMutation.mutate()} disabled={configurePrintProductMutation.isLoading || !printProductDialog.name.trim()}>Salvar produto</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={printFinishDialog.open} onClose={() => setPrintFinishDialog({ open: false, projectId: '', timeRealMinutes: 0, producedQuantity: 1 })}>
        <DialogTitle>Finalizar impressão</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Tempo real (min)" type="number" value={printFinishDialog.timeRealMinutes} onChange={(event) => setPrintFinishDialog((current) => ({ ...current, timeRealMinutes: Number(event.target.value) }))} />
            <TextField label="Quantidade produzida" type="number" value={printFinishDialog.producedQuantity} onChange={(event) => setPrintFinishDialog((current) => ({ ...current, producedQuantity: Number(event.target.value) }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintFinishDialog({ open: false, projectId: '', timeRealMinutes: 0, producedQuantity: 1 })}>Cancelar</Button>
          <Button variant="contained" onClick={() => completePrintingMutation.mutate()} disabled={completePrintingMutation.isLoading}>Finalizar impressão</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={finishingDialog.open} onClose={() => setFinishingDialog({ open: false, projectId: '', timeRealMinutes: 0 })}>
        <DialogTitle>Finalizar acabamento</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField sx={{ mt: 1 }} fullWidth label="Tempo real (min)" type="number" value={finishingDialog.timeRealMinutes} onChange={(event) => setFinishingDialog((current) => ({ ...current, timeRealMinutes: Number(event.target.value) }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinishingDialog({ open: false, projectId: '', timeRealMinutes: 0 })}>Cancelar</Button>
          <Button variant="contained" onClick={() => completeFinishingMutation.mutate()} disabled={completeFinishingMutation.isLoading}>Finalizar acabamento</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={finalizeDialog.open} onClose={() => setFinalizeDialog({ open: false, projectId: '', paymentMethod: 'Pix', quantity: 1, notes: '' })}>
        <DialogTitle>Finalizar pedido e gerar venda</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Forma de pagamento" value={finalizeDialog.paymentMethod} onChange={(event) => setFinalizeDialog((current) => ({ ...current, paymentMethod: event.target.value }))}>
              {['Pix', 'CreditCard', 'DebitCard', 'Cash', 'Transfer'].map((method) => <MenuItem key={method} value={method}>{paymentMethodLabel(method)}</MenuItem>)}
            </TextField>
            <TextField label="Quantidade para venda" type="number" value={finalizeDialog.quantity} onChange={(event) => setFinalizeDialog((current) => ({ ...current, quantity: Number(event.target.value) }))} />
            <TextField label="Observações" value={finalizeDialog.notes} onChange={(event) => setFinalizeDialog((current) => ({ ...current, notes: event.target.value }))} multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinalizeDialog({ open: false, projectId: '', paymentMethod: 'Pix', quantity: 1, notes: '' })}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isLoading}>Finalizar e vender</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
