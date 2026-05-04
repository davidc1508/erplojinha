import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Grid,
  IconButton,
  MenuItem,
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
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useMemo, useState } from 'react';
import { PageSection } from '../components/PageSection';
import { operationalListsApi, productsApi } from '../services/api';
import type {
  OperationalItemPriority,
  OperationalRestockItem,
  OperationalTodoItem,
  RestockTaskStatus,
  TodoTaskStatus
} from '../services/types';

const priorityOptions: OperationalItemPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const restockStatusOptions: RestockTaskStatus[] = ['Open', 'InProgress', 'Completed', 'Cancelled'];
const todoStatusOptions: TodoTaskStatus[] = ['Backlog', 'InAnalysis', 'InDevelopment', 'Completed', 'Cancelled'];

const emptyRestockForm = {
  id: '',
  productId: '',
  targetQuantity: '1',
  priority: 'Medium' as OperationalItemPriority,
  status: 'Open' as RestockTaskStatus,
  dueDateUtc: '',
  notes: ''
};

const emptyTodoForm = {
  id: '',
  name: '',
  priority: 'Medium' as OperationalItemPriority,
  status: 'Backlog' as TodoTaskStatus,
  source: ''
};

function priorityLabel(value: OperationalItemPriority) {
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

function todoStatusLabel(value: TodoTaskStatus) {
  return {
    Backlog: 'Backlog',
    InAnalysis: 'Em análise',
    InDevelopment: 'Em desenvolvimento',
    Completed: 'Concluído',
    Cancelled: 'Cancelado'
  }[value];
}

function toDateInput(value?: string) {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}

export function OperationalListsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'warning'; message: string } | null>(null);
  const [restockForm, setRestockForm] = useState(emptyRestockForm);
  const [todoForm, setTodoForm] = useState(emptyTodoForm);

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: productsApi.getAll });
  const { data: restockItems = [] } = useQuery({ queryKey: ['operational-restock'], queryFn: operationalListsApi.getRestockItems });
  const { data: todoItems = [] } = useQuery({ queryKey: ['operational-todo'], queryFn: operationalListsApi.getTodoItems });

  const sortedProducts = useMemo(() => [...products].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')), [products]);

  const saveRestockMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        productId: restockForm.productId,
        targetQuantity: Number(restockForm.targetQuantity),
        priority: restockForm.priority,
        status: restockForm.status,
        dueDateUtc: restockForm.dueDateUtc || null,
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
    onError: () => setFeedback({ severity: 'warning', message: 'Não foi possível salvar o item de reposição.' })
  });

  const deleteRestockMutation = useMutation({
    mutationFn: async (id: string) => operationalListsApi.removeRestockItem(id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Item de reposição removido.' });
      await queryClient.invalidateQueries({ queryKey: ['operational-restock'] });
    },
    onError: () => setFeedback({ severity: 'warning', message: 'Não foi possível remover o item de reposição.' })
  });

  const saveTodoMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: todoForm.name,
        priority: todoForm.priority,
        status: todoForm.status,
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
    onError: () => setFeedback({ severity: 'warning', message: 'Não foi possível salvar o item a fazer.' })
  });

  const deleteTodoMutation = useMutation({
    mutationFn: async (id: string) => operationalListsApi.removeTodoItem(id),
    onSuccess: async () => {
      setFeedback({ severity: 'success', message: 'Item a fazer removido.' });
      await queryClient.invalidateQueries({ queryKey: ['operational-todo'] });
    },
    onError: () => setFeedback({ severity: 'warning', message: 'Não foi possível remover o item a fazer.' })
  });

  function editRestock(item: OperationalRestockItem) {
    setRestockForm({
      id: item.id,
      productId: item.productId,
      targetQuantity: String(item.targetQuantity),
      priority: item.priority,
      status: item.status,
      dueDateUtc: toDateInput(item.dueDateUtc),
      notes: item.notes
    });
  }

  function editTodo(item: OperationalTodoItem) {
    setTodoForm({
      id: item.id,
      name: item.name,
      priority: item.priority,
      status: item.status,
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
        <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Reposição</Typography><Typography variant="h5">{restockItems.length}</Typography></Paper></Grid>
        <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Itens a fazer</Typography><Typography variant="h5">{todoItems.length}</Typography></Paper></Grid>
      </Grid>

      <PageSection title="Reposição de produtos" subtitle="Planejamento rápido para o que precisa voltar ao estoque.">
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Produto"
                value={restockForm.productId}
                onChange={(event) => setRestockForm((current) => ({ ...current, productId: event.target.value }))}
              >
                {sortedProducts.map((product) => (
                  <MenuItem key={product.id} value={product.id}>{product.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Qtd alvo"
                value={restockForm.targetQuantity}
                onChange={(event) => setRestockForm((current) => ({ ...current, targetQuantity: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Prioridade"
                value={restockForm.priority}
                onChange={(event) => setRestockForm((current) => ({ ...current, priority: event.target.value as OperationalItemPriority }))}
              >
                {priorityOptions.map((value) => <MenuItem key={value} value={value}>{priorityLabel(value)}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Status"
                value={restockForm.status}
                onChange={(event) => setRestockForm((current) => ({ ...current, status: event.target.value as RestockTaskStatus }))}
              >
                {restockStatusOptions.map((value) => <MenuItem key={value} value={value}>{restockStatusLabel(value)}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Prazo"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={restockForm.dueDateUtc}
                onChange={(event) => setRestockForm((current) => ({ ...current, dueDateUtc: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Observação"
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
                  <TableCell>Prazo</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {restockItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.productCategory || '-'}</TableCell>
                    <TableCell>{item.targetQuantity}</TableCell>
                    <TableCell>{priorityLabel(item.priority)}</TableCell>
                    <TableCell>{restockStatusLabel(item.status)}</TableCell>
                    <TableCell>{item.dueDateUtc ? new Date(item.dueDateUtc).toLocaleDateString('pt-BR') : '-'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton color="primary" onClick={() => editRestock(item)}><EditRoundedIcon /></IconButton>
                      <IconButton color="error" onClick={() => deleteRestockMutation.mutate(item.id)}><DeleteOutlineRoundedIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {restockItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}><Typography color="text.secondary">Sem itens de reposição por enquanto.</Typography></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      </PageSection>

      <PageSection title="Itens a fazer" subtitle="Backlog de novos itens e ideias de produção.">
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
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Prioridade"
                value={todoForm.priority}
                onChange={(event) => setTodoForm((current) => ({ ...current, priority: event.target.value as OperationalItemPriority }))}
              >
                {priorityOptions.map((value) => <MenuItem key={value} value={value}>{priorityLabel(value)}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Status"
                value={todoForm.status}
                onChange={(event) => setTodoForm((current) => ({ ...current, status: event.target.value as TodoTaskStatus }))}
              >
                {todoStatusOptions.map((value) => <MenuItem key={value} value={value}>{todoStatusLabel(value)}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Fonte"
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
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {todoItems.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.source || '-'}</TableCell>
                    <TableCell>{priorityLabel(item.priority)}</TableCell>
                    <TableCell>{todoStatusLabel(item.status)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton color="primary" onClick={() => editTodo(item)}><EditRoundedIcon /></IconButton>
                      <IconButton color="error" onClick={() => deleteTodoMutation.mutate(item.id)}><DeleteOutlineRoundedIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {todoItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}><Typography color="text.secondary">Sem itens a fazer por enquanto.</Typography></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      </PageSection>
    </Stack>
  );
}
