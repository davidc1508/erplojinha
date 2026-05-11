import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, FormControlLabel, Grid, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CurrencyField } from '../components/CurrencyField';
import { ProductLookupField } from '../components/ProductLookupField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { productsApi, salesApi, suppliersApi } from '../services/api';
import { getTodayDateInputValue, toUtcDateOnlyIso } from '../services/date';
import { paymentMethodLabel } from '../services/labels';

export function SalesEntryFormPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ['products-sales-catalog'], queryFn: productsApi.getSalesCatalog });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.getAll, enabled: !isSupplier });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({ paymentMethod: 'Pix', soldAtUtc: getTodayDateInputValue(), notes: '', createTodoForProducedItems: false, items: [{ productId: '', supplierId: '', quantity: 1, unitPrice: '', lojinhaGainPercentage: '' }] });

  const mutation = useMutation({
    mutationFn: async () => salesApi.create({
      paymentMethod: form.paymentMethod,
      soldAtUtc: toUtcDateOnlyIso(form.soldAtUtc),
      notes: form.notes,
      createTodoForProducedItems: form.createTodoForProducedItems,
      items: form.items.map((item) => ({
        productId: item.productId,
        supplierId: item.supplierId === '' ? null : item.supplierId,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === '' ? null : Number(item.unitPrice),
        lojinhaGainPercentage: item.lojinhaGainPercentage === '' ? null : Number(item.lojinhaGainPercentage)
      }))
    }),
    onSuccess: async () => {
      setFeedback('Venda registrada.');
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['products-sales-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-entries'] });
      await queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      await queryClient.invalidateQueries({ queryKey: ['fairs'] });
      await queryClient.invalidateQueries({ queryKey: ['operational-todo'] });
      navigate('/vendas', { state: { preserveState: true } });
    },
    onError: () => {
      setFeedback('Nao foi possivel registrar a venda.');
    }
  });

  function removeItem(indexToRemove: number) {
    if (form.items.length === 1) {
      return;
    }

    setForm({
      ...form,
      items: form.items.filter((_, index) => index !== indexToRemove)
    });
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h4">Nova venda</Typography>
          <Typography color="text.secondary">Cadastro em tela própria para não misturar formulário com histórico.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/vendas', { state: { preserveState: true } })}>
          Voltar para vendas
        </Button>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <PageSection title="Dados da venda" subtitle="Selecione os produtos e informe o pagamento.">
            <Stack spacing={2}>
              {feedback ? <Alert severity="warning">{feedback}</Alert> : null}
              <TextField select label="Forma de pagamento" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
                {['Pix', 'CreditCard', 'DebitCard', 'Cash', 'Transfer'].map((method) => <MenuItem key={method} value={method}>{paymentMethodLabel(method)}</MenuItem>)}
              </TextField>
              <TextField
                label="Data da venda"
                type="date"
                value={form.soldAtUtc}
                onChange={(event) => setForm({ ...form, soldAtUtc: event.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              {form.items.map((item, index) => (
                <Grid container spacing={2} key={`${index}-${item.productId}`}>
                  <Grid item xs={12} sm={form.items.length > 1 ? 10 : 12}>
                    <ProductLookupField
                      label={`Produto ${index + 1}`}
                      value={item.productId}
                      products={products}
                      onChange={(productId) => {
                        const selectedProduct = products.find((product) => product.id === productId);
                        const defaultSupplierId = selectedProduct?.supplierId ?? '';
                        const items = [...form.items];
                        items[index] = {
                          ...item,
                          productId,
                          supplierId: defaultSupplierId,
                          unitPrice: selectedProduct ? String(selectedProduct.salePrice) : '',
                          lojinhaGainPercentage: defaultSupplierId !== '' ? item.lojinhaGainPercentage : ''
                        };
                        setForm({ ...form, items });
                      }}
                    />
                  </Grid>
                  {form.items.length > 1 ? (
                    <Grid item xs={12} sm={2} display="flex" justifyContent="flex-end" alignItems="center">
                      <IconButton color="error" onClick={() => removeItem(index)} aria-label={`Remover produto ${index + 1}`}>
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    </Grid>
                  ) : null}
                  <Grid item xs={12} sm={6}><TextField label="Quantidade" type="number" value={item.quantity} onChange={(event) => {
                    const items = [...form.items];
                    items[index] = { ...item, quantity: Number(event.target.value) };
                    setForm({ ...form, items });
                  }} fullWidth /></Grid>
                  <Grid item xs={12} sm={6}><CurrencyField label="Preço unitário" value={item.unitPrice === '' ? 0 : Number(item.unitPrice)} onValueChange={(value) => {
                    const items = [...form.items];
                    items[index] = { ...item, unitPrice: String(value) };
                    setForm({ ...form, items });
                  }} fullWidth /></Grid>
                  {!isSupplier ? (
                    <Grid item xs={12} md={6}>
                      <TextField
                        select
                        label="Venda de fornecedor"
                        value={item.supplierId}
                        onChange={(event) => {
                          const supplierId = event.target.value;
                          const items = [...form.items];
                          items[index] = {
                            ...item,
                            supplierId,
                            lojinhaGainPercentage: supplierId === '' ? '' : item.lojinhaGainPercentage
                          };
                          setForm({ ...form, items });
                        }}
                        helperText="Deixe vazio para Lojinha Sem Nome."
                        fullWidth
                      >
                        <MenuItem value="">Lojinha Sem Nome</MenuItem>
                        {suppliers.map((supplier) => (
                          <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  ) : null}
                  {item.supplierId ? (
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={`% de ganho da lojinha (${suppliers.find((supplier) => supplier.id === item.supplierId)?.name ?? products.find((product) => product.id === item.productId)?.supplier ?? 'fornecedor'})`}
                        type="number"
                        value={item.lojinhaGainPercentage}
                        onChange={(event) => {
                          const items = [...form.items];
                          items[index] = { ...item, lojinhaGainPercentage: event.target.value };
                          setForm({ ...form, items });
                        }}
                        helperText="Opcional. Se ficar 0, a venda não gera ganho para a lojinha nesse item."
                        fullWidth
                      />
                    </Grid>
                  ) : null}
                </Grid>
              ))}
              <Button variant="outlined" onClick={() => setForm({ ...form, items: [...form.items, { productId: '', supplierId: '', quantity: 1, unitPrice: '', lojinhaGainPercentage: '' }] })}>Adicionar item</Button>
              <TextField label="Observações" multiline minRows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              <FormControlLabel
                control={<Checkbox checked={form.createTodoForProducedItems} onChange={(event) => setForm({ ...form, createTodoForProducedItems: event.target.checked })} />}
                label="Gerar automaticamente item(s) em Itens a fazer para reposição do que foi vendido"
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={() => mutation.mutate()} disabled={mutation.isLoading || form.items.some((item) => !item.productId)}>
                  Registrar venda
                </Button>
                <Button variant="outlined" onClick={() => navigate('/vendas', { state: { preserveState: true } })}>Cancelar</Button>
              </Stack>
            </Stack>
          </PageSection>
        </Grid>
      </Grid>
    </Stack>
  );
}