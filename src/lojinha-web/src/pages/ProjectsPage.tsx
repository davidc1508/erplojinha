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
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageSection } from '../components/PageSection';
import { SearchSelectField } from '../components/SearchSelectField';
import { operationalListsApi, productsApi, projectsApi } from '../services/api';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const todoItemId = searchParams.get('todoItemId');
  const todoName = searchParams.get('todoName') ?? '';
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    productId: ''
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | ProjectStatus>('Todos');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll()
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products-projects-link'],
    queryFn: () => productsApi.getAll({ isBudget: false })
  });

  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item.name])), [products]);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => projectsApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });

      if (todoItemId) {
        try {
          await operationalListsApi.removeTodoItem(todoItemId);
        }
        catch {
          // Keep project creation successful even if todo cleanup fails.
        }
        await queryClient.invalidateQueries({ queryKey: ['operational-todo'] });
      }

      setOpenDialog(false);
      setFormData({ name: '', description: '', productId: '' });

      if (todoItemId) {
        setSearchParams({}, { replace: true });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
  const duplicateMutation = useMutation({
    mutationFn: (projectId: string) => projectsApi.duplicate(projectId),
    onSuccess: (duplicatedProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projetos/${duplicatedProject.id}`, { state: { preserveState: true } });
    }
  });
  const startMutation = useMutation({
    mutationFn: (projectId: string) => projectsApi.start(projectId),
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
    setDeleteTargetId(id);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (statusFilter !== 'Todos' && project.status !== statusFilter) {
        return false;
      }

      const query = search.trim().toLowerCase();
      if (!query) {
        return true;
      }

      const productName = project.productId ? (productMap.get(project.productId) ?? '') : '';
      return [project.name, project.description, productName]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [productMap, projects, search, statusFilter]);

  const paginatedProjects = useMemo(
    () => filteredProjects.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredProjects, page, rowsPerPage]
  );

  const totalProjects = projects.length;
  const inProgressProjects = projects.filter((item) => item.status === 'EmAndamento').length;
  const plannedProjects = projects.filter((item) => item.status === 'Planejado').length;
  const concludedProjects = projects.filter((item) => item.status === 'Concluido').length;

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, rowsPerPage]);

  useEffect(() => {
    if (!todoItemId) {
      return;
    }

    setOpenDialog(true);
    if (todoName.trim().length > 0) {
      setFormData((current) => current.name.trim().length > 0
        ? current
        : { ...current, name: todoName });
    }
  }, [todoItemId, todoName]);

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
        <Grid item xs={12} sm={6} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Total de projetos</Typography><Typography variant="h5">{totalProjects}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Projetos em andamento</Typography><Typography variant="h5">{inProgressProjects}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Projetos planejados</Typography><Typography variant="h5">{plannedProjects}</Typography></Paper></Grid>
        <Grid item xs={12} sm={6} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Projetos concluídos</Typography><Typography variant="h5">{concludedProjects}</Typography></Paper></Grid>
      </Grid>

      <PageSection title="Projetos" subtitle="Cada projeto reúne mesas planejadas, tentativas reais e perdas por falha.">
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={() => setOpenDialog(true)}>Novo projeto</Button>
          </Stack>

          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Buscar projetos"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, observação ou produto vinculado"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'Todos' | ProjectStatus)}>
                <MenuItem value="Todos">Todos</MenuItem>
                <MenuItem value="Planejado">Planejado</MenuItem>
                <MenuItem value="EmAndamento">Em andamento</MenuItem>
                <MenuItem value="Concluido">Concluído</MenuItem>
                <MenuItem value="Cancelado">Cancelado</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="outlined" startIcon={<FilterAltRoundedIcon />} onClick={() => { setSearch(''); setStatusFilter('Todos'); }}>
                Limpar
              </Button>
            </Grid>
          </Grid>

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
                {paginatedProjects.map((project: Project) => (
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
                      <Tooltip title="Abrir">
                        <IconButton size="small" onClick={() => navigate(`/projetos/${project.id}`)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {project.status === 'Concluido' ? (
                        <Tooltip title="Iniciar novamente">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => duplicateMutation.mutate(project.id)}
                            disabled={duplicateMutation.isLoading}
                          >
                            <ReplayRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {project.status === 'Planejado' ? (
                        <Tooltip title="Iniciar">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => startMutation.mutate(project.id)}
                            disabled={startMutation.isLoading}
                          >
                            <PlayArrowRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => handleDeleteProject(project.id)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}><Typography color="text.secondary">Nenhum projeto encontrado com os filtros atuais.</Typography></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredProjects.length}
              page={page}
              onPageChange={(_event, nextPage) => setPage(nextPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(Number(event.target.value));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
              labelRowsPerPage="Linhas por página"
            />
          </Paper>
        </Stack>
      </PageSection>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo projeto</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {createMutation.isError ? <Alert severity="error" sx={{ mb: 2 }}>Erro ao criar projeto.</Alert> : null}
          {todoItemId ? <Alert severity="info" sx={{ mb: 2 }}>Ao criar o projeto, este item será removido da lista de itens a fazer.</Alert> : null}
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

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title="Excluir projeto"
        description="Tem certeza que deseja excluir este projeto? Esta ação não poderá ser desfeita."
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteMutation.isLoading}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            deleteMutation.mutate(deleteTargetId, { onSuccess: () => setDeleteTargetId(null) });
          }
        }}
      />
    </Stack>
  );
}
