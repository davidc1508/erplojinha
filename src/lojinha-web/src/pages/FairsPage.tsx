import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { usePreservedListState } from '../hooks/useSessionState';
import { PageSection } from '../components/PageSection';
import { TableSkeleton } from '../components/TableSkeleton';
import { fairsApi } from '../services/api';
import { formatUtcDate, formatUtcDateRange, getUtcDateParts, isUtcDateTodayOrPast } from '../services/date';
import { fairStatusLabel, formatCurrency } from '../services/labels';
import { capitalizeFirstLetter } from '../services/text';
import type { Fair } from '../services/types';

type FairSortField = 'name' | 'eventDateUtc' | 'location' | 'status' | 'grossRevenue' | 'netRevenue';

const defaultListState = {
  search: '',
  statusFilter: 'all',
  calendarMonth: (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })(),
  page: 0,
  rowsPerPage: 10,
  sortField: 'eventDateUtc' as FairSortField,
  sortDirection: 'desc' as 'asc' | 'desc'
};

function getFairChipColor(status: string) {
  if (status === 'Open') {
    return 'success' as const;
  }

  if (status === 'Awaiting') {
    return 'warning' as const;
  }

  if (status === 'Cancelled') {
    return 'error' as const;
  }

  return 'default' as const;
}

