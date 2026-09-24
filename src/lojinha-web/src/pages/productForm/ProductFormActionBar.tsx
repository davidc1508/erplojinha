import { Box, Button, Collapse, IconButton, Stack, Typography, useMediaQuery, useTheme, ButtonBase } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useState } from 'react';
import { PaintedBadge } from './ProductPaintingSection';

interface ProductFormActionBarProps {
  title: string;
  dirty: boolean;
  unitCost: string;
  salePrice: string;
  unitProfit: string;
  margin: string;
  profitPositive: boolean;
  saveLabel: string;
  mobileSaveLabel: string;
  isSaving: boolean;
  saveDisabled: boolean;
  saveTitle?: string;
  paintedDetail?: string | null;
  showPainted: boolean;
  onBack: () => void;
  onSave: () => void;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ px: 2, borderLeft: '1px solid rgba(71,51,40,0.12)', minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700} noWrap component="div">{label}</Typography>
      <Typography fontWeight={800} noWrap sx={{ color }}>{value}</Typography>
    </Box>
  );
}

export function ProductFormActionBar({
  title,
  dirty,
  unitCost,
  salePrice,
  unitProfit,
  margin,
  profitPositive,
  saveLabel,
  mobileSaveLabel,
  isSaving,
  saveDisabled,
  saveTitle,
  paintedDetail,
  showPainted,
  onBack,
  onSave
}: ProductFormActionBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const profitColor = profitPositive ? '#3f6a2c' : theme.palette.error.main;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: { xs: 56, sm: 64 },
        zIndex: theme.zIndex.appBar - 1,
        mx: { xs: -1.5, md: -4 },
        mt: { xs: -1.5, md: -4 },
        px: { xs: 1, md: 4 },
        bgcolor: 'rgba(255,252,249,0.96)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(217,107,135,0.18)',
        boxShadow: '0 10px 30px rgba(217,107,135,0.12)'
      }}
    >
      {isMobile ? (
        <>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minHeight: 64 }}>
            <IconButton onClick={onBack} aria-label="Cancelar e voltar para listagem" sx={{ color: 'primary.dark' }}><ArrowBackRoundedIcon /></IconButton>
            <ButtonBase onClick={() => setSummaryOpen((current) => !current)} aria-expanded={summaryOpen} sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', borderRadius: 2, px: 0.5, py: 0.5 }}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                  <Typography variant="h6" noWrap sx={{ fontSize: '1.1rem', lineHeight: 1.15 }}>{title}</Typography>
                  {showPainted ? <PaintedBadge size="small" /> : null}
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {dirty ? <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} /> : null}
                  <Typography variant="caption" color="primary.dark" fontWeight={800} noWrap>{salePrice}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>· lucro {margin}</Typography>
                  <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', transform: summaryOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </Stack>
              </Box>
            </ButtonBase>
            <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={onSave} disabled={saveDisabled || isSaving} title={saveTitle} sx={{ flexShrink: 0 }}>
              {isSaving ? 'Salvando...' : mobileSaveLabel}
            </Button>
          </Stack>
          <Collapse in={summaryOpen}>
            <Box sx={{ display: 'grid', gap: 0.5, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', pb: 1.5, px: 0.5 }}>
              {[
                { label: 'Custo/un', value: unitCost },
                { label: 'Preço', value: salePrice, color: theme.palette.primary.dark },
                { label: 'Lucro/un', value: unitProfit, color: profitColor },
                { label: 'Margem', value: margin }
              ].map((item) => (
                <Box key={item.label} sx={{ bgcolor: 'rgba(251,243,239,0.9)', borderRadius: 2, p: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} noWrap component="div">{item.label}</Typography>
                  <Typography variant="body2" fontWeight={800} noWrap sx={{ color: item.color }}>{item.value}</Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </>
      ) : (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ minHeight: 80 }}>
          <IconButton onClick={onBack} aria-label="Voltar para listagem" sx={{ border: '1px solid rgba(217,107,135,0.35)', color: 'primary.dark' }}><ArrowBackRoundedIcon /></IconButton>
          <Box sx={{ minWidth: 0, flexShrink: 1 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Typography variant="h5" noWrap sx={{ fontSize: '1.5rem', lineHeight: 1.15 }}>{title}</Typography>
              {showPainted ? <PaintedBadge /> : null}
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {dirty ? <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} /> : null}
              <Typography variant="caption" fontWeight={700} color={dirty ? 'warning.dark' : 'text.secondary'} noWrap>{dirty ? 'Alterações não salvas' : 'Sem alterações'}</Typography>
              {showPainted && paintedDetail ? <Typography variant="caption" color="text.secondary" noWrap>· {paintedDetail}</Typography> : null}
            </Stack>
          </Box>
          <Stack direction="row" sx={{ flex: 1, justifyContent: 'center', minWidth: 0 }}>
            <Stat label="Custo / un" value={unitCost} />
            <Stat label="Preço final" value={salePrice} color={theme.palette.primary.dark} />
            <Stat label="Lucro / un" value={unitProfit} color={profitColor} />
            <Stat label="Margem" value={margin} />
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
            <Button variant="outlined" onClick={onBack}>Cancelar</Button>
            <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={onSave} disabled={saveDisabled || isSaving} title={saveTitle}>
              {isSaving ? 'Salvando...' : saveLabel}
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
