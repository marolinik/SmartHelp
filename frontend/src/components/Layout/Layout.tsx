import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as TicketsIcon,
  People as UsersIcon,
  Analytics as AnalyticsIcon,
  Email as EmailIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountIcon,
  HealthAndSafety as HealthIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { RootState } from '../../store/store';
import { toggleDrawer } from '../../store/slices/uiSlice';
import NotificationPanel from '../NotificationPanel';

const drawerWidth = 240;

const Layout: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDrawerOpen } = useSelector((state: RootState) => state.ui);
  const { user, token } = useSelector((state: RootState) => state.auth);

  const menuItems = [
    { key: 'dashboard', label: t('navigation.dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
    { key: 'tickets', label: t('navigation.tickets'), icon: <TicketsIcon />, path: '/tickets' },
    { key: 'sla-analytics', label: 'SLA Аналитика', icon: <AnalyticsIcon />, path: '/sla-analytics' },
    { key: 'users', label: t('navigation.users'), icon: <UsersIcon />, path: '/users' },
    { key: 'email', label: 'Email Управљање', icon: <EmailIcon />, path: '/admin/email' },
    { key: 'system-health', label: 'Здравље система', icon: <HealthIcon />, path: '/admin/system-health' },
    { key: 'profile', label: t('navigation.profile'), icon: <AccountIcon />, path: '/profile' },
  ];

  const handleDrawerToggle = () => {
    dispatch(toggleDrawer());
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            PIO Help Desk
          </Typography>
          
          {/* Real-time нотификације */}
          {user && token && (
            <NotificationPanel userId={user.id} token={token} />
          )}
          
          <Typography variant="body2" sx={{ ml: 2 }}>
            {user?.displayName}
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="persistent"
        anchor="left"
        open={isDrawerOpen}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem button key={item.key} onClick={() => handleNavigation(item.path)}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          transition: (theme) => theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          marginLeft: isDrawerOpen ? 0 : `-${drawerWidth}px`,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout; 