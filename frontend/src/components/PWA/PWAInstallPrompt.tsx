import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Close as CloseIcon,
  GetApp as InstallIcon,
  CloudOff as OfflineIcon,
  Notifications as NotificationsIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface PWAInstallPromptProps {
  open: boolean;
  onClose: () => void;
  onInstall: () => Promise<boolean>;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  open,
  onClose,
  onInstall
}) => {
  const { t } = useTranslation();

  const handleInstall = async () => {
    const success = await onInstall();
    if (success) {
      onClose();
    }
  };

  const features = [
    {
      icon: <OfflineIcon color="primary" />,
      title: 'Offline приступ',
      description: 'Користите апликацију и без интернет везе'
    },
    {
      icon: <NotificationsIcon color="primary" />,
      title: 'Push обавештења',
      description: 'Примајте важна обавештења директно на уређај'
    },
    {
      icon: <SpeedIcon color="primary" />,
      title: 'Брже учитавање',
      description: 'Апликација се учитава брже од веб странице'
    },
    {
      icon: <SecurityIcon color="primary" />,
      title: 'Безбедност',
      description: 'Сигурна веза и заштићени подаци'
    }
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <InstallIcon sx={{ fontSize: 28 }} />
            <Typography variant="h6" component="div">
              Инсталирај PIO Help Desk
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ color: 'white' }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body1" sx={{ mb: 3, opacity: 0.9 }}>
          Инсталирајте PIO Help Desk апликацију за бољи корисничи доживљај и приступ свим функцијама.
        </Typography>

        <List dense>
          {features.map((feature, index) => (
            <ListItem key={index} sx={{ px: 0 }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                {feature.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                }
                secondary={
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    {feature.description}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>

        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            💡 <strong>Савет:</strong> Апликација ће бити додата на почетни екран вашег уређаја и можете је користити као обичну апликацију.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={onClose}
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
          Можда касније
        </Button>
        <Button
          onClick={handleInstall}
          variant="contained"
          startIcon={<InstallIcon />}
          sx={{
            background: 'white',
            color: '#1976d2',
            fontWeight: 600,
            '&:hover': {
              background: 'rgba(255,255,255,0.9)'
            }
          }}
        >
          Инсталирај сада
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PWAInstallPrompt; 