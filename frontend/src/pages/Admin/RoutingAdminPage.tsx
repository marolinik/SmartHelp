import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import RouteIcon from '@mui/icons-material/Route';
import RoutingAdminDashboard from '../../components/Admin/RoutingAdminDashboard';

const RoutingAdminPage: React.FC = () => {
  return (
    <Box sx={{ padding: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={RouterLink}
          to="/dashboard"
          sx={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'inherit',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Почетна
        </Link>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AdminPanelSettingsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Администрација
        </Box>
        <Typography 
          color="text.primary" 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            fontWeight: 'medium'
          }}
        >
          <RouteIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Управљање Рутирањем
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom
          sx={{ 
            fontWeight: 600,
            color: 'primary.main',
            mb: 1
          }}
        >
          🎛️ Управљање Рутирањем Тикета
        </Typography>
        <Typography 
          variant="body1" 
          color="text.secondary"
          sx={{ maxWidth: 800 }}
        >
          Администрирајте систем за паметно рутирање тикета ПИО помоћи. 
          Подесите агенте, конфигуришите алгоритме рутирања, управљајте правилима 
          и пратите перформансе система у реалном времену.
        </Typography>
      </Box>

      {/* Dashboard Component */}
      <RoutingAdminDashboard />
    </Box>
  );
};

export default RoutingAdminPage; 