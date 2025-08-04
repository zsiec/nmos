import React from 'react';
import { Box, Chip, Typography, CircularProgress } from '@mui/material';
import { CheckCircle, Error, Warning } from '@mui/icons-material';
import { useRouter } from '../../hooks/useRouter';

export const ConnectionStatus: React.FC = () => {
  const { connected, connecting, error, status } = useRouter();

  if (connecting) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={20} />
        <Typography variant="body2">Connecting...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Chip
        icon={<Error />}
        label={error}
        color="error"
        size="small"
      />
    );
  }

  if (!connected) {
    return (
      <Chip
        icon={<Warning />}
        label="Disconnected"
        color="warning"
        size="small"
      />
    );
  }

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Chip
        icon={<CheckCircle />}
        label="Connected"
        color="success"
        size="small"
      />
      {status && (
        <>
          <Typography variant="caption" color="text.secondary">
            {status.connectionType.toUpperCase()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {status.crosspointCount} crosspoints
          </Typography>
        </>
      )}
    </Box>
  );
};