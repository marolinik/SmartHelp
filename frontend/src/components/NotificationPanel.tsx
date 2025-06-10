import React, { useState, useEffect } from 'react';
import {
  Badge,
  IconButton,
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Alert,
  Chip,
  Stack
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as EscalationIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { sr } from 'date-fns/locale';
import { websocketService, WebSocketNotification } from '../services/websocketService';

interface NotificationPanelProps {
  userId: string;
  token: string;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ userId, token }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WebSocketNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Повежи се са WebSocket сервером
    websocketService.connect(userId, token);
    
    // Затражи дозволу за browser нотификације
    websocketService.requestNotificationPermission();

    // Listener за нове нотификације
    const handleNewNotification = (notification: WebSocketNotification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      setUnreadCount(prev => prev + 1);
    };

    websocketService.addNotificationListener(handleNewNotification);

    // Учитај постојеће нотификације
    setNotifications(websocketService.getNotifications());

    // Провери статус везе сваких 30 секунди
    const connectionInterval = setInterval(() => {
      setIsConnected(websocketService.isSocketConnected());
    }, 30000);

    return () => {
      websocketService.removeNotificationListener(handleNewNotification);
      clearInterval(connectionInterval);
    };
  }, [userId, token]);

  const handleToggleDrawer = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Обележи као прочитано када се отвори
      setUnreadCount(0);
    }
  };

  const handleClearAll = () => {
    websocketService.clearNotifications();
    setNotifications([]);
    setUnreadCount(0);
  };

  const getNotificationIcon = (type: WebSocketNotification['type']) => {
    switch (type) {
      case 'sla_alert':
        return <WarningIcon color="warning" />;
      case 'sla_escalation':
        return <EscalationIcon color="error" />;
      case 'ticket_update':
        return <InfoIcon color="info" />;
      case 'system_notification':
        return <CheckCircleIcon color="success" />;
      default:
        return <InfoIcon />;
    }
  };

  const getNotificationColor = (type: WebSocketNotification['type']) => {
    switch (type) {
      case 'sla_alert':
        return 'warning';
      case 'sla_escalation':
        return 'error';
      case 'ticket_update':
        return 'info';
      case 'system_notification':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityLabel = (priority: WebSocketNotification['priority']) => {
    const labels = {
      low: 'Низак',
      medium: 'Средњи',
      high: 'Висок',
      critical: 'Критичан'
    };
    return labels[priority] || priority;
  };

  const formatNotificationTime = (timestamp: Date) => {
    return formatDistanceToNow(new Date(timestamp), { 
      addSuffix: true, 
      locale: sr 
    });
  };

  return (
    <>
      {/* Икона за нотификације */}
      <IconButton color="inherit" onClick={handleToggleDrawer}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      {/* Drawer са нотификацијама */}
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={handleToggleDrawer}
        PaperProps={{
          sx: { width: 400, maxWidth: '90vw' }
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Нотификације
            </Typography>
            <IconButton onClick={handleToggleDrawer}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Статус везе */}
          <Alert 
            severity={isConnected ? 'success' : 'warning'} 
            sx={{ mb: 2 }}
            variant="outlined"
          >
            {isConnected 
              ? '✅ Real-time нотификације активне' 
              : '⚠️ Проблем са real-time везом'
            }
          </Alert>

          {/* Дугме за брисање */}
          {notifications.length > 0 && (
            <Button 
              variant="outlined" 
              size="small" 
              onClick={handleClearAll}
              sx={{ mb: 2 }}
            >
              Обриши све
            </Button>
          )}

          {/* Листа нотификација */}
          {notifications.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body2" color="text.secondary">
                Нема нових нотификација
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
              {notifications.map((notification, index) => (
                <React.Fragment key={index}>
                  <ListItem alignItems="flex-start" sx={{ pl: 0 }}>
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                          <Typography variant="subtitle2" component="div">
                            {notification.title}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={getPriorityLabel(notification.priority)}
                              size="small"
                              color={getNotificationColor(notification.type)}
                              variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatNotificationTime(notification.timestamp)}
                            </Typography>
                          </Stack>
                        </Box>
                      }
                      secondary={
                        <Box mt={1}>
                          <Typography variant="body2" color="text.primary">
                            {notification.message}
                          </Typography>
                          {notification.data?.ticketNumber && (
                            <Typography variant="caption" color="text.secondary" mt={0.5}>
                              Тикет: {notification.data.ticketNumber}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Drawer>
    </>
  );
};

export default NotificationPanel; 