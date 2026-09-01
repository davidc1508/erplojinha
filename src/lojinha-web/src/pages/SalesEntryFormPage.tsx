import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CurrencyField } from '../components/CurrencyField';
import { ProductLookupField } from '../components/ProductLookupField';
import { useAuth } from '../hooks/useAuth';
import { PageSection } from '../components/PageSection';
import { productsApi, salesApi, suppliersApi } from '../services/api';
import { getTodayDateInputValue, toUtcDateOnlyIso } from '../services/date';
import { formatCurrency, paymentMethodLabel } from '../services/labels';

const PAYMENT_METHODS = ['Pix', 'CreditCard', 'DebitCard', 'Cash', 'Transfer'];

export function SalesEntryFormPage() {
  const { session } = useAuth();
  const isSupplier = session?.role === 'Supplier';
  const isReseller = session?.role === 'Reseller';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ['products-sales-catalog'], queryFn: productsApi.getSalesCatalog });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.getAll, enabled: !isSupplier && !isReseller });
  const sellerOptions = isSupplier
    ? (session?.supplierId ? [{ id: session.supplierId, name: session.fullName ?? 'Meu fornecedor' }] : [])
    : suppliers;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    paymentMethod: 'Pix',
    soldAtUtc: getTodayDateInputValue(),
    notes: '',
    createTodoForProducedItems: false,
    items: [{
      productId: '',
      supplierId: '',
      quantity: 1,
      unitPrice: '',
      lojinhaGainPercentage: '',
      isCommissionedSale: false,
      commissionSellerSupplierId: isSupplier ? (session?.supplierId ?? '') : '',
      commissionAmount: ''
    }]
  });

  const mutation = useMutation({
    mutationFn: async () => salesApi.create({
      paymentMethod: form.paymentMethod,
      soldAtUtc: toUtcDateOnlyIso(form.soldAtUtc),
      notes: form.notes,
      createTodoForProducedItems: isReseller ? false : form.createTodoForProducedItems,
      items: form.items.map((item) => ({
        productId: item.productId,
        supplierId: item.supplierId === '' ? null : item.supplierId,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === '' ? null : Number(item.unitPrice),
          lojinhaGainPercentage: item.lojinhaGainPercentage === '' ? null : Number(item.lojinhaGainPercentage),
          isCommissionedSale: item.isCommissionedSale,
          commissionSellerSupplierId: item.isCommissionedSale
            ? (item.commissionSellerSupplierId === '' ? null : item.commissionSellerSupplierId)
            : null,
          commissionAmount: item.isCommissionedSale
            ? (item.commissionAmount === '' ? null : Number(item.commissionAmount))
            : null
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
      await queryClient.invalidateQueries({ queryKey: ['operational-restock'] });
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

  const validItems = form.items.filter((item) => item.productId);
  const subtotal = validItems.reduce((sum, item) => {
    const unitPrice = item.unitPrice === '' ? 0 : Number(item.unitPrice);
    return sum + unitPrice * (Number(item.quantity) || 0);
  }, 0);
  const commissionTotal = validItems
    .filter((item) => item.isCommissionedSale)
    .reduce((sum, item) => sum + (item.commissionAmount === '' ? 0 : Number(item.commissionAmount)), 0);
  const canSubmit = form.items.some((item) => item.productId)
    && !form.items.some((item) => item.productId && item.isCommissionedSale && (!item.commissionSellerSupplierId || item.commissionAmount === ''));

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant="h3">Nova venda</Typography>
          <Typography color="text.secondary">Adicione produtos, revise o carrinho e registre a venda.</Typography>
        </div>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/vendas', { state: { preserveState: true } })} sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}>
          Voltar para vendas
        </Button>
      </Stack>

      {!isReseller ? (
        <Button
          variant="text"
          size="small"
          startIcon={<TuneRoundedIcon fontSize="small" />}
          onClick={() => setShowAdvanced((value) => !value)}
          sx={{ alignSelf: 'flex-start' }}
        >
          {showAdvanced ? 'Ocultar opções avançadas (comissão / fornecedor)' : 'Mostrar opções avançadas (comissão / fornecedor)'}
        </Button>
      ) : null}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' }, alignItems: 'start' }}>
        <PageSection title="Produtos" subtitle="Selecione os produtos vendidos. Preço e fornecedor já vêm sugeridos do cadastro.">
          <Stack spacing={2}>
            {feedback ? <Alert severity="warning">{feedback}</Alert> : null}
            {form.items.map((item, index) => {
              const itemShowsAdvanced = showAdvanced || item.isCommissionedSale || item.supplierId !== '';

              return (
                <Paper key={`${index}-${item.productId}`} variant="outlined" sx={{ p: 2, borderColor: 'rgba(217,107,135,0.16)' }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: form.items.length > 1 ? 'minmax(0, 1fr) 40px' : 'minmax(0, 1fr)', alignItems: 'start' }}>
                      <ProductLookupField
                        label={`Produto ${index + 1}`}
                        value={item.productId}
                        products={products}
                        onChange={(productId) => {
                          const selectedProduct = products.find((product) => product.id === productId);
                          const defaultSupplierId = selectedProduct?.supplierId ?? '';
                          const items = [...form.items];
                          const resellerCommissionPercentage = selectedProduct
                            ? (selectedProduct.commissionPercentage > 0 ? selectedProduct.commissionPercentage : 20)
                            : 0;
                          const resellerRate = resellerCommissionPercentage / 100;
                          const resellerUnitPrice = selectedProduct
                            ? resellerRate >= 1
                              ? 0
                              : Number((selectedProduct.salePrice / (1 - resellerRate)).toFixed(2))
                            : 0;

                          items[index] = {
                            ...item,
                            productId,
                            supplierId: isReseller ? '' : defaultSupplierId,
                            unitPrice: selectedProduct
                              ? String(isReseller ? resellerUnitPrice : item.isCommissionedSale ? selectedProduct.commissionedSalePrice : selectedProduct.salePrice)
                              : '',
                            lojinhaGainPercentage: defaultSupplierId !== '' ? item.lojinhaGainPercentage : '',
                            commissionAmount: selectedProduct && item.isCommissionedSale
                              ? String(Math.max(0, selectedProduct.commissionedSalePrice - selectedProduct.salePrice))
                              : ''
                          };
                          setForm({ ...form, items });
                        }}
                      />
                      {form.items.length > 1 ? (
                        <IconButton color="error" onClick={() => removeItem(index)} aria-label={`Remover produto ${index + 1}`} sx={{ mt: 0.5 }}>
                          <DeleteOutlineRoundedIcon />
                        </IconButton>
                      ) : null}
                    </Box>

                    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))' } }}>
                      <TextField label="Quantidade" type="number" value={item.quantity} onChange={(event) => {
                        const items = [...form.items];
                        items[index] = { ...item, quantity: Number(event.target.value) };
                        setForm({ ...form, items });
                      }} fullWidth />
                      <CurrencyField label="Preço unitário" value={item.unitPrice === '' ? 0 : Number(item.unitPrice)} onValueChange={(value) => {
                        const items = [...form.items];
                        items[index] = { ...item, unitPrice: String(value) };
                        setForm({ ...form, items });
                      }} fullWidth />
                    </Box>

                    {item.productId ? (
                      <Typography color="text.secondary" fontSize={13}>
                        Subtotal: <strong>{formatCurrency((item.unitPrice === '' ? 0 : Number(item.unitPrice)) * (Number(item.quantity) || 0))}</strong>
                      </Typography>
                    ) : null}

                    {itemShowsAdvanced ? (
                      <Box sx={{ display: 'grid', gap: 1.5, borderTop: '1px dashed rgba(217,107,135,0.3)', pt: 1.5 }}>
                        {!isReseller ? (
                          <FormControlLabel
                            control={<Checkbox checked={item.isCommissionedSale} onChange={(event) => {
                              const selectedProduct = products.find((product) => product.id === item.productId);
                              const nextIsCommissionedSale = event.target.checked;
                              const items = [...form.items];
                              items[index] = {
                                ...item,
                                isCommissionedSale: nextIsCommissionedSale,
                                unitPrice: selectedProduct
                                  ? String(nextIsCommissionedSale ? selectedProduct.commissionedSalePrice : selectedProduct.salePrice)
                                  : item.unitPrice,
                                commissionSellerSupplierId: nextIsCommissionedSale
                                  ? (item.commissionSellerSupplierId || (isSupplier ? (session?.supplierId ?? '') : ''))
                                  : '',
                                commissionAmount: nextIsCommissionedSale && selectedProduct
                                  ? String(Math.max(0, selectedProduct.commissionedSalePrice - selectedProduct.salePrice))
                                  : ''
                              };
                              setForm({ ...form, items });
                            }} />}
                            label="Venda comissionada"
                          />
                        ) : null}
                        {!isSupplier && !isReseller ? (
                          <TextField
                            select
                            label="Produto de fornecedor"
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
                        ) : null}
                        {item.isCommissionedSale ? (
                          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                            <TextField
                              select
                              label="Fornecedor vendedor"
                              value={item.commissionSellerSupplierId}
                              onChange={(event) => {
                                const items = [...form.items];
                                items[index] = { ...item, commissionSellerSupplierId: event.target.value };
                                setForm({ ...form, items });
                              }}
                              helperText="Fornecedor que realizou a venda comissionada."
                              fullWidth
                              disabled={isSupplier}
                            >
                              {!isSupplier ? <MenuItem value="">Selecione</MenuItem> : null}
                              {sellerOptions.map((supplier) => (
                                <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>
                              ))}
                            </TextField>
                            <CurrencyField
                              label="Valor da comissão"
                              value={item.commissionAmount === '' ? 0 : Number(item.commissionAmount)}
                              onValueChange={(value) => {
                                const items = [...form.items];
                                items[index] = { ...item, commissionAmount: String(value) };
                                setForm({ ...form, items });
                              }}
                              helperText="Campo livre. Esse valor será descontado no lançamento do vendedor."
                              fullWidth
                            />
                          </Box>
                        ) : null}
                        {item.supplierId ? (
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
                        ) : null}
                      </Box>
                    ) : null}
                  </Stack>
                </Paper>
              );
            })}
            <Button variant="outlined" onClick={() => setForm({
              ...form,
              items: [...form.items, {
                productId: '',
                supplierId: '',
                quantity: 1,
                unitPrice: '',
                lojinhaGainPercentage: '',
                isCommissionedSale: false,
                commissionSellerSupplierId: isSupplier ? (session?.supplierId ?? '') : '',
                commissionAmount: ''
              }]
            })} sx={{ alignSelf: 'flex-start' }}>Adicionar item</Button>
            <TextField label="Observações" multiline minRows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Stack>
        </PageSection>

        <PageSection title="Resumo da venda" subtitle={`${validItems.length} item(ns) no carrinho`}>
          <Stack spacing={2}>
            <TextField
              label="Data da venda"
              type="date"
              value={form.soldAtUtc}
              onChange={(event) => setForm({ ...form, soldAtUtc: event.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <Box>
              <Typography variant="overline" color="text.secondary">Forma de pagamento</Typography>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', mt: 0.5 }}>
                {PAYMENT_METHODS.map((method) => (
                  <Chip
                    key={method}
                    label={paymentMethodLabel(method)}
                    color={form.paymentMethod === method ? 'primary' : 'default'}
                    variant={form.paymentMethod === method ? 'filled' : 'outlined'}
                    onClick={() => setForm({ ...form, paymentMethod: method })}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Box>
            </Box>
            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">Subtotal</Typography>
                <Typography>{formatCurrency(subtotal)}</Typography>
              </Stack>
              {commissionTotal > 0 ? (
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Comissão ({validItems.filter((item) => item.isCommissionedSale).length} item(ns))</Typography>
                  <Typography color="error.main">&minus;{formatCurrency(commissionTotal)}</Typography>
                </Stack>
              ) : null}
              <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, mt: 0.5, borderTop: '1px dashed rgba(217,107,135,0.3)' }}>
                <Typography variant="h6">Total</Typography>
                <Typography variant="h6">{formatCurrency(subtotal)}</Typography>
              </Stack>
            </Stack>
            {!isReseller ? (
              <FormControlLabel
                control={<Checkbox checked={form.createTodoForProducedItems} onChange={(event) => setForm({ ...form, createTodoForProducedItems: event.target.checked })} />}
                label="Gerar automaticamente item(s) em Reposição de produtos do que foi vendido"
              />
            ) : null}
            <Button
              variant="contained"
              size="large"
              startIcon={<SaveRoundedIcon />}
              onClick={() => mutation.mutate()}
              disabled={mutation.isLoading || !canSubmit}
              fullWidth
            >
              Registrar venda
            </Button>
          </Stack>
        </PageSection>
      </Box>
    </Stack>
  );
}
