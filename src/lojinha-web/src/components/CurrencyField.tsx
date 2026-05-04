import { InputAdornment, TextField, type TextFieldProps } from '@mui/material';
import { formatCurrencyInput, parseCurrencyInput } from '../services/labels';

interface CurrencyFieldProps extends Omit<TextFieldProps, 'value' | 'onChange'> {
  value: number | string;
  onValueChange: (value: number) => void;
}

export function CurrencyField({ value, onValueChange, InputProps, inputProps, helperText, ...props }: CurrencyFieldProps) {
  return (
    <TextField
      {...props}
      value={formatCurrencyInput(value)}
      onChange={(event) => onValueChange(parseCurrencyInput(event.target.value))}
      inputMode="decimal"
      InputProps={{
        startAdornment: <InputAdornment position="start">R$</InputAdornment>,
        ...InputProps
      }}
      inputProps={{
        ...inputProps,
        autoComplete: 'off'
      }}
      helperText={helperText}
    />
  );
}