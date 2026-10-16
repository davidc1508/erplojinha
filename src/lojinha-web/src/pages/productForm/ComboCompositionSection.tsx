import { Alert, Box, Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { ProductLookupField } from '../../components/ProductLookupField';
import { PageSection } from '../../components/PageSection';
import { CurrencyField } from '../../components/CurrencyField';
import { formatCurrency, formatNumber } from '../paintingPricing/paintingPricingShared';
import type { Product } from '../../services/types';

export interface ComboSelection { productId: string; quantity: number }

interface Props {
  items: ComboSelection[];
  products: Product[];
  onChange: (items: ComboSelection[]) => void;
  salePrice: number;
  onPriceChange: (price: string) => void;
  commissionPercentage: number;
  commissionedSalePrice: number;
  onCommissionChange: (value: number) => void;
  cost: number;
  combinedPrice: number;
  availableStock: number;
  loading: boolean;
  error: boolean;
}

export function ComboCompositionSection({ items, products, onChange, salePrice, onPriceChange, cost, combinedPrice, availableStock, loading, error, commissionPercentage, commissionedSalePrice, onCommissionChange }: Props) {
  const profit = salePrice - cost;
  const margin = salePrice > 0 ? profit / salePrice * 100 : 0;
  const parts = items.flatMap((item, index) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ name: product.name, quantity: item.quantity, cost: product.costPrice * item.quantity,
      color: ['#a54b62', '#d96b87', '#e1a657', '#4c9f93', '#8fd3c6', '#c9b3a6', '#b98f7a'][index % 7] }] : [];
  });
  const suggestedWithCommission = commissionPercentage > 0 && commissionPercentage < 100
    ? combinedPrice / (1 - commissionPercentage / 100) : commissionPercentage >= 100 ? 0 : combinedPrice;
  return (
    <>
      <PageSection title="2 · Composição do combo" subtitle="Selecione pelo menos dois produtos diferentes e a quantidade de cada um.">
        <Stack spacing={2}>
          {loading ? <Typography color="text.secondary">Carregando produtos...</Typography> : null}
          {error ? <Alert severity="error">Não foi possível carregar os produtos. Tente novamente.</Alert> : null}
          {items.map((item, index) => {
            const product = products.find((candidate) => candidate.id === item.productId);
            return (
              <Paper key={index} variant="outlined" sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.6)' }}>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'grid', gap: 2, alignItems: 'start', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 120px 40px' } }}>
                    <ProductLookupField label={`Produto ${index + 1}`} value={item.productId}
                      products={products.filter((candidate) => candidate.id === item.productId || !items.some((selected) => selected.productId === candidate.id))}
                      onChange={(productId) => onChange(items.map((current, position) => position === index ? { ...current, productId } : current))} />
                    <TextField label="Quantidade" type="number" value={item.quantity} inputProps={{ min: 1, step: 1 }}
                      onChange={(event) => onChange(items.map((current, position) => position === index ? { ...current, quantity: Number(event.target.value) } : current))} />
                    <IconButton aria-label={`Remover produto ${index + 1}`} onClick={() => onChange(items.filter((_, position) => position !== index))}><DeleteOutlineRoundedIcon /></IconButton>
                  </Box>
                  {product ? <Typography color="text.secondary" fontSize={13}>
                    Custo: {formatCurrency(product.costPrice * item.quantity)} • Preço dos itens: {formatCurrency(product.salePrice * item.quantity)} • Estoque do produto: {product.currentStock}
                  </Typography> : null}
                </Stack>
              </Paper>
            );
          })}
          <Button startIcon={<AddRoundedIcon />} variant="outlined" onClick={() => onChange([...items, { productId: '', quantity: 1 }])} sx={{ alignSelf: 'flex-start' }}>Adicionar produto</Button>
          <Alert severity="info">Estoque disponível: {availableStock} combo(s). A venda movimenta cada produto da composição. Ao gerar reposição, os produtos serão incluídos na lista.</Alert>
        </Stack>
      </PageSection>
      <PageSection title="3 · Preço e lucro do combo" subtitle="O preço começa com a soma dos itens e pode ser ajustado livremente.">
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
            <CurrencyField label="Custo total do combo" value={cost} onValueChange={() => undefined} InputProps={{ readOnly: true }} fullWidth />
            <CurrencyField label="Preço final de venda" value={salePrice} onValueChange={(value) => onPriceChange(String(value))} helperText={`Soma dos itens: ${formatCurrency(combinedPrice)}`} fullWidth />
            <CurrencyField label="Lucro total do combo" value={profit} onValueChange={() => undefined} InputProps={{ readOnly: true }} fullWidth
              sx={{ '& .MuiInputBase-root': { bgcolor: profit >= 0 ? '#eaf4e3' : 'rgba(211,47,47,0.08)', fontWeight: 700, color: profit >= 0 ? '#3f6a2c' : 'error.main' } }} />
            <TextField label="Comissão (%)" type="number" value={commissionPercentage} onChange={(event) => onCommissionChange(Number(event.target.value))} inputProps={{ min: 0, max: 100 }} fullWidth />
            <CurrencyField label="Preço p/ venda comissionada" value={commissionedSalePrice} onValueChange={() => undefined} helperText="A partir do preço final + comissão." fullWidth disabled sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(71,51,40,0.06)' } }} />
            <TextField label="Margem de lucro" value={salePrice > 0 ? `${formatNumber(margin, 1)}%` : '—'} helperText="Lucro dividido pelo preço final." InputProps={{ readOnly: true }} fullWidth />
            <TextField label="Markup" value={cost > 0 ? `${formatNumber(salePrice / cost, 2)}×` : '—'} helperText="Preço final dividido pelo custo." InputProps={{ readOnly: true }} fullWidth />
          </Box>
          <Button variant="outlined" onClick={() => onPriceChange('')} sx={{ alignSelf: 'flex-start' }}>Usar soma dos itens</Button>
        </Stack>
      </PageSection>
      <PageSection title="4 · Resumo de custo" subtitle="Calculado com os produtos e quantidades atuais — por combo.">
        <Stack spacing={2.5}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' } }}>
            {[
              { label: 'Custo calculado', value: cost, note: 'por combo' },
              { label: 'Preço sugerido', value: combinedPrice, note: 'soma dos preços dos itens' },
              { label: 'Sugerido + comissão', value: suggestedWithCommission, note: 'para venda comissionada' }
            ].map((item) => <Paper key={item.label} variant="outlined" sx={{ p: 2, borderRadius: 4 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={700}>{item.label}</Typography>
              <Typography variant="h5">{formatCurrency(item.value)}</Typography>
              <Typography variant="caption" color="text.secondary">{item.note}</Typography>
            </Paper>)}
          </Box>
          <div>
            <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ mb: 1 }}>Composição do custo</Typography>
            {cost > 0 ? <Box sx={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', gap: '2px', bgcolor: 'rgba(125,101,88,0.08)' }}>
              {parts.filter((part) => part.cost > 0).map((part, index) => <Box key={index} sx={{ flex: `${part.cost / cost} 0 0`, bgcolor: part.color }} />)}
            </Box> : null}
            <Box sx={{ display: 'grid', gap: 1.5, mt: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(180px, 1fr))' } }}>
              {parts.map((part, index) => <Stack key={index} direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ width: 10, height: 10, borderRadius: 0.75, bgcolor: part.color, mt: 0.6, flexShrink: 0 }} />
                <div>
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{part.name} · {part.quantity} un</Typography>
                  <Typography fontWeight={700}>{formatCurrency(part.cost)}</Typography>
                  <Typography variant="caption" color="text.secondary">{cost > 0 ? `${formatNumber(part.cost / cost * 100, 1)}%` : '—'}</Typography>
                </div>
              </Stack>)}
            </Box>
          </div>
        </Stack>
      </PageSection>
    </>
  );
}