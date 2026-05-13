import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate, useParams } from 'react-router-dom';
import { PageSection } from '../components/PageSection';
import { salesApi } from '../services/api';
import { formatUtcDate } from '../services/date';
import { formatCurrency, paymentMethodLabel } from '../services/labels';

export function SaleDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: sale, isLoading, isError } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => salesApi.getById(id!),
    enabled: Boolean(id)
  });

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h4">Detalhes da venda</Typography>
          <Typography color="text.secondary">Visualize itens, valores e comissionamento.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/vendas', { state: { preserveState: true } })}>
          Voltar para vendas
        </Button>
      </Stack>

      {isLoading ? <Typography color="text.secondary">Carregando venda...</Typography> : null}
      {isError ? <Alert severity="error">Nao foi possivel carregar os detalhes desta venda.</Alert> : null}
      {!isLoading && !isError && !sale ? <Alert severity="warning">Venda nao encontrada.</Alert> : null}

      {sale ? (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Data</Typography><Typography variant="h6">{formatUtcDate(sale.soldAtUtc)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Pagamento</Typography><Typography variant="h6">{paymentMethodLabel(sale.paymentMethod)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Total</Typography><Typography variant="h6">{formatCurrency(sale.totalAmount)}</Typography></Paper></Grid>
            <Grid item xs={12} md={3}><Paper sx={{ p: 2 }}><Typography color="text.secondary">Lucro líquido</Typography><Typography variant="h6">{formatCurrency(sale.profitAmount)}</Typography></Paper></Grid>
          </Grid>

          <PageSection title="Itens da venda" subtitle="Cada item com seus dados de comissão quando aplicável.">
            <Paper sx={{ overflowX: 'auto', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.68)' }}>
              <Table size="small" sx={{ minWidth: 980 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Produto</TableCell>
                    <TableCell>Qtd</TableCell>
                    <TableCell>Preço unit.</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Fornecedor</TableCell>
                    <TableCell>Comissionada</TableCell>
                    <TableCell>Vendedor</TableCell>
                    <TableCell>Comissão</TableCell>
                    <TableCell>Ganho da lojinha</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sale.items.map((item, index) => (
                    <TableRow key={`${item.productName}-${index}`}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell>{formatCurrency(item.totalPrice)}</TableCell>
                      <TableCell>{item.supplierName ?? 'Lojinha Sem Nome'}</TableCell>
                      <TableCell>{item.isCommissionedSale ? 'Sim' : 'Nao'}</TableCell>
                      <TableCell>{item.commissionSellerSupplierName ?? '-'}</TableCell>
                      <TableCell>{formatCurrency(item.commissionAmount)}</TableCell>
                      <TableCell>{formatCurrency(item.lojinhaGainAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </PageSection>

          {sale.notes ? (
            <PageSection title="Observações" subtitle="Notas registradas no momento da venda.">
              <Typography>{sale.notes}</Typography>
            </PageSection>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
