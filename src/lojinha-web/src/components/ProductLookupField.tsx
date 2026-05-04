import { Autocomplete, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../services/types';

interface ProductLookupFieldProps {
  label: string;
  value: string;
  products: Product[];
  onChange: (productId: string) => void;
  disabled?: boolean;
  helperText?: string;
}

function getSelectionLabel(product: Product) {
  return product.supplier ? `${product.name} (${product.supplier})` : product.name;
}

export function ProductLookupField({
  label,
  value,
  products,
  onChange,
  disabled = false,
  helperText = 'Digite nome ou SKU para buscar produtos.'
}: ProductLookupFieldProps) {
  const [inputValue, setInputValue] = useState('');

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === value) ?? null,
    [products, value]
  );

  useEffect(() => {
    setInputValue(selectedProduct ? getSelectionLabel(selectedProduct) : '');
  }, [selectedProduct?.id]);

  const options = useMemo(() => {
    const normalized = inputValue.trim().toLowerCase();
    const minimumLength = /^[0-9-]+$/.test(normalized) ? 1 : 2;
    if (normalized.length < minimumLength) {
      return selectedProduct ? [selectedProduct] : [];
    }

    const matches = products.filter((product) => {
      const haystack = [product.name, product.supplier ?? '', product.sku, product.category].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });

    if (selectedProduct && !matches.some((product) => product.id === selectedProduct.id)) {
      return [selectedProduct, ...matches];
    }

    return matches;
  }, [inputValue, products, selectedProduct]);

  return (
    <Autocomplete
      options={options}
      value={selectedProduct}
      inputValue={inputValue}
      onInputChange={(_event, nextValue, reason) => {
        if (reason === 'reset' && selectedProduct) {
          setInputValue(getSelectionLabel(selectedProduct));
          return;
        }

        setInputValue(nextValue);
      }}
      onChange={(_event, product) => {
        onChange(product?.id ?? '');
      }}
      getOptionLabel={(option) => getSelectionLabel(option)}
      isOptionEqualToValue={(option, currentValue) => option.id === currentValue.id}
      noOptionsText={inputValue.trim().length < (/^[0-9-]+$/.test(inputValue.trim()) ? 1 : 2) ? 'Digite nome ou SKU.' : 'Nenhum produto encontrado.'}
      disabled={disabled}
      clearOnBlur={false}
      renderOption={(props, option) => (
        <li {...props}>
          <div>
            <Typography fontWeight={700}>{getSelectionLabel(option)}</Typography>
            <Typography color="text.secondary" fontSize={13}>{option.sku ? `${option.category} • ${option.sku}` : option.category}</Typography>
          </div>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={helperText}
          fullWidth
        />
      )}
    />
  );
}