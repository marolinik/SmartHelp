import React from 'react';
import {
  Snackbar,
  Alert,
  Button,
  Box,
  Typography
} from '@mui/material';
import {
  SystemUpdate as UpdateIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

interface PWAUpdateNotificationProps {
  open: boolean;
  onUpdate: () => void;
  onClose: () => void;
}

const PWAUpdateNotification: React.FC<PWAUpdateNotificationProps> = ({
  open,
  onUpdate,
  onClose
}) => {
  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ mb: 2 }}
    >
      <Alert
        severity="info"
        variant="filled"
        sx={{
          width: '100%',
          maxWidth: 400,
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          '& .MuiAlert-icon': {
            color: 'white'
          }
        }}
        icon={<UpdateIcon />}
        action={
          <Box display="flex" gap={1}>
            <Button
              color="inherit"
              size="small"
              onClick={onUpdate}
              startIcon={<RefreshIcon />}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.5)',
                '&:hover': {
                  borderColor: 'white',
                  background: 'rgba(255,255,255,0.1)'
                }
              }}
              variant="outlined"
            >
              Ажурирај
            </Button>
            <Button
              color="inherit"
              size="small"
              onClick={onClose}
              sx={{
                color: 'white',
                '&:hover': {
                  background: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              Касније
            </Button>
          </Box>
        }
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Нова верзија је доступна
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Кликните "Ажурирај" да бисте добили најновије функције и побољшања.
          </Typography>
        </Box>
      </Alert>
    </Snackbar>
  );
};

export default PWAUpdateNotification; 