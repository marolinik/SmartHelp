import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Tabs,
  Tab,
  Button,
  IconButton,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Chip,
  Breadcrumbs,
  Link,
  Fab
} from '@mui/material';
import {
  Home as HomeIcon,
  ConfirmationNumber as TicketIcon,
  MenuBook as KnowledgeIcon,
  AccountCircle as ProfileIcon,
  ExitToApp as LogoutIcon,
  Menu as MenuIcon,
  NavigateNext as NavigateNextIcon,
  GetApp as InstallIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { RootState, AppDispatch } from '../../store/store';
import { logout } from '../../store/slices/authSlice';
import AnnouncementBanner from '../Portal/AnnouncementBanner';
import NotificationPanel from '../Portal/NotificationPanel';
import { usePWA } from '../../hooks/usePWA';
import PWAInstallPrompt from '../PWA/PWAInstallPrompt';
import PWAUpdateNotification from '../PWA/PWAUpdateNotification';

interface SelfServiceLayoutProps {
  children?: React.ReactNode;
}

const SelfServiceLayout: React.FC<SelfServiceLayoutProps> = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  // PWA functionality
  const {
    isInstallable,
    updateAvailable,
    installApp,
    updateApp
  } = usePWA();

  // Navigation tabs for self-service portal
  const navigationTabs = [
    { 
      label: t('selfService.nav.dashboard'), 
      value: '/portal/dashboard', 
      icon: <HomeIcon sx={{ mr: 1 }} />,
      description: t('selfService.nav.dashboardDesc')
    },
    { 
      label: t('selfService.nav.newTicket'), 
      value: '/portal/ticket/new', 
      icon: <TicketIcon sx={{ mr: 1 }} />,
      description: t('selfService.nav.newTicketDesc')
    },
    { 
      label: t('selfService.nav.myTickets'), 
      value: '/portal/tickets', 
      icon: <TicketIcon sx={{ mr: 1 }} />,
      description: t('selfService.nav.myTicketsDesc')
    },
    { 
      label: t('selfService.nav.knowledgeBase'), 
      value: '/portal/knowledge-base', 
      icon: <KnowledgeIcon sx={{ mr: 1 }} />,
      description: t('selfService.nav.knowledgeBaseDesc')
    }
  ];

  // Generate breadcrumbs based on current path
  const generateBreadcrumbs = () => {
    const pathnames = location.pathname.split('/').filter((x) => x);
    const breadcrumbs = [];
    
    // Always start with Portal home
    breadcrumbs.push({
      label: t('selfService.nav.portal'),
      path: '/portal'
    });

    // Add current page breadcrumb
    const currentTab = navigationTabs.find(tab => tab.value === location.pathname);
    if (currentTab) {
      breadcrumbs.push({
        label: currentTab.label,
        path: location.pathname
      });
    }

    return breadcrumbs;
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    navigate(newValue);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    handleProfileMenuClose();
    navigate('/login');
  };

  const handleNavigateToProfile = () => {
    navigate('/portal/profile');
    handleProfileMenuClose();
  };

  const currentTabValue = navigationTabs.find(tab => 
    location.pathname.startsWith(tab.value.split('?')[0])
  )?.value || '/portal/dashboard';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar 
        position="sticky" 
        elevation={1}
        sx={{ 
          backgroundColor: theme.palette.primary.main,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <Toolbar>
          {/* Mobile menu button */}
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={handleMobileMenuOpen}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo and title */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ 
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              onClick={() => navigate('/portal/dashboard')}
            >
              📞 PIO Help Desk Portal
            </Typography>
            
            {!isMobile && (
              <Chip
                label={t('selfService.nav.selfService')}
                size="small"
                variant="outlined"
                sx={{ 
                  ml: 2, 
                  color: 'white', 
                  borderColor: 'rgba(255,255,255,0.5)' 
                }}
              />
            )}
          </Box>

          {/* User info and profile menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Notification Panel */}
            <NotificationPanel />
            
            <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
              {user?.displayName || user?.email}
            </Typography>
            
            <IconButton
              color="inherit"
              onClick={handleProfileMenuOpen}
              aria-label="profile menu"
            >
              <ProfileIcon />
            </IconButton>
          </Box>
        </Toolbar>

        {/* Desktop navigation tabs */}
        {!isMobile && (
          <Container maxWidth="lg">
            <Tabs
              value={currentTabValue}
              onChange={handleTabChange}
              indicatorColor="secondary"
              textColor="inherit"
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  minHeight: 64,
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.95rem'
                }
              }}
            >
              {navigationTabs.map((tab) => (
                <Tab
                  key={tab.value}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {tab.icon}
                      {tab.label}
                    </Box>
                  }
                  value={tab.value}
                  aria-label={tab.description}
                />
              ))}
            </Tabs>
          </Container>
        )}
      </AppBar>

      {/* Breadcrumbs */}
      <Container maxWidth="lg" sx={{ mt: 2, mb: 1 }}>
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          aria-label="breadcrumb"
        >
          {generateBreadcrumbs().map((crumb, index) => (
            <Link
              key={index}
              color={index === generateBreadcrumbs().length - 1 ? 'textPrimary' : 'inherit'}
              href={crumb.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(crumb.path);
              }}
              underline="hover"
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              {crumb.label}
            </Link>
          ))}
        </Breadcrumbs>
      </Container>

      {/* Main content */}
      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
        {/* Announcements Banner */}
        <AnnouncementBanner />
        
        <Outlet />
      </Container>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: theme.palette.grey[100],
          borderTop: `1px solid ${theme.palette.divider}`
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © 2025 PIO Help Desk System. {t('selfService.footer.allRights')}
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            {t('selfService.footer.needHelp')} {' '}
            <Link href="mailto:support@pio.rs" underline="hover">
              support@pio.rs
            </Link>
          </Typography>
        </Container>
      </Box>

      {/* Mobile Menu */}
      <Menu
        anchorEl={mobileMenuAnchor}
        open={Boolean(mobileMenuAnchor)}
        onClose={handleMobileMenuClose}
        keepMounted
      >
        {navigationTabs.map((tab) => (
          <MenuItem
            key={tab.value}
            onClick={() => {
              navigate(tab.value);
              handleMobileMenuClose();
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {tab.icon}
              <Box>
                <Typography variant="body1">{tab.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {tab.description}
                </Typography>
              </Box>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* Profile Menu */}
      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={handleProfileMenuClose}
        keepMounted
      >
        <MenuItem onClick={handleNavigateToProfile}>
          <ProfileIcon sx={{ mr: 1 }} />
          {t('selfService.nav.profile')}
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <LogoutIcon sx={{ mr: 1 }} />
          {t('auth.logout')}
        </MenuItem>
      </Menu>

      {/* PWA Install FAB */}
      {isInstallable && (
        <Fab
          color="primary"
          aria-label="install app"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
          onClick={() => setShowInstallPrompt(true)}
        >
          <InstallIcon />
        </Fab>
      )}

      {/* PWA Install Prompt */}
      <PWAInstallPrompt
        open={showInstallPrompt}
        onClose={() => setShowInstallPrompt(false)}
        onInstall={installApp}
      />

      {/* PWA Update Notification */}
      <PWAUpdateNotification
        open={updateAvailable}
        onUpdate={updateApp}
        onClose={() => setShowUpdateNotification(false)}
      />
    </Box>
  );
};

export default SelfServiceLayout; 