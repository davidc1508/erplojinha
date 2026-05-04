import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Box,
  IconButton,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SearchSelectField } from '../components/SearchSelectField';
import { productsApi, projectsApi } from '../services/api';
import { durationPartsToMinutes, minutesToDurationParts } from '../services/product';
import { Project, ProjectStep, ProjectStepStatus } from '../services/types';

const stepStatusColors: Record<ProjectStepStatus, 'default' | 'info' | 'success' | 'error'> = {
  Pendente: 'default',
  EmAndamento: 'info',
  Concluida: 'success',
  Cancelada: 'error'
};

const stepStatusLabels: Record<ProjectStepStatus, string> = {
  Pendente: 'Pendente',
  EmAndamento: 'Em andamento',
  Concluida: 'Concluída',
  Cancelada: 'Cancelada'
};

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStep, setSelectedStep] = useState<ProjectStep | null>(null);
  const [openAddStepDialog, setOpenAddStepDialog] = useState(false);
  const [openEditStepDialog, setOpenEditStepDialog] = useState(false);
  const [openFailStepDialog, setOpenFailStepDialog] = useState(false);

  const [stepForm, setStepForm] = useState({
    name: '',
    order: '1',
    timeEstimatedMinutes: 0,
    printerPlanned: '',
    filaments: [] as { filamentProfileId: string; weightGrams: number }[]
  });
  const [stepDuration, setStepDuration] = useState(() => minutesToDurationParts(0));
  const [failStepForm, setFailStepForm] = useState({ timeLostMinutes: 0, weightLostGrams: '', failureReason: '' });
  const [failDuration, setFailDuration] = useState(() => minutesToDurationParts(0));

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id
  });
  const { data: metadata } = useQuery({ queryKey: ['products-metadata-project-detail'], queryFn: productsApi.getMetadata });
  const { data: projectProduct } = useQuery({
    queryKey: ['project-product-detail', project?.productId],
    queryFn: () => productsApi.getById(project!.productId!),
    enabled: !!project?.productId
  });

  const selectedProduct = projectProduct ?? null;
  const productName = selectedProduct?.name ?? '-';
  const printerOptions = (metadata?.printers ?? []).map((item) => ({ id: item.id, name: item.name }));
  const filamentOptions = (metadata?.filaments ?? []).map((item) => ({ id: item.id, name: item.name }));

  const addStepMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => projectsApi.addStep(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setOpenAddStepDialog(false);
      resetStepForm();
    }
  });
  const updateStepMutation = useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: Record<string, unknown> }) => projectsApi.updateStep(id!, stepId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setOpenEditStepDialog(false);
      setSelectedStep(null);
      resetStepForm();
    }
  });
  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => projectsApi.deleteStep(id!, stepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    }
  });
  const completeStepMutation = useMutation({
    mutationFn: ({ stepId, timeRealMinutes }: { stepId: string; timeRealMinutes: number }) =>
      projectsApi.completeStep(id!, stepId, { timeRealMinutes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    }
  });
  const failStepMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => projectsApi.failStep(id!, selectedStep?.id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setOpenFailStepDialog(false);
      setFailStepForm({ timeLostMinutes: 0, weightLostGrams: '', failureReason: '' });
      setFailDuration(minutesToDurationParts(0));
    }
  });
  const concludeProjectMutation = useMutation({
    mutationFn: () => projectsApi.conclude(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    }
  });

  function resetStepForm() {
    setStepForm({
      name: '',
      order: '1',
      timeEstimatedMinutes: 0,
      printerPlanned: '',
      filaments: []
    });
    setStepDuration(minutesToDurationParts(0));
  }

  function resolveOptionName(options: { id: string; name: string }[], value: string) {
    return options.find((item) => item.id === value)?.name ?? value;
  }

  function updateDurationPart(
    current: { hours: number; minutes: number; seconds: number },
    setter: (value: { hours: number; minutes: number; seconds: number }) => void,
    field: 'hours' | 'minutes' | 'seconds',
    onMinutesChange: (value: number) => void,
    nextValue: number
  ) {
    const nextDuration = { ...current, [field]: Math.max(0, Math.floor(nextValue)) };
    setter(nextDuration);
    onMinutesChange(durationPartsToMinutes(nextDuration.hours, nextDuration.minutes, nextDuration.seconds));
  }

  function addStepFilament() {
    setStepForm((current) => ({ ...current, filaments: [...current.filaments, { filamentProfileId: '', weightGrams: 0 }] }));
  }

  function updateStepFilament(index: number, field: 'filamentProfileId' | 'weightGrams', value: string | number) {
    setStepForm((current) => ({
      ...current,
      filaments: current.filaments.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    }));
  }

  function removeStepFilament(index: number) {
    setStepForm((current) => ({ ...current, filaments: current.filaments.filter((_, i) => i !== index) }));
  }

  function buildStepPayload() {
    return {
      name: stepForm.name.trim(),
      order: Number(stepForm.order),
      timeEstimatedMinutes: stepForm.timeEstimatedMinutes,
      printerPlanned: stepForm.printerPlanned ? resolveOptionName(printerOptions, stepForm.printerPlanned) : null,
      filaments: stepForm.filaments
        .filter((f) => f.filamentProfileId)
        .map((f) => ({ filamentProfileId: f.filamentProfileId, weightGrams: Number(f.weightGrams) || 0 }))
    };
  }

  function startEditStep(step: ProjectStep) {
    setSelectedStep(step);
    setStepForm({
      name: step.name,
      order: String(step.order),
      timeEstimatedMinutes: step.timeEstimatedMinutes,
      printerPlanned: printerOptions.find((item) => item.name === step.printerPlanned)?.id ?? '',
      filaments: (step.filaments ?? []).map((f) => ({
        filamentProfileId: f.filamentProfileId,
        weightGrams: f.weightGrams
      }))
    });
    setStepDuration(minutesToDurationParts(step.timeEstimatedMinutes));
    setOpenEditStepDialog(true);
  }

  if (isLoading) {
    return <Typography color="text.secondary">Carregando projeto...</Typography>;
  }

  if (!project) {
    return <Alert severity="error">Projeto não encontrado.</Alert>;
  }

  const sortedByCreatedSteps = [...project.steps].sort((left, right) => {
    const leftTime = new Date(left.createdAtUtc).getTime();
    const rightTime = new Date(right.createdAtUtc).getTime();
    return leftTime - rightTime || left.order - right.order;
  });
  const concludedCount = project.steps.filter((step) => step.status === 'Concluida').length;
  const totalSteps = project.steps.length;
  const pendingSteps = sortedByCreatedSteps.filter((step) => step.status !== 'Concluida');
  const concludedSteps = sortedByCreatedSteps.filter((step) => step.status === 'Concluida');
  const weightBase = selectedProduct
    ? (selectedProduct.estimatedWeightGrams > 0
      ? selectedProduct.estimatedWeightGrams
      : Math.max(1, project.weightEstimatedGrams))
    : 0;
  const estimatedUnits = selectedProduct ? project.weightEstimatedGrams / weightBase : 0;
  const completedUnits = selectedProduct ? project.weightCompletedGrams / weightBase : 0;
  const estimatedCost = selectedProduct ? estimatedUnits * selectedProduct.costPrice : 0;
  const estimatedRevenue = selectedProduct ? estimatedUnits * selectedProduct.salePrice : 0;
  const completedCost = selectedProduct ? completedUnits * selectedProduct.costPrice : 0;
  const completedRevenue = selectedProduct ? completedUnits * selectedProduct.salePrice : 0;
  const estimatedMargin = selectedProduct && estimatedRevenue > 0
    ? (estimatedRevenue - estimatedCost) / estimatedRevenue
    : null;
  const remainingTimeMinutes = Math.max(0, project.timeEstimatedMinutes - project.timeCompletedMinutes);
  const remainingWeightGrams = Math.max(0, project.weightEstimatedGrams - project.weightCompletedGrams);

  function formatMinutes(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  }

  function formatMoney(amount: number) {
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function renderStepCard(step: ProjectStep) {
    const isConcluded = step.status === 'Concluida';
    const failedAttempts = step.attempts.filter((attempt) => attempt.status === 'Falhada');
    const completedAttempt = step.attempts.find((attempt) => attempt.status === 'Concluida');

    return (
      <Paper
        key={step.id}
        variant="outlined"
        sx={{
          p: 2,
          borderColor: isConcluded ? 'success.300' : 'divider',
          bgcolor: isConcluded ? 'success.50' : 'background.paper'
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {isConcluded && <CheckCircleOutlineRoundedIcon color="success" fontSize="small" />}
              <Typography variant="subtitle1" fontWeight={600}>
                Mesa {step.order}: {step.name}
              </Typography>
              <Chip label={stepStatusLabels[step.status]} color={stepStatusColors[step.status]} size="small" />
              <Chip label={`Criada em ${new Date(step.createdAtUtc).toLocaleDateString('pt-BR')}`} size="small" variant="outlined" />
              {failedAttempts.length > 0 && (
                <Chip
                  icon={<ReportProblemRoundedIcon />}
                  label={`${failedAttempts.length} falha${failedAttempts.length > 1 ? 's' : ''}`}
                  color="error"
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
            <Stack direction="row" spacing={0.5} flexShrink={0}>
              <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => startEditStep(step)}>Editar</Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineRoundedIcon />}
                onClick={() => {
                  if (window.confirm('Excluir esta mesa e todo o histórico de tentativas?')) {
                    deleteStepMutation.mutate(step.id);
                  }
                }}
              >
                Excluir
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={`⏱ ${formatMinutes(step.timeEstimatedMinutes)}`} size="small" variant="outlined" />
            <Chip label={`⚖ ${step.weightEstimatedGrams.toFixed(0)} g`} size="small" variant="outlined" />
            {step.printerPlanned && <Chip label={step.printerPlanned} size="small" variant="outlined" />}
            {(step.filaments ?? []).map((filament) => (
              <Chip key={filament.filamentProfileId} label={`${filament.filamentName} ${filament.weightGrams}g`} size="small" variant="outlined" />
            ))}
          </Stack>

          {!isConcluded && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                size="small"
                startIcon={<TaskAltRoundedIcon />}
                onClick={() => completeStepMutation.mutate({ stepId: step.id, timeRealMinutes: step.timeEstimatedMinutes })}
                disabled={completeStepMutation.isLoading}
              >
                Concluir mesa
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<ReportProblemRoundedIcon />}
                onClick={() => {
                  setSelectedStep(step);
                  setFailStepForm({ timeLostMinutes: 0, weightLostGrams: '', failureReason: '' });
                  setFailDuration(minutesToDurationParts(0));
                  setOpenFailStepDialog(true);
                }}
              >
                Registrar falha
              </Button>
            </Stack>
          )}

          {isConcluded && completedAttempt && (
            <Typography variant="caption" color="success.700">
              ✓ Concluída em {formatMinutes(completedAttempt.timeRealMinutes)} • {completedAttempt.weightRealGrams.toFixed(0)} g
            </Typography>
          )}

          {failedAttempts.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>HISTÓRICO DE FALHAS</Typography>
              <TableContainer sx={{ mt: 0.5 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'error.50' }}>
                      <TableCell sx={{ py: 0.5 }}>#</TableCell>
                      <TableCell sx={{ py: 0.5 }}>Tempo perdido</TableCell>
                      <TableCell sx={{ py: 0.5 }}>Peso perdido</TableCell>
                      <TableCell sx={{ py: 0.5 }}>Motivo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {failedAttempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell sx={{ py: 0.5 }}>{attempt.attemptNumber}</TableCell>
                        <TableCell sx={{ py: 0.5 }}>{attempt.timeLostMinutes ? formatMinutes(attempt.timeLostMinutes) : '-'}</TableCell>
                        <TableCell sx={{ py: 0.5 }}>{attempt.weightLostGrams ? `${attempt.weightLostGrams.toFixed(0)} g` : '-'}</TableCell>
                        <TableCell sx={{ py: 0.5 }}>{attempt.failureReason || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Cabeçalho */}
      <Stack direction="row" alignItems="center" spacing={2}>
        <IconButton onClick={() => navigate('/projetos')} size="small"><ArrowBackIcon /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={700}>{project.name}</Typography>
          <Typography variant="body2" color="text.secondary">Produto: {productName}</Typography>
        </Box>
        <Chip
          label={project.status}
          color={project.status === 'Concluido' ? 'success' : project.status === 'EmAndamento' ? 'info' : 'default'}
          size="medium"
        />
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">PROGRESSO GERAL</Typography>
                <Typography variant="h5" fontWeight={700}>{project.progressPercentage.toFixed(0)}%</Typography>
                <Typography variant="body2" color="text.secondary">{concludedCount} de {totalSteps} mesas concluídas</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { resetStepForm(); setSelectedStep(null); setOpenAddStepDialog(true); }}>
                  Nova mesa
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TaskAltRoundedIcon />}
                  onClick={() => concludeProjectMutation.mutate()}
                  disabled={concludeProjectMutation.isLoading || totalSteps === 0 || project.steps.some((step) => step.status !== 'Concluida')}
                >
                  Concluir projeto
                </Button>
              </Stack>
            </Stack>

            <LinearProgress variant="determinate" value={project.progressPercentage} sx={{ height: 10, borderRadius: 999 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Tempo concluído</Typography>
                  <Typography variant="body1" fontWeight={600}>{formatMinutes(project.timeCompletedMinutes)} / {formatMinutes(project.timeEstimatedMinutes)}</Typography>
                  <Typography variant="caption" color="text.secondary">Restante: {formatMinutes(remainingTimeMinutes)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Peso produzido</Typography>
                  <Typography variant="body1" fontWeight={600}>{project.weightCompletedGrams.toFixed(0)} g / {project.weightEstimatedGrams.toFixed(0)} g</Typography>
                  <Typography variant="caption" color="text.secondary">Restante: {remainingWeightGrams.toFixed(0)} g</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Mesas</Typography>
                  <Typography variant="body1" fontWeight={600}>{pendingSteps.length} pendentes • {concludedSteps.length} concluídas</Typography>
                  <Typography variant="caption" color="text.secondary">Ordenação por cadastro (mais antigas primeiro)</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper variant="outlined" sx={{ p: 1.5, borderColor: (project.timeLostToFailuresMinutes > 0 || project.weightLostToFailuresGrams > 0) ? 'error.light' : 'divider', bgcolor: (project.timeLostToFailuresMinutes > 0 || project.weightLostToFailuresGrams > 0) ? 'error.50' : 'background.paper' }}>
                  <Typography variant="caption" color="text.secondary">Perdas por falha</Typography>
                  <Typography variant="body1" fontWeight={600}>{formatMinutes(project.timeLostToFailuresMinutes)} • {project.weightLostToFailuresGrams.toFixed(0)} g</Typography>
                  <Typography variant="caption" color="text.secondary">Acumulado no projeto</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>Estimativa financeira do projeto</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                Baseado nos filamentos e impressoras planejados nas mesas (tarifa padrão R$ 1,00/kWh). {!selectedProduct && 'Vincule um produto para estimar receita e margem.'}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">Custo de material estimado</Typography>
                  <Typography variant="body1" fontWeight={600}>{formatMoney(project.estimatedMaterialCostBRL)}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">Custo total estimado</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">(material + energia + manutenção + falhas)</Typography>
                  <Typography variant="body1" fontWeight={600}>{formatMoney(project.estimatedTotalCostBRL)}</Typography>
                </Grid>
                {selectedProduct && (
                  <>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Margem estimada (via produto)</Typography>
                      <Typography variant="body1" fontWeight={600}>{estimatedMargin === null ? '-' : `${(estimatedMargin * 100).toFixed(1)}%`}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Receita potencial (via produto)</Typography>
                      <Typography variant="body2">{formatMoney(estimatedRevenue)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Preço unitário (produto)</Typography>
                      <Typography variant="body2">{formatMoney(selectedProduct.salePrice)} por unidade estimada</Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </Paper>

            {project.description && (
              <>
                <Divider />
                <Box>
                  <Typography variant="caption" color="text.secondary">Observação</Typography>
                  <Typography variant="body2">{project.description}</Typography>
                </Box>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Mesas pendentes</Typography>
                <Chip color="warning" label={pendingSteps.length} size="small" />
              </Stack>
              {pendingSteps.length === 0 ? (
                <Typography color="text.secondary">Nenhuma mesa pendente.</Typography>
              ) : (
                <Stack spacing={2}>
                  {pendingSteps.map(renderStepCard)}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Mesas concluídas</Typography>
                <Chip color="success" label={concludedSteps.length} size="small" />
              </Stack>
              {concludedSteps.length === 0 ? (
                <Typography color="text.secondary">Nenhuma mesa concluída ainda.</Typography>
              ) : (
                <Stack spacing={2}>
                  {concludedSteps.map(renderStepCard)}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={openAddStepDialog} onClose={() => setOpenAddStepDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nova mesa</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nome da mesa" value={stepForm.name} onChange={(event) => setStepForm((current) => ({ ...current, name: event.target.value }))} fullWidth />
            <TextField label="Ordem" type="number" value={stepForm.order} onChange={(event) => setStepForm((current) => ({ ...current, order: event.target.value }))} fullWidth />
            <Grid container spacing={2}>
              <Grid item xs={4}><TextField label="Duração (h)" type="number" value={stepDuration.hours} onChange={(event) => updateDurationPart(stepDuration, setStepDuration, 'hours', (value) => setStepForm((current) => ({ ...current, timeEstimatedMinutes: value })), Number(event.target.value))} fullWidth /></Grid>
              <Grid item xs={4}><TextField label="Min" type="number" value={stepDuration.minutes} onChange={(event) => updateDurationPart(stepDuration, setStepDuration, 'minutes', (value) => setStepForm((current) => ({ ...current, timeEstimatedMinutes: value })), Number(event.target.value))} fullWidth /></Grid>
              <Grid item xs={4}><TextField label="Seg" type="number" value={stepDuration.seconds} onChange={(event) => updateDurationPart(stepDuration, setStepDuration, 'seconds', (value) => setStepForm((current) => ({ ...current, timeEstimatedMinutes: value })), Number(event.target.value))} fullWidth /></Grid>
            </Grid>
            <SearchSelectField label="Impressora planejada" value={stepForm.printerPlanned} options={printerOptions} onChange={(value) => setStepForm((current) => ({ ...current, printerPlanned: value }))} helperText="Usa a mesma base de impressoras do produto." placeholder="Digite o nome da impressora" minQueryLength={0} />
            <Stack spacing={1}>
              <Typography variant="body2" fontWeight={600}>Filamentos planejados</Typography>
              {stepForm.filaments.map((item, index) => (
                <Paper key={`step-filament-add-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ flex: 1 }}>
                      <SearchSelectField label="Filamento" value={item.filamentProfileId} options={filamentOptions} onChange={(value) => updateStepFilament(index, 'filamentProfileId', value)} placeholder="Digite o nome do filamento" minQueryLength={0} />
                    </Box>
                    <TextField label="Peso (g)" type="number" value={item.weightGrams} onChange={(event) => updateStepFilament(index, 'weightGrams', Number(event.target.value))} sx={{ width: 120 }} />
                    <IconButton color="error" onClick={() => removeStepFilament(index)} sx={{ mt: 0.5 }}><RemoveCircleOutlineRoundedIcon /></IconButton>
                  </Stack>
                </Paper>
              ))}
              <Button size="small" startIcon={<AddRoundedIcon />} onClick={addStepFilament} sx={{ alignSelf: 'flex-start' }}>Adicionar filamento</Button>
              <Typography variant="caption" color="text.secondary">Peso total: {stepForm.filaments.reduce((sum, f) => sum + (Number(f.weightGrams) || 0), 0).toFixed(0)} g</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddStepDialog(false)}>Cancelar</Button>
          <Button onClick={() => addStepMutation.mutate(buildStepPayload())} variant="contained" disabled={!stepForm.name.trim() || stepForm.timeEstimatedMinutes <= 0 || stepForm.filaments.length === 0 || stepForm.filaments.reduce((sum, f) => sum + (Number(f.weightGrams) || 0), 0) <= 0 || addStepMutation.isLoading}>Adicionar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEditStepDialog} onClose={() => setOpenEditStepDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar mesa</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nome da mesa" value={stepForm.name} onChange={(event) => setStepForm((current) => ({ ...current, name: event.target.value }))} fullWidth />
            <TextField label="Ordem" type="number" value={stepForm.order} onChange={(event) => setStepForm((current) => ({ ...current, order: event.target.value }))} fullWidth />
            <Grid container spacing={2}>
              <Grid item xs={4}><TextField label="Duração (h)" type="number" value={stepDuration.hours} onChange={(event) => updateDurationPart(stepDuration, setStepDuration, 'hours', (value) => setStepForm((current) => ({ ...current, timeEstimatedMinutes: value })), Number(event.target.value))} fullWidth /></Grid>
              <Grid item xs={4}><TextField label="Min" type="number" value={stepDuration.minutes} onChange={(event) => updateDurationPart(stepDuration, setStepDuration, 'minutes', (value) => setStepForm((current) => ({ ...current, timeEstimatedMinutes: value })), Number(event.target.value))} fullWidth /></Grid>
              <Grid item xs={4}><TextField label="Seg" type="number" value={stepDuration.seconds} onChange={(event) => updateDurationPart(stepDuration, setStepDuration, 'seconds', (value) => setStepForm((current) => ({ ...current, timeEstimatedMinutes: value })), Number(event.target.value))} fullWidth /></Grid>
            </Grid>
            <SearchSelectField label="Impressora planejada" value={stepForm.printerPlanned} options={printerOptions} onChange={(value) => setStepForm((current) => ({ ...current, printerPlanned: value }))} helperText="Usa a mesma base de impressoras do produto." placeholder="Digite o nome da impressora" minQueryLength={0} />
            <Stack spacing={1}>
              <Typography variant="body2" fontWeight={600}>Filamentos planejados</Typography>
              {stepForm.filaments.map((item, index) => (
                <Paper key={`step-filament-edit-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ flex: 1 }}>
                      <SearchSelectField label="Filamento" value={item.filamentProfileId} options={filamentOptions} onChange={(value) => updateStepFilament(index, 'filamentProfileId', value)} placeholder="Digite o nome do filamento" minQueryLength={0} />
                    </Box>
                    <TextField label="Peso (g)" type="number" value={item.weightGrams} onChange={(event) => updateStepFilament(index, 'weightGrams', Number(event.target.value))} sx={{ width: 120 }} />
                    <IconButton color="error" onClick={() => removeStepFilament(index)} sx={{ mt: 0.5 }}><RemoveCircleOutlineRoundedIcon /></IconButton>
                  </Stack>
                </Paper>
              ))}
              <Button size="small" startIcon={<AddRoundedIcon />} onClick={addStepFilament} sx={{ alignSelf: 'flex-start' }}>Adicionar filamento</Button>
              <Typography variant="caption" color="text.secondary">Peso total: {stepForm.filaments.reduce((sum, f) => sum + (Number(f.weightGrams) || 0), 0).toFixed(0)} g</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditStepDialog(false)}>Cancelar</Button>
          <Button onClick={() => selectedStep && updateStepMutation.mutate({ stepId: selectedStep.id, payload: buildStepPayload() })} variant="contained" disabled={!selectedStep || !stepForm.name.trim() || stepForm.timeEstimatedMinutes <= 0 || stepForm.filaments.length === 0 || stepForm.filaments.reduce((sum, f) => sum + (Number(f.weightGrams) || 0), 0) <= 0 || updateStepMutation.isLoading}>Salvar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openFailStepDialog} onClose={() => setOpenFailStepDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Registrar falha</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">Tempo perdido durante a falha:</Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}><TextField label="Horas" type="number" value={failDuration.hours} onChange={(event) => updateDurationPart(failDuration, setFailDuration, 'hours', (value) => setFailStepForm((current) => ({ ...current, timeLostMinutes: value })), Number(event.target.value))} fullWidth /></Grid>
              <Grid item xs={4}><TextField label="Min" type="number" value={failDuration.minutes} onChange={(event) => updateDurationPart(failDuration, setFailDuration, 'minutes', (value) => setFailStepForm((current) => ({ ...current, timeLostMinutes: value })), Number(event.target.value))} fullWidth /></Grid>
              <Grid item xs={4}><TextField label="Seg" type="number" value={failDuration.seconds} onChange={(event) => updateDurationPart(failDuration, setFailDuration, 'seconds', (value) => setFailStepForm((current) => ({ ...current, timeLostMinutes: value })), Number(event.target.value))} fullWidth /></Grid>
            </Grid>
            <TextField label="Peso perdido (g)" type="number" value={failStepForm.weightLostGrams} onChange={(event) => setFailStepForm((current) => ({ ...current, weightLostGrams: event.target.value }))} fullWidth />
            <TextField label="Motivo da falha (opcional)" value={failStepForm.failureReason} onChange={(event) => setFailStepForm((current) => ({ ...current, failureReason: event.target.value }))} multiline minRows={2} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFailStepDialog(false)}>Cancelar</Button>
          <Button onClick={() => failStepMutation.mutate({ timeLostMinutes: failStepForm.timeLostMinutes, weightLostGrams: Number(failStepForm.weightLostGrams), failureReason: failStepForm.failureReason.trim() || null })} variant="contained" color="error" disabled={failStepForm.timeLostMinutes <= 0 || Number(failStepForm.weightLostGrams) <= 0 || failStepMutation.isLoading}>Registrar falha</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
