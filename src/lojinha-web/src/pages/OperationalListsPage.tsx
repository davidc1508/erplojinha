import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import SchemaRoundedIcon from '@mui/icons-material/SchemaRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProductLookupField } from '../components/ProductLookupField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { operationalListsApi, productsApi } from '../services/api';
import type {
  OperationalRestockItem,
  OperationalTodoItem,
  RestockTaskStatus
} from '../services/types';

const restockStatusOptions: RestockTaskStatus[] = ['Open', 'InProgress', 'Completed', 'Cancelled'];

const emptyRestockForm = {
  id: '',
  productId: '',
  targetQuantity: '1',
  notes: ''
};

const emptyTodoForm = {
  id: '',
  name: '',
  source: ''
};

function priorityLabel(value: 'Low' | 'Medium' | 'High' | 'Urgent') {
  return {
    Low: 'Baixa',
    Medium: 'Média',
    High: 'Alta',
    Urgent: 'Urgente'
  }[value];
}

function restockStatusLabel(value: RestockTaskStatus) {
  return {
    Open: 'Aberto',
    InProgress: 'Em produção',
    Completed: 'Concluído',
    Cancelled: 'Cancelado'
  }[value];
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; title?: string; errors?: Record<string, string[]> } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }

    const validationErrors = response?.data?.errors;
    if (validationErrors) {
      const firstError = Object.values(validationErrors).flat().find((value) => Boolean(value));
      if (firstError) {
        return firstError;
      }
    }

    if (response?.data?.title) {
      return response.data.title;
    }
  }

  return fallback;
}

function priorityChipColor(value: 'Low' | 'Medium' | 'High' | 'Urgent'): 'default' | 'warning' | 'error' | 'success' {
  if (value === 'Urgent') {
    return 'error';
  }

  if (value === 'High') {
    return 'warning';
  }

  if (value === 'Low') {
    return 'success';
  }

  return 'default';
}

function restockStatusChipColor(value: RestockTaskStatus): 'default' | 'warning' | 'error' | 'success' {
  if (value === 'Completed') {
    return 'success';
  }

  if (value === 'Cancelled') {
    return 'error';
  }

  if (value === 'InProgress') {
    return 'warning';
  }

  return 'default';
}

