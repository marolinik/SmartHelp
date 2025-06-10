import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import RouteIcon from '@mui/icons-material/Route';
import RoutingMetricsDashboard from '../../components/Analytics/RoutingMetricsDashboard';

const RoutingMetricsPage: React.FC = () => {
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
          <AnalyticsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Аналитика
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
          Метрике Рутирања
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
          📊 Метрике Рутирања Тикета
        </Typography>
        <Typography 
          variant="body1" 
          color="text.secondary"
          sx={{ maxWidth: 800 }}
        >
          Детаљна аналитика и метрике система за паметно рутирање тикета. 
          Пратите перформансе агената, ефикасност рутирања, распоређивање оптерећења 
          и идентификујте области за оптимизацију система.
        </Typography>
      </Box>

      {/* Dashboard Component */}
      <RoutingMetricsDashboard />
    </Box>
  );
};

export default RoutingMetricsPage; 