import { Alert, Box, Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { ProductLookupField } from '../../components/ProductLookupField';
import { PageSection } from '../../components/PageSection';
import { CurrencyField } from '../../components/CurrencyField';
import { formatCurrency } from '../../services/labels';
import type { Product } from '../../services/types';

export interface ComboSelection { productId: string; quantity: number }

interface Props {
  items: ComboSelection[];
  products: Product[];
  onChange: (items: ComboSelection[]) => void;
  salePrice: number;
  onPriceChange: (price: string) => void;
  cost: number;
  combinedPrice: number;
  availableStock: number;
  loading: boolean;
  error: boolean;
}

export function ComboCompositionSection({ items, products, onChange, salePrice, onPriceChange, cost, combinedPrice, availableStock, loading, error }: Props) {
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
            <CurrencyField label="Lucro total do combo" value={salePrice - cost} onValueChange={() => undefined} InputProps={{ readOnly: true }} fullWidth />
          </Box>
          <Button variant="outlined" onClick={() => onPriceChange('')} sx={{ alignSelf: 'flex-start' }}>Usar soma dos itens</Button>
        </Stack>
      </PageSection>
    </>
  );
}