export function OperationalListsPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [restockForm, setRestockForm] = useState(emptyRestockForm);
  const [todoForm, setTodoForm] = useState(emptyTodoForm);
  const [restockToDelete, setRestockToDelete] = useState<{ id: string; productName: string } | null>(null);
  const [todoToDelete, setTodoToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ['products', isSupplier ? 'catalog' : 'all'],
    queryFn: () => productsApi.getAll({ includeAllForSupplier: isSupplier || undefined })
  });
  const { data: restockItems = [] } = useQuery({ queryKey: ['operational-restock'], queryFn: operationalListsApi.getRestockItems });
  const { data: todoItems = [] } = useQuery({ queryKey: ['operational-todo'], queryFn: operationalListsApi.getTodoItems });

  const sortedProducts = useMemo(() => [...products].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')), [products]);

  const saveRestockMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        productId: restockForm.productId,
        targetQuantity: Number(restockForm.targetQuantity),
        notes: restockForm.notes
      };

      if (restockForm.id) {
        return operationalListsApi.updateRestockItem(restockForm.id, payload);
      }

      return operationalListsApi.createRestockItem(payload);
    },
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: restockForm.id ? 'Item de reposição atualizado.' : 'Item de reposição criado.' });
      setRestockForm(emptyRestockForm);
      await queryClient.invalidateQueries({ queryKey: ['operational-restock'] });
    },
    onError: (error) => setFeedback({ severity: 'error', message: getErrorMessage(error, 'Não foi possível salvar o item de reposição.') })
  });

  const deleteRestockMutation = useMutation({
    mutationFn: async (id: string) => operationalListsApi.removeRestockItem(id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Item de reposição removido.' });
      await queryClient.invalidateQueries({ queryKey: ['operational-restock'] });
    },
    onError: (error) => setFeedback({ severity: 'warning', message: getErrorMessage(error, 'Não foi possível remover o item de reposição.') })
  });

  const saveTodoMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: todoForm.name,
        source: todoForm.source
      };

      if (todoForm.id) {
        return operationalListsApi.updateTodoItem(todoForm.id, payload);
      }

      return operationalListsApi.createTodoItem(payload);
    },
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: todoForm.id ? 'Item a fazer atualizado.' : 'Item a fazer criado.' });
      setTodoForm(emptyTodoForm);
      await queryClient.invalidateQueries({ queryKey: ['operational-todo'] });
    },
    onError: (error) => setFeedback({ severity: 'error', message: getErrorMessage(error, 'Não foi possível salvar o item a fazer.') })
  });

  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => operationalListsApi.removeTodoItem(id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Item a fazer removido.' });
      await queryClient.invalidateQueries({ queryKey: ['operational-todo'] });
    },
    onError: (error) => setFeedback({ severity: 'warning', message: getErrorMessage(error, 'Não foi possível remover o item a fazer.') })
  });

  function editRestock(item: OperationalRestockItem) {
    setRestockForm({
      id: item.id,
      productId: item.productId,
      targetQuantity: String(item.targetQuantity),
      notes: item.notes
    });
  }

  function editTodo(item: OperationalTodoItem) {
    setTodoForm({
      id: item.id,
      name: item.name,
      source: item.source
    });
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h3">Listas operacionais</Typography>
        <Typography color="text.secondary">Organize reposições e backlog de ideias no seu perfil, sem compartilhar itens entre Admin e Fornecedor.</Typography>
      </Stack>

      {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}><Paper sx={{ p: 2.2, borderRadius: 3, background: 'linear-gradient(135deg, rgba(123,207,192,0.22), rgba(255,255,255,0.72))' }}><Typography color="text.secondary">Reposição</Typography><Typography variant="h5">{restockItems.length}</Typography></Paper></Grid>
        <Grid item xs={12} md={6}><Paper sx={{ p: 2.2, borderRadius: 3, background: 'linear-gradient(135deg, rgba(245,178,197,0.24), rgba(255,255,255,0.72))' }}><Typography color="text.secondary">Itens a fazer</Typography><Typography variant="h5">{todoItems.length}</Typography></Paper></Grid>
      </Grid>

      <PageSection title="Reposição de produtos" subtitle="Planejamento rápido para o que precisa voltar ao estoque.">
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <ProductLookupField
                label="Produto"
                value={restockForm.productId}
                products={sortedProducts}
                onChange={(productId) => setRestockForm((current) => ({ ...current, productId }))}
                helperText="Digite nome ou SKU para buscar produtos."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Qtd alvo"
                value={restockForm.targetQuantity}
                onChange={(event) => setRestockForm((current) => ({ ...current, targetQuantity: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Observação"
                helperText="Opcional"
                value={restockForm.notes}
                onChange={(event) => setRestockForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            {restockForm.id ? <Button variant="outlined" onClick={() => setRestockForm(emptyRestockForm)}>Cancelar edição</Button> : null}
            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={() => saveRestockMutation.mutate()}
              disabled={!restockForm.productId || Number(restockForm.targetQuantity) <= 0 || saveRestockMutation.isLoading}
            >
              {restockForm.id ? 'Atualizar' : 'Adicionar'}
            </Button>
          </Stack>

          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Produto</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Qtd alvo</TableCell>
                  <TableCell>Prioridade</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {restockItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.productCategory || '-'}</TableCell>
                    <TableCell>{item.targetQuantity}</TableCell>
                    <TableCell><Chip size="small" label={priorityLabel(item.priority)} color={priorityChipColor(item.priority)} /></TableCell>
                    <TableCell><Chip size="small" label={restockStatusLabel(item.status)} color={restockStatusChipColor(item.status)} /></TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton color="primary" onClick={() => editRestock(item)}><EditRoundedIcon /></IconButton>
                      <IconButton color="error" onClick={() => setRestockToDelete({ id: item.id, productName: item.productName })}><DeleteOutlineRoundedIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {restockItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}><Typography color="text.secondary">Sem itens de reposição por enquanto.</Typography></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      </PageSection>

      <PageSection title="Itens a fazer" subtitle="Backlog de novos itens e ideias de produção, com atalho para criar produto ou projeto.">
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Nome do item"
                value={todoForm.name}
                onChange={(event) => setTodoForm((current) => ({ ...current, name: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Fonte"
                helperText="Opcional"
                value={todoForm.source}
                onChange={(event) => setTodoForm((current) => ({ ...current, source: event.target.value }))}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            {todoForm.id ? <Button variant="outlined" onClick={() => setTodoForm(emptyTodoForm)}>Cancelar edição</Button> : null}
            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={() => saveTodoMutation.mutate()}
              disabled={!todoForm.name.trim() || saveTodoMutation.isLoading}
            >
              {todoForm.id ? 'Atualizar' : 'Adicionar'}
            </Button>
          </Stack>

          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Fonte</TableCell>
                  <TableCell>Prioridade</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {todoItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.source || '-'}</TableCell>
                    <TableCell><Chip size="small" label={priorityLabel(item.priority)} color={priorityChipColor(item.priority)} /></TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Criar produto a partir deste item">
                        <IconButton
                          color="success"
                          onClick={() => navigate(`/produtos/novo?todoItemId=${item.id}&todoName=${encodeURIComponent(item.name)}`, { state: { preserveState: true } })}
                        >
                          <AddCircleOutlineRoundedIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Criar projeto a partir deste item">
                        <IconButton
                          color="secondary"
                          onClick={() => navigate(`/projetos?todoItemId=${item.id}&todoName=${encodeURIComponent(item.name)}`, { state: { preserveState: true } })}
                        >
                          <SchemaRoundedIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton color="primary" onClick={() => editTodo(item)}><EditRoundedIcon /></IconButton>
                      <IconButton color="error" onClick={() => setTodoToDelete({ id: item.id, name: item.name })}><DeleteOutlineRoundedIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {todoItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}><Typography color="text.secondary">Sem itens a fazer por enquanto.</Typography></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      </PageSection>

      <ConfirmDialog
        open={Boolean(restockToDelete)}
        title="Excluir item de reposição"
        description={`Deseja excluir o item de reposição ${restockToDelete?.productName ?? ''}?`}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteRestockMutation.isLoading}
        onCancel={() => setRestockToDelete(null)}
        onConfirm={() => {
          if (!restockToDelete) {
            return;
          }

          deleteRestockMutation.mutate(restockToDelete.id, {
            onSuccess: () => setRestockToDelete(null)
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(todoToDelete)}
        title="Excluir item a fazer"
        description={`Deseja excluir o item ${todoToDelete?.name ?? ''}?`}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteTodoMutation.isLoading}
        onCancel={() => setTodoToDelete(null)}
        onConfirm={() => {
          if (!todoToDelete) {
            return;
          }

          deleteTodoMutation.mutate(todoToDelete.id, {
            onSuccess: () => setTodoToDelete(null)
          });
        }}
      />
    </Stack>
  );
}
