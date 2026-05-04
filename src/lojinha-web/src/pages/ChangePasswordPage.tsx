import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  TextField,
  Typography
} from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useState } from 'react';
import { authApi } from '../services/api';

const PASSWORD_RULES = [
  { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Número', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Caractere especial', test: (p: string) => /[^A-Za-z0-9]/.test(p) }
];

function passwordStrength(password: string): number {
  return PASSWORD_RULES.filter((r) => r.test(password)).length;
}

function strengthColor(score: number): 'error' | 'warning' | 'success' {
  if (score <= 2) return 'error';
  if (score <= 4) return 'warning';
  return 'success';
}

function strengthLabel(score: number): string {
  if (score <= 2) return 'Fraca';
  if (score <= 4) return 'Média';
  return 'Forte';
}

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const score = passwordStrength(newPassword);
  const allRulesMet = score === PASSWORD_RULES.length;
  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && allRulesMet && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Erro ao alterar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth={480} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3} display="flex" alignItems="center" gap={1}>
        <LockRoundedIcon color="primary" />
        Alterar senha
      </Typography>

      <Paper sx={{ p: 4 }}>
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(false)}>
            Senha alterada com sucesso!
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={3}>
          <TextField
            label="Senha atual"
            type={showCurrent ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowCurrent((v) => !v)} edge="end">
                    {showCurrent ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <Box>
            <TextField
              label="Nova senha"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowNew((v) => !v)} edge="end">
                      {showNew ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            {newPassword.length > 0 && (
              <Box mt={1.5}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption" color="text.secondary">Força da senha</Typography>
                  <Typography variant="caption" color={`${strengthColor(score)}.main`} fontWeight={600}>
                    {strengthLabel(score)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(score / PASSWORD_RULES.length) * 100}
                  color={strengthColor(score)}
                  sx={{ borderRadius: 4, height: 6 }}
                />
                <Box mt={1.5} display="flex" flexDirection="column" gap={0.5}>
                  {PASSWORD_RULES.map((rule) => (
                    <Typography
                      key={rule.label}
                      variant="caption"
                      color={rule.test(newPassword) ? 'success.main' : 'text.disabled'}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {rule.test(newPassword) ? '✓' : '○'} {rule.label}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          <TextField
            label="Confirmar nova senha"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            required
            error={confirmPassword.length > 0 && !passwordsMatch}
            helperText={confirmPassword.length > 0 && !passwordsMatch ? 'As senhas não coincidem' : ''}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirm((v) => !v)} edge="end">
                    {showConfirm ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={!canSubmit}
            size="large"
            fullWidth
          >
            {loading ? 'Alterando...' : 'Alterar senha'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
