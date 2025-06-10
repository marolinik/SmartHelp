import React, { useState, useEffect, useRef } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Switch,
  Tab,
  Tabs,
  Typography,
  useTheme,
  Avatar,
  FormControlLabel,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsOffIcon,
  Circle as UnreadIcon,
  CheckCircle as ReadIcon,
  Clear as ClearIcon,
  Settings as SettingsIcon,
  MarkEmailRead as MarkAllReadIcon,
  Delete as DeleteIcon,
  ConfirmationNumber as TicketIcon,
  Announcement as AnnouncementIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Build as MaintenanceIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import { 
  UserNotification, 
  UserNotificationPreference,
  announcementApi 
} from '../../services/announcementApi';

interface NotificationPanelProps {
  position?: 'left' | 'right';
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  position = 'right' 
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTab, setCurrentTab] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState<UserNotificationPreference | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const notificationSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadNotifications();
    loadPreferences();
    
    // Setup notification sound
    notificationSound.current = new Audio('/sounds/notification.mp3');
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    
    // Setup WebSocket connection for real-time notifications
    // setupWebSocketConnection();
    
    return () => {
      clearInterval(interval);
      // closeWebSocketConnection();
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await announcementApi.getUserNotifications();
      const userNotifications = response.data;
      
      // Check for new notifications
      const newNotifications = userNotifications.filter(notification => 
        !notification.isRead && 
        !notifications.some(existing => existing.id === notification.id)
      );
      
      if (newNotifications.length > 0 && notifications.length > 0) {
        // Play notification sound for new notifications
        playNotificationSound();
        
        // Show browser notification if enabled
        if (preferences?.browserNotifications && 'Notification' in window) {
          newNotifications.forEach(notification => {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/favicon.ico',
              tag: notification.id
            });
          });
        }
      }
      
      setNotifications(userNotifications);
      setUnreadCount(userNotifications.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await announcementApi.getNotificationPreferences();
      setPreferences(response.data);
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const playNotificationSound = () => {
    if (preferences?.soundEnabled && notificationSound.current) {
      notificationSound.current.play().catch(e => {
        console.log('Could not play notification sound:', e);
      });
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await announcementApi.markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await announcementApi.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await announcementApi.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId);
        return notification && !notification.isRead ? prev - 1 : prev;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      await announcementApi.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  const handleUpdatePreferences = async (updates: Partial<UserNotificationPreference>) => {
    try {
      const updatedPreferences = { ...preferences!, ...updates };
      await announcementApi.updateNotificationPreferences(updatedPreferences);
      setPreferences(updatedPreferences);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ticket':
        return <TicketIcon />;
      case 'announcement':
        return <AnnouncementIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'error':
        return <ErrorIcon />;
      case 'success':
        return <SuccessIcon />;
      case 'maintenance':
        return <MaintenanceIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getNotificationColor = (type: string, priority: string) => {
    if (type === 'error' || priority === 'urgent') return theme.palette.error.main;
    if (type === 'warning' || priority === 'high') return theme.palette.warning.main;
    if (type === 'success') return theme.palette.success.main;
    return theme.palette.info.main;
  };

  const formatTime = (dateString: string) => {
    const now = new Date();
    const notificationTime = new Date(dateString);
    const diff = now.getTime() - notificationTime.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Управо сада';
    if (minutes < 60) return `пре ${minutes} мин`;
    if (hours < 24) return `пре ${hours} сат${hours > 1 ? 'и' : ''}`;
    if (days < 7) return `пре ${days} дан${days > 1 ? 'а' : ''}`;
    
    return notificationTime.toLocaleDateString('sr-RS');
  };

  const filterNotifications = (notifications: UserNotification[], filter: string) => {
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.isRead);
      case 'tickets':
        return notifications.filter(n => n.type === 'ticket');
      case 'announcements':
        return notifications.filter(n => n.type === 'announcement');
      default:
        return notifications;
    }
  };

  const getTabLabel = (index: number) => {
    const labels = ['Све', 'Непрочитане', 'Тикети', 'Обавештења'];
    const counts = [
      notifications.length,
      notifications.filter(n => !n.isRead).length,
      notifications.filter(n => n.type === 'ticket').length,
      notifications.filter(n => n.type === 'announcement').length
    ];
    
    return `${labels[index]} ${counts[index] > 0 ? `(${counts[index]})` : ''}`;
  };

  const filteredNotifications = filterNotifications(
    notifications,
    ['all', 'unread', 'tickets', 'announcements'][currentTab]
  );

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        handleUpdatePreferences({ browserNotifications: true });
      }
    }
  };

  return (
    <>
      {/* Notification Bell Icon */}
      <IconButton
        onClick={() => setIsOpen(true)}
        color="inherit"
        sx={{ mr: 1 }}
      >
        <Badge badgeContent={unreadCount} color="error">
          {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsOffIcon />}
        </Badge>
      </IconButton>

      {/* Notification Drawer */}
      <Drawer
        anchor={position}
        open={isOpen}
        onClose={() => setIsOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 400 }, maxWidth: '100vw' }
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Paper sx={{ p: 2, boxShadow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6">
                Обавештења
              </Typography>
              <Box>
                <IconButton
                  size="small"
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                >
                  <SettingsIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setIsOpen(false)}
                >
                  <ClearIcon />
                </IconButton>
              </Box>
            </Box>
            
            {/* Action Buttons */}
            {notifications.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<MarkAllReadIcon />}
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                >
                  Означи све
                </Button>
                <Button
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={handleClearAll}
                  color="error"
                >
                  Обриши све
                </Button>
              </Box>
            )}
          </Paper>

          {/* Tabs */}
          <Tabs
            value={currentTab}
            onChange={(_, newValue) => setCurrentTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            {[0, 1, 2, 3].map(index => (
              <Tab
                key={index}
                label={getTabLabel(index)}
                sx={{ minWidth: 0, fontSize: '0.8rem' }}
              />
            ))}
          </Tabs>

          {/* Notifications List */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {filteredNotifications.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Нема обавештења
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {filteredNotifications.map((notification, index) => (
                  <React.Fragment key={notification.id}>
                    <ListItem
                      sx={{
                        alignItems: 'flex-start',
                        bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                        borderLeft: notification.isRead ? 'none' : `3px solid ${getNotificationColor(notification.type, notification.priority)}`,
                        cursor: 'pointer'
                      }}
                      onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: getNotificationColor(notification.type, notification.priority),
                            width: 32,
                            height: 32
                          }}
                        >
                          {getNotificationIcon(notification.type)}
                        </Avatar>
                      </ListItemAvatar>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: notification.isRead ? 'normal' : 'bold' }}>
                              {notification.title}
                            </Typography>
                            {!notification.isRead && (
                              <UnreadIcon sx={{ fontSize: 8, color: 'primary.main' }} />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {notification.message}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {formatTime(notification.createdAt)}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {notification.priority && (
                                  <Chip
                                    label={notification.priority}
                                    size="small"
                                    sx={{ height: 16, fontSize: '0.6rem' }}
                                  />
                                )}
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteNotification(notification.id);
                                  }}
                                >
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Box>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < filteredNotifications.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* Settings Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: 280 } }}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2">Подешавања обавештења</Typography>
        </MenuItem>
        <Divider />
        
        {preferences && (
          <>
            <MenuItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.emailNotifications}
                    onChange={(e) => handleUpdatePreferences({ emailNotifications: e.target.checked })}
                  />
                }
                label="Email обавештења"
              />
            </MenuItem>
            
            <MenuItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.browserNotifications}
                    onChange={(e) => {
                      if (e.target.checked) {
                        requestNotificationPermission();
                      } else {
                        handleUpdatePreferences({ browserNotifications: false });
                      }
                    }}
                  />
                }
                label="Browser обавештења"
              />
            </MenuItem>
            
            <MenuItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.soundEnabled}
                    onChange={(e) => handleUpdatePreferences({ soundEnabled: e.target.checked })}
                  />
                }
                label="Звучна обавештења"
              />
            </MenuItem>
            
            <MenuItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.smsNotifications}
                    onChange={(e) => handleUpdatePreferences({ smsNotifications: e.target.checked })}
                  />
                }
                label="SMS обавештења"
              />
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};

export default NotificationPanel; 