import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import ShoppingCartRoundedIcon from '@mui/icons-material/ShoppingCartRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import WarehouseRoundedIcon from '@mui/icons-material/WarehouseRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import SettingsSuggestRoundedIcon from '@mui/icons-material/SettingsSuggestRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 280;
const collapsedDrawerWidth = 88;

const navigation = [
  { label: 'Dashboard', path: '/', icon: <DashboardRoundedIcon /> },
  { label: 'Produtos', path: '/produtos', icon: <CategoryRoundedIcon /> },
  { label: 'Orçamentos', path: '/orcamentos', icon: <RequestQuoteRoundedIcon /> },
  { label: 'Categorias', path: '/categorias', icon: <CategoryRoundedIcon /> },
  { label: 'Impressoras', path: '/impressoras', icon: <PrintRoundedIcon /> },
  { label: 'Insumos', path: '/insumos', icon: <WarehouseRoundedIcon /> },
  { label: 'Estoque', path: '/estoque', icon: <Inventory2RoundedIcon /> },
  { label: 'Vendas', path: '/vendas', icon: <ShoppingCartRoundedIcon /> },
  { label: 'Feiras', path: '/feiras', icon: <StorefrontRoundedIcon /> },
  { label: 'Financeiro', path: '/financeiro', icon: <AccountBalanceWalletRoundedIcon /> },
  { label: 'Listas', path: '/listas-operacionais', icon: <ChecklistRoundedIcon /> },
  { label: 'Projetos', path: '/projetos', icon: <TaskAltRoundedIcon /> },
  { label: 'Personalizados', path: '/personalizados', icon: <AutoFixHighRoundedIcon /> },
  { label: 'Taxas', path: '/configuracoes/taxas', icon: <SettingsSuggestRoundedIcon /> },
  { label: 'Fornecedores', path: '/fornecedores', icon: <HandshakeRoundedIcon /> },
  { label: 'Usuários', path: '/usuarios', icon: <PeopleAltRoundedIcon /> }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isImpersonating, logout, session, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile, location.pathname]);

  const currentDrawerWidth = useMemo(() => (isMobile ? drawerWidth : collapsed ? collapsedDrawerWidth : drawerWidth), [collapsed, isMobile]);
  const visibleNavigation = useMemo(() => {
    if (session?.role === 'Supplier') {
      return navigation.filter((item) => ['/', '/produtos', '/orcamentos', '/categorias', '/impressoras', '/insumos', '/estoque', '/vendas', '/feiras', '/financeiro', '/listas-operacionais', '/projetos', '/personalizados'].includes(item.path));
    }

    return navigation;
  }, [session?.role]);

  const drawerContent = (
    <>
      <Toolbar sx={{ pt: 3, pb: 2, px: collapsed && !isMobile ? 1.5 : 3, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={collapsed && !isMobile ? 0 : 2} alignItems="center">
          <Avatar src="/brand.png" sx={{ width: 58, height: 58, border: '2px solid rgba(217,107,135,0.28)' }} />
          {(!collapsed || isMobile) ? (
            <Box>
              <Typography variant="h6">Lojinha Sem Nome</Typography>
              <Typography color="text.secondary" fontSize={13}>ERP artesanal</Typography>
            </Box>
          ) : null}
        </Stack>
        {!isMobile ? (
          <IconButton onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <ChevronRightRoundedIcon /> : <ChevronLeftRoundedIcon />}
          </IconButton>
        ) : null}
      </Toolbar>
      <Box sx={{ px: collapsed && !isMobile ? 1 : 2 }}>
        {(!collapsed || isMobile) ? <Chip label="Loja física + produção 3D" color="secondary" sx={{ fontWeight: 700, mb: 2 }} /> : null}
        <List>
          {visibleNavigation.map((item) => (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              onClick={() => isMobile && setMobileOpen(false)}
              selected={item.path === '/' ? location.pathname === item.path : location.pathname.startsWith(item.path)}
              sx={{
                mb: 1,
                borderRadius: 99,
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                px: collapsed && !isMobile ? 1.5 : 2,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(217,107,135,0.12)',
                  color: 'primary.main'
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed && !isMobile ? 'auto' : 40, color: 'inherit' }}>{item.icon}</ListItemIcon>
              {(!collapsed || isMobile) ? <ListItemText primary={item.label} /> : null}
            </ListItemButton>
          ))}
        </List>
      </Box>
      <Box sx={{ mt: 'auto', p: collapsed && !isMobile ? 1.5 : 3 }}>
        <Paper sx={{ p: collapsed && !isMobile ? 1.5 : 2.5, background: 'linear-gradient(135deg, rgba(123,207,192,0.22), rgba(245,178,197,0.18))' }}>
          {(!collapsed || isMobile) ? (
            <>
              <Typography variant="subtitle2">{session?.fullName}</Typography>
              <Typography color="text.secondary" fontSize={13}>{session?.email}</Typography>
            </>
          ) : null}
          <Button
            sx={{ mt: !collapsed || isMobile ? 2 : 0 }}
            variant="outlined"
            color="primary"
            fullWidth
            startIcon={!collapsed || isMobile ? <LockRoundedIcon /> : null}
            onClick={() => navigate('/minha-conta/senha')}
          >
            {collapsed && !isMobile ? <LockRoundedIcon fontSize="small" /> : 'Alterar senha'}
          </Button>
          <Button sx={{ mt: 1 }} variant="contained" color="primary" fullWidth onClick={logout}>
            {collapsed && !isMobile ? 'Sair' : 'Sair'}
          </Button>
        </Paper>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { md: `${currentDrawerWidth}px` },
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(217, 107, 135, 0.12)'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={() => isMobile ? setMobileOpen(true) : setCollapsed((value) => !value)}>
              <MenuRoundedIcon />
            </IconButton>
            <Typography variant="h6">Lojinha</Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {!isMobile ? <Typography color="text.secondary" fontSize={14}>{session?.fullName}</Typography> : null}
            {isImpersonating ? (
              <Button variant="outlined" color="warning" onClick={stopImpersonation}>
                Encerrar acesso simulado
              </Button>
            ) : null}
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: currentDrawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: currentDrawerWidth,
            overflowX: 'hidden',
            borderRight: '1px solid rgba(217, 107, 135, 0.12)',
            background: 'linear-gradient(180deg, rgba(255,247,244,0.95), rgba(255,252,249,0.9))',
            boxSizing: 'border-box'
          }
        }}
      >
        {drawerContent}
      </Drawer>
      <Box sx={{ flex: 1, minWidth: 0, p: { xs: 1.5, md: 4 } }}>
        <Toolbar />
        {isImpersonating ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Acesso simulado ativo como {session?.fullName}. Todas as ações serão executadas no perfil emulado.
          </Alert>
        ) : null}
        {children}
      </Box>
    </Box>
  );
}