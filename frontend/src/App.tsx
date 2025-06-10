import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { RootState, AppDispatch } from './store/store';
import { getCurrentUser } from './store/slices/authSlice';
import Layout from './components/Layout/Layout';
import SelfServiceLayout from './components/Layout/SelfServiceLayout';
import LoginPage from './pages/Auth/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import TicketsPage from './pages/Tickets/TicketsPage';
import TicketDetailPage from './pages/Tickets/TicketDetailPage';
import CreateTicketPage from './pages/Tickets/CreateTicketPage';
import UsersPage from './pages/Users/UsersPage';
import ProfilePage from './pages/Profile/ProfilePage';
import SlaAnalyticsPage from './pages/Analytics/SlaAnalyticsPage';
import EmailManagementPage from './pages/Admin/EmailManagementPage';
import NotFoundPage from './pages/NotFound/NotFoundPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import NotificationContainer from './components/Notifications/NotificationContainer';
import SystemHealthPage from './pages/Admin/SystemHealthPage';
import PortalDashboardPage from './pages/Portal/PortalDashboardPage';
import PortalCreateTicketPage from './pages/Portal/PortalCreateTicketPage';
import PortalKnowledgeBasePage from './pages/Portal/PortalKnowledgeBasePage';
import PortalMyTicketsPage from './pages/Portal/PortalMyTicketsPage';
import PortalQuickLinksPage from './pages/Portal/PortalQuickLinksPage';
import PortalProfilePage from './pages/Portal/PortalProfilePage';
import RoutingAdminPage from './pages/Admin/RoutingAdminPage';
import RoutingMetricsPage from './pages/Analytics/RoutingMetricsPage';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading, token } = useSelector((state: RootState) => state.auth);
  const { i18n } = useTranslation();

  useEffect(() => {
    // Set document language
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    // Check if user is authenticated on app load
    if (token && !isAuthenticated) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, token, isAuthenticated]);

  // Show loading spinner while checking authentication
  if (isLoading && token) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
          }
        />

        {/* Protected routes - Admin/Internal */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          
          {/* Ticket routes */}
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="tickets/create" element={<CreateTicketPage />} />
          <Route path="tickets/:id" element={<TicketDetailPage />} />
          
          {/* Analytics routes */}
          <Route path="sla-analytics" element={
            <ProtectedRoute>
              <SlaAnalyticsPage />
            </ProtectedRoute>
          } />
          <Route path="routing-metrics" element={
            <ProtectedRoute>
              <RoutingMetricsPage />
            </ProtectedRoute>
          } />
          
          {/* Admin routes */}
          <Route path="/admin/email" element={
            <ProtectedRoute>
              <EmailManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/routing" element={
            <ProtectedRoute>
              <RoutingAdminPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/system-health" element={<SystemHealthPage />} />
          
          {/* User management routes */}
          <Route path="users" element={<UsersPage />} />
          
          {/* Profile route */}
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Self-Service Portal routes */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute>
              <SelfServiceLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/portal/dashboard" replace />} />
          <Route path="dashboard" element={<PortalDashboardPage />} />
          
          {/* Portal ticket routes */}
          <Route path="ticket/new" element={<PortalCreateTicketPage />} />
          <Route path="tickets" element={<PortalMyTicketsPage />} />
          {/* <Route path="tickets/:id" element={<PortalTicketDetailPage />} /> */}
          
          {/* Quick links route */}
          <Route path="quick-links" element={<PortalQuickLinksPage />} />
          
          {/* Knowledge base routes */}
          <Route path="knowledge-base" element={<PortalKnowledgeBasePage />} />
          {/* <Route path="knowledge-base/:id" element={<PortalKbArticlePage />} /> */}
          
          {/* Profile route */}
          <Route path="profile" element={<PortalProfilePage />} />
        </Route>

        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Global notification container */}
      <NotificationContainer />
    </>
  );
}

export default App; 