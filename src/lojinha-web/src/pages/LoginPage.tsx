import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { FormEvent, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
    } catch (requestError) {
      setError('Falha no login. Confira as credenciais e se a API está ativa.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 1.5, md: 3 }
      }}
    >
      <Paper sx={{ maxWidth: 1080, width: '100%', p: { xs: 2, md: 5 }, borderRadius: { xs: 3, md: 6 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr 0.85fr' }, gap: { xs: 2.5, md: 4 }, alignItems: 'center' }}>
          <Box>
            <Typography variant="h3" mb={1} sx={{ fontSize: { xs: '2rem', md: '3rem' }, lineHeight: 1.05 }}>Gestão delicada, operação firme.</Typography>
            <Typography color="text.secondary" mb={3} sx={{ fontSize: { xs: '0.95rem', md: '1rem' } }}>
              Estoque, insumos, vendas e financeiro em um painel pensado para a rotina da loja e para a precificação baseada nas planilhas reais.
            </Typography>
            <Box
              component="img"
              src="/brand.png"
              alt="Lojinha Sem Nome"
              sx={{ width: '100%', maxWidth: 520, maxHeight: { xs: 240, md: 'none' }, objectFit: 'cover', borderRadius: 6, boxShadow: '0 24px 70px rgba(217,107,135,0.18)' }}
            />
          </Box>
          <Paper sx={{ p: 3.5, background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,245,241,0.94))' }}>
            <Typography variant="h4" mb={1}>Entrar</Typography>
            <Typography color="text.secondary" mb={3}>Acesso administrativo da operação.</Typography>
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <TextField label="Email" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth />
              <TextField label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} fullWidth />
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? 'Entrando...' : 'Acessar dashboard'}
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
}