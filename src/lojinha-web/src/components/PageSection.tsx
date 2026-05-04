import { Box, Paper, Stack, Typography } from '@mui/material';

interface PageSectionProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function PageSection({ title, subtitle, action, children }: PageSectionProps) {
  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, overflow: 'hidden' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} mb={3}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontSize: { xs: '1.2rem', md: '1.5rem' }, lineHeight: 1.2 }}>{title}</Typography>
          {subtitle ? <Typography color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography> : null}
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'auto' } }}>{action}</Box>
      </Stack>
      {children}
    </Paper>
  );
}