export function FairsPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [listState, setListState] = usePreservedListState('fairs-page', defaultListState);
  const { search, statusFilter, calendarMonth, page, rowsPerPage, sortField, sortDirection } = listState;
  const [fairToDelete, setFairToDelete] = useState<Fair | null>(null);

  const { data: fairs = [], isLoading: isLoadingFairs } = useQuery({ queryKey: ['fairs'], queryFn: fairsApi.getAll });

  const deleteMutation = useMutation({
    mutationFn: async (fairId: string) => fairsApi.remove(fairId),
    onSuccess: async () => {
      setFairToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
    }
  });

  const startMutation = useMutation({
    mutationFn: async (fairId: string) => fairsApi.start(fairId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const filteredFairs = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return fairs.filter((fair) => {
      const matchesText = normalized.length === 0
        || fair.name.toLowerCase().includes(normalized)
        || fair.location.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === 'all' || fair.status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [fairs, search, statusFilter]);

  const sortedFairs = useMemo(() => {
    const sorted = [...filteredFairs];
    sorted.sort((left, right) => {
      const leftValue = left[sortField];
      const rightValue = right[sortField];
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : sortField === 'eventDateUtc'
          ? new Date(String(leftValue)).getTime() - new Date(String(rightValue)).getTime()
          : String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'pt-BR');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredFairs, sortDirection, sortField]);

  const pagedFairs = useMemo(
    () => sortedFairs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [page, rowsPerPage, sortedFairs]
  );

  const fairComparison = useMemo(() => {
    return [...fairs]
      .filter((fair) => fair.status === 'Open' || fair.status === 'Finalized')
      .sort((left, right) => new Date(right.eventDateUtc).getTime() - new Date(left.eventDateUtc).getTime())
      .slice(0, 5)
      .map((fair) => {
        const margin = fair.grossRevenue > 0 ? (fair.netRevenue / fair.grossRevenue) * 100 : 0;
        return {
          id: fair.id,
          name: fair.name,
          grossRevenue: fair.grossRevenue,
          netRevenue: fair.netRevenue,
          margin,
          eventDateUtc: fair.eventDateUtc
        };
      });
  }, [fairs]);

  const bestResultFair = useMemo(
    () => fairComparison.length === 0 ? null : [...fairComparison].sort((left, right) => right.netRevenue - left.netRevenue)[0],
    [fairComparison]
  );

  const bestMarginFair = useMemo(
    () => fairComparison.length === 0 ? null : [...fairComparison].sort((left, right) => right.margin - left.margin)[0],
    [fairComparison]
  );

  const calendarDays = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
    const fairsByDay = fairs.reduce<Record<number, typeof fairs>>((acc, fair) => {
      const currentDate = new Date(fair.eventDateUtc);
      const endDate = new Date(fair.endDateUtc);

      while (currentDate <= endDate) {
        const eventDate = getUtcDateParts(currentDate);
        if (eventDate.year === year && eventDate.month === month) {
          const day = eventDate.day;
          acc[day] = [...(acc[day] ?? []), fair];
        }

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      return acc;
    }, {});

    return Array.from({ length: leadingEmptyDays + daysInMonth }, (_, index) => {
      if (index < leadingEmptyDays) {
        return null;
      }

      const day = index - leadingEmptyDays + 1;
      return { day, fairs: fairsByDay[day] ?? [] };
    });
  }, [calendarMonth, fairs]);

  function updateListState(patch: Partial<typeof defaultListState>) {
    setListState((current) => ({ ...current, ...patch }));
  }

  function handleSort(field: FairSortField) {
    updateListState({
      sortField: field,
      sortDirection: sortField === field && sortDirection === 'asc' ? 'desc' : 'asc',
      page: 0
    });
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h3">Feiras</Typography>
        <Typography color="text.secondary">Listagem com filtro. Cada feira abre em uma tela própria para relatório, ações e vendas.</Typography>
      </Stack>

      <PageSection title="Feiras cadastradas" subtitle="Abra uma feira para ver o relatório completo, finalizar o evento ou registrar vendas.">
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
            <div>
              <Typography variant="h6">Calendário de feiras</Typography>
              <Typography color="text.secondary">Datas realizadas e agendadas concentradas por mês.</Typography>
            </div>
            <TextField label="Mês" type="month" value={calendarMonth} onChange={(event) => updateListState({ calendarMonth: event.target.value })} InputLabelProps={{ shrink: true }} sx={{ minWidth: { xs: '100%', md: 220 } }} />
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}>
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((weekday) => (
              <Paper key={weekday} sx={{ p: 1.25, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.78)' }}>
                <Typography fontWeight={700} fontSize={13}>{weekday}</Typography>
              </Paper>
            ))}
            {calendarDays.map((day, index) => (
              <Paper key={day ? `${calendarMonth}-${day.day}` : `empty-${index}`} sx={{ minHeight: 118, p: 1.25, backgroundColor: 'rgba(255,255,255,0.62)', opacity: day ? 1 : 0.35 }}>
                {day ? (
                  <Stack spacing={0.75}>
                    <Typography fontWeight={700}>{day.day}</Typography>
                    {day.fairs.map((fair) => (
                      <Chip
                        key={`${fair.id}-${day.day}`}
                        label={capitalizeFirstLetter(fair.name)}
                        size="small"
                        color={getFairChipColor(fair.status)}
                        onClick={() => navigate(`/feiras/${fair.id}`, { state: { preserveState: true } })}
                        sx={{ justifyContent: 'flex-start' }}
                      />
                    ))}
                  </Stack>
                ) : null}
              </Paper>
            ))}
          </Box>
        </Stack>

        <Stack spacing={2} sx={{ mb: 3 }}>
          <Typography variant="h6">Comparativo entre feiras</Typography>
          <Typography color="text.secondary">Últimas 5 feiras em aberto ou finalizadas para comparar resultado e margem no mesmo contexto.</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Melhor resultado líquido</Typography><Typography variant="h6">{bestResultFair ? `${capitalizeFirstLetter(bestResultFair.name)} • ${formatCurrency(bestResultFair.netRevenue)} • ${formatUtcDate(bestResultFair.eventDateUtc)}` : 'Sem dados'}</Typography></Paper></Grid>
            <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Melhor margem</Typography><Typography variant="h6">{bestMarginFair ? `${capitalizeFirstLetter(bestMarginFair.name)} • ${bestMarginFair.margin.toFixed(1)}% • ${formatUtcDate(bestMarginFair.eventDateUtc)}` : 'Sem dados'}</Typography></Paper></Grid>
          </Grid>
          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Feira</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell>Receita bruta</TableCell>
                  <TableCell>Resultado líquido</TableCell>
                  <TableCell>Margem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fairComparison.map((item) => (
                  <TableRow key={item.id} hover onClick={() => navigate(`/feiras/${item.id}`, { state: { preserveState: true } })} sx={{ cursor: 'pointer' }}>
                    <TableCell>{capitalizeFirstLetter(item.name)}</TableCell>
                    <TableCell>{formatUtcDate(item.eventDateUtc)}</TableCell>
                    <TableCell>{formatCurrency(item.grossRevenue)}</TableCell>
                    <TableCell>{formatCurrency(item.netRevenue)}</TableCell>
                    <TableCell>{item.margin.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {fairComparison.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}><Typography color="text.secondary">Sem feiras para comparar no momento.</Typography></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flex: 1 }}>
            <TextField
              value={search}
              onChange={(event) => updateListState({ search: event.target.value, page: 0 })}
              placeholder="Buscar por nome ou local"
              fullWidth
              InputProps={{ startAdornment: <SearchRoundedIcon color="action" sx={{ mr: 1 }} /> }}
            />
            <TextField
              select
              label="Status"
              value={statusFilter}
              onChange={(event) => updateListState({ statusFilter: event.target.value, page: 0 })}
              sx={{ minWidth: { xs: '100%', md: 180 } }}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="Awaiting">Aguardando</MenuItem>
              <MenuItem value="Open">Em aberto</MenuItem>
              <MenuItem value="Finalized">Finalizadas</MenuItem>
              <MenuItem value="Cancelled">Canceladas</MenuItem>
            </TextField>
          </Stack>
          {!isSupplier ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/feiras/nova', { state: { preserveState: true } })}>
            Nova feira
          </Button> : null}
        </Stack>

        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {filteredFairs.length} feira(s) encontrada(s)
        </Typography>

        {isLoadingFairs ? <TableSkeleton rows={6} columns={7} /> : isMobile ? (
          <Stack spacing={1.5}>
            {pagedFairs.map((fair) => (
              <Paper
                key={fair.id}
                onClick={() => navigate(`/feiras/${fair.id}`, { state: { preserveState: true } })}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderRadius: 3,
                  border: '1px solid rgba(217,107,135,0.12)',
                  backgroundColor: 'rgba(255,255,255,0.68)'
                }}
              >
                <Stack spacing={1.1}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography fontWeight={700}>{capitalizeFirstLetter(fair.name)}</Typography>
                    <Chip label={fairStatusLabel(fair.status)} size="small" color={getFairChipColor(fair.status)} />
                  </Stack>
                  <Typography color="text.secondary">{formatUtcDateRange(fair.eventDateUtc, fair.endDateUtc)} • {fair.location}</Typography>
                  <Typography color="text.secondary">Bruto: {formatCurrency(fair.grossRevenue)}</Typography>
                  <Typography fontWeight={700}>Resultado: {formatCurrency(fair.netRevenue)}</Typography>
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    {!isSupplier && fair.status === 'Awaiting' && isUtcDateTodayOrPast(fair.eventDateUtc) ? <Button size="small" variant="contained" onClick={(event) => {
                      event.stopPropagation();
                      startMutation.mutate(fair.id);
                    }} disabled={startMutation.isLoading}>Iniciar</Button> : null}
                    <IconButton color="secondary" onClick={() => navigate(`/feiras/${fair.id}`, { state: { preserveState: true } })}>
                      <LaunchRoundedIcon />
                    </IconButton>
                    {!isSupplier ? <IconButton color="primary" onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/feiras/${fair.id}/editar`, { state: { preserveState: true } });
                    }}>
                      <EditRoundedIcon />
                    </IconButton> : null}
                    {!isSupplier ? <IconButton color="error" onClick={(event) => {
                      event.stopPropagation();
                      setFairToDelete(fair);
                    }}>
                      <DeleteOutlineRoundedIcon />
                    </IconButton> : null}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small" sx={{ minWidth: 980, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '23%', whiteSpace: 'nowrap' }}><TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDirection : 'asc'} onClick={() => handleSort('name')}>Feira</TableSortLabel></TableCell>
                  <TableCell sx={{ width: '16%', whiteSpace: 'nowrap' }}><TableSortLabel active={sortField === 'eventDateUtc'} direction={sortField === 'eventDateUtc' ? sortDirection : 'asc'} onClick={() => handleSort('eventDateUtc')}>Período</TableSortLabel></TableCell>
                  <TableCell sx={{ width: '24%', whiteSpace: 'nowrap' }}><TableSortLabel active={sortField === 'location'} direction={sortField === 'location' ? sortDirection : 'asc'} onClick={() => handleSort('location')}>Local</TableSortLabel></TableCell>
                  <TableCell sx={{ width: '12%', whiteSpace: 'nowrap' }}><TableSortLabel active={sortField === 'status'} direction={sortField === 'status' ? sortDirection : 'asc'} onClick={() => handleSort('status')}>Status</TableSortLabel></TableCell>
                  <TableCell sx={{ width: '13%', whiteSpace: 'nowrap' }}><TableSortLabel active={sortField === 'grossRevenue'} direction={sortField === 'grossRevenue' ? sortDirection : 'asc'} onClick={() => handleSort('grossRevenue')}>Receita bruta</TableSortLabel></TableCell>
                  <TableCell sx={{ width: '10%', whiteSpace: 'nowrap' }}><TableSortLabel active={sortField === 'netRevenue'} direction={sortField === 'netRevenue' ? sortDirection : 'asc'} onClick={() => handleSort('netRevenue')}>Resultado</TableSortLabel></TableCell>
                  <TableCell align="right" sx={{ width: '6%', whiteSpace: 'nowrap' }}>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedFairs.map((fair) => (
                  <TableRow key={fair.id} hover onClick={() => navigate(`/feiras/${fair.id}`, { state: { preserveState: true } })} sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ maxWidth: 0 }}>
                      <Stack spacing={0.5}>
                        <Typography fontWeight={700} noWrap>{capitalizeFirstLetter(fair.name)}</Typography>
                        <Typography color="text.secondary" fontSize={13} noWrap>Caixinha: {formatCurrency(fair.piggyBankAmount)}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'normal' }}>
                      <Stack spacing={0.25}>
                        <Typography fontSize={13}>{formatUtcDate(fair.eventDateUtc)}</Typography>
                        <Typography fontSize={13}>{formatUtcDate(fair.endDateUtc)}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 0 }}><Typography noWrap>{fair.location}</Typography></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}><Chip label={fairStatusLabel(fair.status)} size="small" color={getFairChipColor(fair.status)} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(fair.grossRevenue)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(fair.netRevenue)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {!isSupplier && fair.status === 'Awaiting' && isUtcDateTodayOrPast(fair.eventDateUtc) ? <Button size="small" variant="contained" onClick={(event) => {
                        event.stopPropagation();
                        startMutation.mutate(fair.id);
                      }} disabled={startMutation.isLoading}>Iniciar</Button> : null}
                      <IconButton color="secondary" onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/feiras/${fair.id}`, { state: { preserveState: true } });
                      }}>
                        <LaunchRoundedIcon />
                      </IconButton>
                      {!isSupplier ? <IconButton color="primary" onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/feiras/${fair.id}/editar`, { state: { preserveState: true } });
                      }}>
                        <EditRoundedIcon />
                      </IconButton> : null}
                      {!isSupplier ? <IconButton color="error" onClick={(event) => {
                        event.stopPropagation();
                        setFairToDelete(fair);
                      }}>
                        <DeleteOutlineRoundedIcon />
                      </IconButton> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        <TablePagination
          component="div"
          count={sortedFairs.length}
          page={page}
          onPageChange={(_event, nextPage) => updateListState({ page: nextPage })}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => updateListState({ rowsPerPage: Number(event.target.value), page: 0 })}
          rowsPerPageOptions={[5, 10, 20, 50]}
          labelRowsPerPage="Itens por página"
        />
      </PageSection>

      <ConfirmDialog
        open={fairToDelete !== null}
        title="Excluir feira"
        description={fairToDelete ? `Deseja excluir a feira ${fairToDelete.name}? Se houver vendas relacionadas, elas também serão removidas.` : ''}
        confirmLabel="Excluir"
        confirmColor="error"
        isLoading={deleteMutation.isLoading}
        onCancel={() => setFairToDelete(null)}
        onConfirm={() => {
          if (fairToDelete) {
            deleteMutation.mutate(fairToDelete.id);
          }
        }}
      />
    </Stack>
  );
}
