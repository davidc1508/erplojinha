import { Autocomplete, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

export interface SearchSelectOption {
  id: string;
  name: string;
  secondaryText?: string;
}

interface SearchSelectFieldProps {
  label: string;
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  helperText?: string;
  placeholder?: string;
  minQueryLength?: number;
  disableClearable?: boolean;
  emptyText?: string;
}

export function SearchSelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  helperText = 'Digite para buscar.',
  placeholder,
  minQueryLength = 2,
  disableClearable = false,
  emptyText = 'Nenhuma opção encontrada.'
}: SearchSelectFieldProps) {
  const [inputValue, setInputValue] = useState('');

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    setInputValue(selectedOption?.name ?? '');
  }, [selectedOption?.id]);

  const visibleOptions = useMemo(() => {
    const normalized = inputValue.trim().toLowerCase();
    if (normalized.length < minQueryLength) {
      return selectedOption ? [selectedOption] : [];
    }

    const matches = options.filter((option) => [option.name, option.secondaryText ?? ''].join(' ').toLowerCase().includes(normalized));

    if (selectedOption && !matches.some((option) => option.id === selectedOption.id)) {
      return [selectedOption, ...matches];
    }

    return matches;
  }, [inputValue, minQueryLength, options, selectedOption]);

  return (
    <Autocomplete
      options={visibleOptions}
      value={selectedOption}
      inputValue={inputValue}
      disabled={disabled}
      disableClearable={disableClearable}
      clearOnBlur={false}
      onInputChange={(_event, nextValue, reason) => {
        if (reason === 'reset' && selectedOption) {
          setInputValue(selectedOption.name);
          return;
        }

        setInputValue(nextValue);
      }}
      onChange={(_event, nextValue) => onChange(nextValue?.id ?? '')}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, currentValue) => option.id === currentValue.id}
      noOptionsText={inputValue.trim().length < minQueryLength ? `Digite ao menos ${minQueryLength} caracteres.` : emptyText}
      renderOption={(props, option) => (
        <li {...props}>
          <div>
            <Typography fontWeight={700}>{option.name}</Typography>
            {option.secondaryText ? <Typography color="text.secondary" fontSize={13}>{option.secondaryText}</Typography> : null}
          </div>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          helperText={helperText}
          fullWidth
        />
      )}
    />
  );
}