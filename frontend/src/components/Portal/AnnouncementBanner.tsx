import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
  Zoom
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Build as MaintenanceIcon,
  Visibility as ViewIcon,
  DoneAll as AcknowledgeIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import { Announcement, announcementApi } from '../../services/announcementApi';

interface AnnouncementBannerProps {
  compact?: boolean;
  maxAnnouncements?: number;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  compact = false,
  maxAnnouncements = 3
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  useEffect(() => {
    loadAnnouncements();
    
    // Check for new announcements every 5 minutes
    const interval = setInterval(loadAnnouncements, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAnnouncements = async () => {
    try {
      const response = await announcementApi.getActiveAnnouncements();
      const activeAnnouncements = response.data
        .filter(ann => {
          // Filter out already dismissed announcements from localStorage
          const dismissed = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
          return !dismissed.includes(ann.id);
        })
        .sort((a, b) => {
          // Sort by priority first, then by creation date
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          const priorityDiff = (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                             (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
          if (priorityDiff !== 0) return priorityDiff;
          
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, maxAnnouncements);
      
      setAnnouncements(activeAnnouncements);
    } catch (error) {
      console.error('Error loading announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (announcementId: string) => {
    try {
      // Add to dismissed list in localStorage
      const dismissed = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
      dismissed.push(announcementId);
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(dismissed));
      
      // Add to local state
      setDismissedIds(prev => new Set(prev).add(announcementId));
      
      // Call API to record dismissal
      await announcementApi.dismissAnnouncement(announcementId);
      
      // Remove from current announcements
      setAnnouncements(prev => prev.filter(ann => ann.id !== announcementId));
    } catch (error) {
      console.error('Error dismissing announcement:', error);
    }
  };

  const handleToggleExpand = (announcementId: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(announcementId)) {
        newSet.delete(announcementId);
      } else {
        newSet.add(announcementId);
      }
      return newSet;
    });
  };

  const handleViewDetails = async (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setShowDetailDialog(true);
    
    // Mark as read when viewing details
    try {
      await announcementApi.markAsRead(announcement.id);
    } catch (error) {
      console.error('Error marking announcement as read:', error);
    }
  };

  const handleAcknowledge = async (announcement: Announcement) => {
    try {
      await announcementApi.acknowledgeAnnouncement(announcement.id);
      handleDismiss(announcement.id);
      setShowDetailDialog(false);
    } catch (error) {
      console.error('Error acknowledging announcement:', error);
    }
  };

  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'success':
        return <SuccessIcon />;
      case 'maintenance':
        return <MaintenanceIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getAnnouncementSeverity = (type: string, priority: string) => {
    if (type === 'error' || priority === 'urgent') return 'error';
    if (type === 'warning' || priority === 'high') return 'warning';
    if (type === 'success') return 'success';
    return 'info';
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      urgent: 'Хитно',
      high: 'Висок',
      medium: 'Средњи',
      low: 'Низак'
    };
    return labels[priority as keyof typeof labels] || priority;
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      info: 'Информација',
      warning: 'Упозорење',
      error: 'Грешка',
      success: 'Успех',
      maintenance: 'Одржавање'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || announcements.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack spacing={1}>
        {announcements.map((announcement, index) => (
          <Zoom in timeout={300 + index * 100} key={announcement.id}>
            <Alert
              severity={getAnnouncementSeverity(announcement.type, announcement.priority)}
              icon={getAnnouncementIcon(announcement.type)}
              action={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {!compact && (
                    <IconButton
                      size="small"
                      onClick={() => handleViewDetails(announcement)}
                      sx={{ color: 'inherit' }}
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  )}
                  {!compact && announcement.content && (
                    <IconButton
                      size="small"
                      onClick={() => handleToggleExpand(announcement.id)}
                      sx={{ color: 'inherit' }}
                    >
                      {expandedIds.has(announcement.id) ? (
                        <ExpandLessIcon fontSize="small" />
                      ) : (
                        <ExpandMoreIcon fontSize="small" />
                      )}
                    </IconButton>
                  )}
                  {announcement.isDismissible && (
                    <IconButton
                      size="small"
                      onClick={() => handleDismiss(announcement.id)}
                      sx={{ color: 'inherit' }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              }
              sx={{
                '& .MuiAlert-message': { width: '100%' },
                border: announcement.priority === 'urgent' ? 2 : 1,
                borderColor: announcement.priority === 'urgent' ? 'error.main' : undefined
              }}
            >
              <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {announcement.title}
                <Stack direction="row" spacing={0.5}>
                  <Chip
                    label={getPriorityLabel(announcement.priority)}
                    size="small"
                    color={
                      announcement.priority === 'urgent' ? 'error' :
                      announcement.priority === 'high' ? 'warning' :
                      announcement.priority === 'medium' ? 'info' : 'default'
                    }
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                  <Chip
                    label={getTypeLabel(announcement.type)}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                </Stack>
              </AlertTitle>
              
              {!compact && announcement.content && (
                <Collapse in={expandedIds.has(announcement.id)}>
                  <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                    {announcement.content}
                  </Typography>
                  {announcement.endDate && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Важи до: {formatDate(announcement.endDate)}
                    </Typography>
                  )}
                </Collapse>
              )}
              
              {compact && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {announcement.content}
                </Typography>
              )}
            </Alert>
          </Zoom>
        ))}
      </Stack>

      {/* Detailed Announcement Dialog */}
      <Dialog 
        open={showDetailDialog} 
        onClose={() => setShowDetailDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedAnnouncement && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getAnnouncementIcon(selectedAnnouncement.type)}
              {selectedAnnouncement.title}
              <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
                <Chip
                  label={getPriorityLabel(selectedAnnouncement.priority)}
                  size="small"
                  color={
                    selectedAnnouncement.priority === 'urgent' ? 'error' :
                    selectedAnnouncement.priority === 'high' ? 'warning' :
                    selectedAnnouncement.priority === 'medium' ? 'info' : 'default'
                  }
                />
                <Chip
                  label={getTypeLabel(selectedAnnouncement.type)}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                {selectedAnnouncement.content}
              </Typography>
              
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Објављено:</strong> {formatDate(selectedAnnouncement.createdAt)}
                </Typography>
                {selectedAnnouncement.endDate && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    <strong>Важи до:</strong> {formatDate(selectedAnnouncement.endDate)}
                  </Typography>
                )}
              </Paper>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDetailDialog(false)}>
                Затвори
              </Button>
              {selectedAnnouncement.type === 'maintenance' && (
                <Button
                  variant="contained"
                  startIcon={<AcknowledgeIcon />}
                  onClick={() => handleAcknowledge(selectedAnnouncement)}
                >
                  Потврди пријем
                </Button>
              )}
              {selectedAnnouncement.isDismissible && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    handleDismiss(selectedAnnouncement.id);
                    setShowDetailDialog(false);
                  }}
                >
                  Не приказуј више
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AnnouncementBanner; 