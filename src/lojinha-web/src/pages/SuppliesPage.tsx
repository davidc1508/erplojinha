import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Chip,
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
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { suppliesApi } from '../services/api';
import { capitalizeFirstLetter } from '../services/text';

function formatSupplyCost(costPerUnit: number, unit: string) {
  if (unit === 'g' && costPerUnit > 0 && costPerUnit < 1) {
    return `${costPerUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / g (${(costPerUnit * 1000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / kg)`;
  }

  return costPerUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SuppliesPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { data: supplies = [] } = useQuery({ queryKey: ['supplies'], queryFn: suppliesApi.getAll });
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filteredSupplies = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return supplies.filter((supply) => {
      const matchesText = normalized.length === 0 || supply.name.toLowerCase().includes(normalized);
      const matchesUnit = unitFilter === 'all' || supply.unit === unitFilter;
      return matchesText && matchesUnit;
    });
  }, [search, supplies, unitFilter]);

  const pagedSupplies = useMemo(
    () => filteredSupplies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredSupplies, page, rowsPerPage]
  );

  const units = useMemo(() => Array.from(new Set(supplies.map((supply) => supply.unit))).sort(), [supplies]);

  return (
    <Stack spacing={3}>
      <PageSection title="Insumos" subtitle="Catálogo com busca, filtro por unidade e edição em tela separada. Filamentos em gramas também mostram o equivalente por kg.">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flex: 1 }}>
            <TextField
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Buscar por nome"
              fullWidth
              InputProps={{ startAdornment: <SearchRoundedIcon color="action" sx={{ mr: 1 }} /> }}
            />
            <TextField
              select
              label="Unidade"
              value={unitFilter}
              onChange={(event) => {
                setUnitFilter(event.target.value);
                setPage(0);
              }}
              sx={{ minWidth: { xs: '100%', md: 180 } }}
            >
              <MenuItem value="all">Todas</MenuItem>
              {units.map((unit) => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
            </TextField>
          </Stack>
          {!isSupplier ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/insumos/novo')}>
            Novo insumo
          </Button> : null}
        </Stack>

        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {filteredSupplies.length} insumo(s) encontrado(s)
        </Typography>

        {isMobile ? (
          <Stack spacing={1.5}>
            {pagedSupplies.map((supply) => (
              <Paper key={supply.id} sx={{ p: 2, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
                <Stack spacing={1.1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography fontWeight={700}>{capitalizeFirstLetter(supply.name)}</Typography>
                    <Chip label={`${supply.stockQuantity} ${supply.unit}`} color={supply.stockQuantity <= supply.minimumStock ? 'warning' : 'success'} size="small" />
                  </Stack>
                  <Typography color="text.secondary">Custo: {formatSupplyCost(supply.costPerUnit, supply.unit)}</Typography>
                  <Typography color="text.secondary">Estoque mínimo: {supply.minimumStock} {supply.unit}</Typography>
                    {!isSupplier ? <Stack direction="row" justifyContent="flex-end">
                      <IconButton color="primary" onClick={() => navigate(`/insumos/${supply.id}/editar`)}>
                        <EditRoundedIcon />
                      </IconButton>
                    </Stack> : null}
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Insumo</TableCell>
                  <TableCell>Unidade</TableCell>
                  <TableCell>Custo</TableCell>
                  <TableCell>Estoque</TableCell>
                  <TableCell>Mínimo</TableCell>
                  {!isSupplier ? <TableCell align="right">Ações</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedSupplies.map((supply) => (
                  <TableRow key={supply.id} hover>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography fontWeight={700}>{capitalizeFirstLetter(supply.name)}</Typography>
                        <Typography color="text.secondary" fontSize={13}>{capitalizeFirstLetter(supply.notes || 'Sem observações')}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{supply.unit}</TableCell>
                    <TableCell>{formatSupplyCost(supply.costPerUnit, supply.unit)}</TableCell>
                    <TableCell>
                      <Chip label={`${supply.stockQuantity} ${supply.unit}`} color={supply.stockQuantity <= supply.minimumStock ? 'warning' : 'success'} size="small" />
                    </TableCell>
                    <TableCell>{supply.minimumStock}</TableCell>
                    {!isSupplier ? <TableCell align="right">
                      <IconButton color="primary" onClick={() => navigate(`/insumos/${supply.id}/editar`)}>
                        <EditRoundedIcon />
                      </IconButton>
                    </TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        <TablePagination
          component="div"
          count={filteredSupplies.length}
          page={page}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 20, 50]}
          labelRowsPerPage="Itens por página"
        />
      </PageSection>
    </Stack>
  );
}