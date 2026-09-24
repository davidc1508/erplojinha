import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { paintingPricingApi } from '../services/api';
import {
  PaintingAddOnsTab,
  PaintingComplexitiesTab,
  PaintingLevelsTab,
  PaintingMaterialsTab,
  PaintingPreparationServicesTab,
  PaintingSizeRangesTab
} from './paintingPricing/PaintingCatalogTabs';
import { PaintingSettingsTab } from './paintingPricing/PaintingSettingsTab';
import { PaintingSimulatorTab } from './paintingPricing/PaintingSimulatorTab';
import { formatCurrency, formatPercent, paintingPricingQueryKey } from './paintingPricing/paintingPricingShared';

const tabs = [
  { value: 'configuracoes', label: 'Configurações gerais' },
  { value: 'niveis', label: 'Níveis de pintura' },
  { value: 'faixas', label: 'Faixas de tamanho' },
  { value: 'complexidades', label: 'Complexidades' },
  { value: 'preparacao', label: 'Serviços de preparação' },
  { value: 'materiais', label: 'Materiais e consumíveis' },
  { value: 'adicionais', label: 'Adicionais' },
  { value: 'simulador', label: 'Simulador' }
] as const;

type TabValue = typeof tabs[number]['value'];

export function PaintingPricingPage() {
  const { session } = useAuth();
  const canEdit = session?.role === 'Admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('aba');
  const activeTab: TabValue = tabs.some((tab) => tab.value === requestedTab) ? requestedTab as TabValue : 'configuracoes';
  const { data: overview, isLoading, isError } = useQuery({ queryKey: paintingPricingQueryKey, queryFn: paintingPricingApi.getOverview });

  function selectTab(value: TabValue) {
    setSearchParams(value === 'configuracoes' ? {} : { aba: value }, { replace: true });
  }

  const summary = overview ? [
    { label: 'Valor-hora padrão', value: formatCurrency(overview.settings.defaultHourlyRate) },
    { label: 'Materiais', value: formatPercent(overview.settings.defaultMaterialsPercentage) },
    { label: 'Pintura mínima', value: formatCurrency(overview.settings.minimumPaintingPrice) },
    { label: 'Níveis ativos', value: String(overview.levels.filter((level) => level.isActive).length) }
  ] : [];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }} spacing={1.5}>
        <div>
          <Typography variant="h4">Precificação de pintura</Typography>
          <Typography color="text.secondary">Parâmetros, tabelas e regras para estimar o custo e o preço de pintura manual de peças em resina.</Typography>
        </div>
        <Button variant="contained" size="large" startIcon={<BrushRoundedIcon />} onClick={() => selectTab('simulador')} sx={{ flexShrink: 0 }}>
          Simular pintura
        </Button>
      </Stack>

      {isError ? <Alert severity="warning">Não foi possível carregar a precificação de pintura.</Alert> : null}
      {isLoading ? <Typography color="text.secondary">Carregando...</Typography> : null}

      {overview ? (
        <>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
            {summary.map((item) => (
              <Paper key={item.label} sx={{ p: 2 }}>
                <Typography color="text.secondary">{item.label}</Typography>
                <Typography variant="h5">{item.value}</Typography>
              </Paper>
            ))}
          </Box>

          <Paper sx={{ px: { xs: 0.5, md: 1 } }}>
            <Tabs value={activeTab} onChange={(_, value: TabValue) => selectTab(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
              {tabs.map((tab) => <Tab key={tab.value} value={tab.value} label={tab.label} sx={{ textTransform: 'none', fontWeight: 700 }} />)}
            </Tabs>
          </Paper>

          {activeTab === 'configuracoes' ? <PaintingSettingsTab settings={overview.settings} canEdit={canEdit} /> : null}
          {activeTab === 'niveis' ? <PaintingLevelsTab canEdit={canEdit} levels={overview.levels} settings={overview.settings} /> : null}
          {activeTab === 'faixas' ? <PaintingSizeRangesTab canEdit={canEdit} sizeRanges={overview.sizeRanges} levels={overview.levels} /> : null}
          {activeTab === 'complexidades' ? <PaintingComplexitiesTab canEdit={canEdit} complexities={overview.complexities} /> : null}
          {activeTab === 'preparacao' ? <PaintingPreparationServicesTab canEdit={canEdit} services={overview.preparationServices} /> : null}
          {activeTab === 'materiais' ? <PaintingMaterialsTab canEdit={canEdit} materials={overview.materials} /> : null}
          {activeTab === 'adicionais' ? <PaintingAddOnsTab canEdit={canEdit} addOns={overview.addOns} /> : null}
          {activeTab === 'simulador' ? <PaintingSimulatorTab overview={overview} /> : null}
        </>
      ) : null}
    </Stack>
  );
}
