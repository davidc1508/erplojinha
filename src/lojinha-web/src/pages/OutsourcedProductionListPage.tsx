import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { outsourcedProductionsApi } from '../services/api';
import type { OutsourcedProductionStatus } from '../services/types';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatusChip({ status }: { status: OutsourcedProductionStatus }) {
  if (status === 'ConvertidoEmProduto') {
    return <Chip label="Convertido em produto" color="success" size="small" />;
  }
  if (status === 'Cancelado') {
    return <Chip label="Cancelado" color="error" size="small" />;
  }
  return <Chip label="Pendente" color="warning" size="small" />;
}

export function OutsourcedProductionListPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['outsourced-productions'],
    queryFn: outsourcedProductionsApi.getAll
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => outsourcedProductionsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outsourced-productions'] });
    },
    onError: () => {
      setFeedback('Erro ao excluir a produção terceirizada.');
    }
  });

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Excluir "${name}"?`)) return;
    deleteMutation.mutate(id);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Produção Terceirizada</Typography>
          <Typography color="text.secondary" fontSize={14}>
            Gerencie produções com custo compartilhado entre fornecedores
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/producao-terceirizada/nova"
          variant="contained"
          startIcon={<AddRoundedIcon />}
        >
          Nova Produção
        </Button>
      </Stack>

      {feedback && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFeedback(null)}>{feedback}</Alert>}

      <PageSection title="Produções Terceirizadas">
        {isLoading ? (
          <Typography color="text.secondary" p={3}>Carregando...</Typography>
        ) : productions.length === 0 ? (
          <Typography color="text.secondary" p={3}>Nenhuma produção terceirizada cadastrada.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Produto</TableCell>
                <TableCell>Produtor</TableCell>
                <TableCell>Destinatário</TableCell>
                <TableCell align="right">Custo Produção</TableCell>
                <TableCell align="right">Custo Fornecedor</TableCell>
                <TableCell align="center">Taxa %</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {productions.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>{p.name}</Typography>
                    {p.category && <Typography fontSize={12} color="text.secondary">{p.category}</Typography>}
                  </TableCell>
                  <TableCell>{p.producerSupplier}</TableCell>
                  <TableCell>{p.ownerSupplier}</TableCell>
                  <TableCell align="right">{formatCurrency(p.productionCost)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {formatCurrency(p.supplierCost)}
                  </TableCell>
                  <TableCell align="center">{p.productionFeePercentage}%</TableCell>
                  <TableCell align="center"><StatusChip status={p.status} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Ver detalhes">
                        <IconButton component={RouterLink} to={`/producao-terceirizada/${p.id}`} size="small">
                          <OpenInNewRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {p.status === 'Pendente' && (
                        <>
                          <Tooltip title="Editar">
                            <IconButton component={RouterLink} to={`/producao-terceirizada/${p.id}/editar`} size="small">
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Excluir">
                            <IconButton size="small" color="error" onClick={() => handleDelete(p.id, p.name)}>
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageSection>
    </Box>
  );
}
