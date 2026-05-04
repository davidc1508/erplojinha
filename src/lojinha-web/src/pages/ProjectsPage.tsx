import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { SearchSelectField } from '../components/SearchSelectField';
import { productsApi, projectsApi } from '../services/api';
import { Project, ProjectStatus } from '../services/types';

const statusColors: Record<ProjectStatus, 'default' | 'primary' | 'success' | 'error'> = {
  Planejado: 'default',
  EmAndamento: 'primary',
  Concluido: 'success',
  Cancelado: 'error'
};

const statusLabels: Record<ProjectStatus, string> = {
  Planejado: 'Planejado',
  EmAndamento: 'Em andamento',
  Concluido: 'Concluído',
  Cancelado: 'Cancelado'
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    productId: ''
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll()
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products-projects-link'],
    queryFn: () => productsApi.getAll()
  });

  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item.name])), [products]);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => projectsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setOpenDialog(false);
      setFormData({ name: '', description: '', productId: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  const handleCreateProject = () => {
    createMutation.mutate({
      name: formData.name.trim(),
      description: formData.description.trim(),
      productId: formData.productId || null,
      status: 'Planejado'
    });
  };

  const handleDeleteProject = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este projeto?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <Typography color="text.secondary">Carregando projetos...</Typography>;
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h3">Projetos de produção</Typography>
        <Typography color="text.secondary">Planeje o produto final por mesas, acompanhe tentativas e controle o progresso pelo tempo estimado.</Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Projetos ativos</Typography><Typography variant="h5">{projects.filter((item) => item.status !== 'Concluido' && item.status !== 'Cancelado').length}</Typography></Paper></Grid>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Projetos concluídos</Typography><Typography variant="h5">{projects.filter((item) => item.status === 'Concluido').length}</Typography></Paper></Grid>
        <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Tempo estimado total</Typography><Typography variant="h5">{projects.reduce((sum, item) => sum + item.timeEstimatedMinutes, 0).toFixed(0)} min</Typography></Paper></Grid>
      </Grid>

      <PageSection title="Projetos" subtitle="Cada projeto reúne mesas planejadas, tentativas reais e perdas por falha.">
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={() => setOpenDialog(true)}>Novo projeto</Button>
          </Stack>

          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Projeto</TableCell>
                  <TableCell>Produto vinculado</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progresso</TableCell>
                  <TableCell>Tempo</TableCell>
                  <TableCell>Peso</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((project: Project) => (
                  <TableRow key={project.id} hover>
                    <TableCell>
                      <Stack spacing={0.35}>
                        <Typography fontWeight={700}>{project.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{project.description || 'Sem observação'}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{project.productId ? (productMap.get(project.productId) ?? 'Produto vinculado') : '-'}</TableCell>
                    <TableCell><Chip label={statusLabels[project.status]} color={statusColors[project.status]} size="small" /></TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <Stack spacing={0.5}>
                        <LinearProgress variant="determinate" value={project.progressPercentage} />
                        <Typography variant="caption">{project.progressPercentage.toFixed(0)}%</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{project.timeCompletedMinutes.toFixed(0)} / {project.timeEstimatedMinutes.toFixed(0)} min</TableCell>
                    <TableCell>{project.weightCompletedGrams.toFixed(0)} / {project.weightEstimatedGrams.toFixed(0)} g</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => navigate(`/projetos/${project.id}`)}>Abrir</Button>
                      <Button size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => handleDeleteProject(project.id)}>Excluir</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}><Typography color="text.secondary">Sem projetos cadastrados por enquanto.</Typography></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      </PageSection>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo projeto</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {createMutation.isError ? <Alert severity="error" sx={{ mb: 2 }}>Erro ao criar projeto.</Alert> : null}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nome do projeto" value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} fullWidth />
            <SearchSelectField
              label="Produto vinculado"
              value={formData.productId}
              options={products.map((item) => ({ id: item.id, name: item.name, secondaryText: item.category }))}
              onChange={(value) => setFormData((current) => ({ ...current, productId: value }))}
              helperText="Opcional nesta etapa. Você pode apontar para um produto já existente."
              placeholder="Digite o nome do produto"
              minQueryLength={0}
            />
            <TextField label="Observação" value={formData.description} onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))} multiline minRows={3} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button onClick={handleCreateProject} variant="contained" disabled={!formData.name.trim() || createMutation.isLoading}>{createMutation.isLoading ? 'Criando...' : 'Criar'}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
