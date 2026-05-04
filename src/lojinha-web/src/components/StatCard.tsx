import { Box, Paper, Stack, Typography } from '@mui/material';

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  gradient: string;
}

export function StatCard({ label, value, detail, gradient }: StatCardProps) {
  return (
    <Paper
      sx={{
        p: 2.5,
        overflow: 'hidden',
        position: 'relative',
        background: gradient,
        color: '#473328'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          right: -25,
          top: -20,
          width: 120,
          height: 120,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.24)'
        }}
      />
      <Stack spacing={1} position="relative">
        <Typography variant="overline" sx={{ opacity: 0.8 }}>{label}</Typography>
        <Typography variant="h4">{value}</Typography>
        {detail ? <Typography color="text.secondary">{detail}</Typography> : null}
      </Stack>
    </Paper>
  );
}