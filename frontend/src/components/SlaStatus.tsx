import React from 'react';
import {
  Box,
  Chip,
  LinearProgress,
  Typography,
  Alert,
  Stack,
  Tooltip,
  Paper
} from '@mui/material';
import {
  AccessTime,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Schedule
} from '@mui/icons-material';
import { formatDistanceToNow, isPast } from 'date-fns';
import { sr } from 'date-fns/locale';

export interface SlaInfo {
  responseTimeHours: number;
  resolutionTimeHours: number;
  responseDueDate: string | null;
  resolutionDueDate: string | null;
  slaStatus: 'on_track' | 'warning' | 'breached';
  calculatedAt?: string;
}

interface SlaStatusProps {
  slaInfo: SlaInfo | null;
  ticketStatus: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  compact?: boolean;
}

// Српски лабели за SLA статус
const slaStatusLabels = {
  on_track: 'У року',
  warning: 'Упозорење',
  breached: 'Прекршен'
};

const slaStatusColors = {
  on_track: 'success' as const,
  warning: 'warning' as const, 
  breached: 'error' as const
};

const slaStatusIcons = {
  on_track: <CheckCircle />,
  warning: <Warning />,
  breached: <ErrorIcon />
};

export const SlaStatus: React.FC<SlaStatusProps> = ({
  slaInfo,
  ticketStatus,
  firstResponseAt,
  resolvedAt,
  compact = false
}) => {
  if (!slaInfo) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          SLA информације нису доступне
        </Typography>
      </Paper>
    );
  }

  const now = new Date();
  const responseDue = slaInfo.responseDueDate ? new Date(slaInfo.responseDueDate) : null;
  const resolutionDue = slaInfo.resolutionDueDate ? new Date(slaInfo.resolutionDueDate) : null;

  // Израчунај време које је остало
  const getTimeRemaining = (dueDate: Date | null) => {
    if (!dueDate) return null;
    
    if (isPast(dueDate)) {
      return {
        text: `Прекорачено за ${formatDistanceToNow(dueDate, { locale: sr })}`,
        isOverdue: true
      };
    }
    
    return {
      text: `Остало ${formatDistanceToNow(dueDate, { locale: sr })}`,
      isOverdue: false
    };
  };

  // Израчунај прогрес за одзив
  const getResponseProgress = () => {
    if (!responseDue || firstResponseAt) return 100;
    
    const totalTime = slaInfo.responseTimeHours * 60 * 60 * 1000; // у милисекундама
    const startTime = new Date(responseDue.getTime() - totalTime);
    const elapsed = now.getTime() - startTime.getTime();
    const progress = Math.min((elapsed / totalTime) * 100, 100);
    
    return Math.max(progress, 0);
  };

  // Израчунај прогрес за решавање
  const getResolutionProgress = () => {
    if (!resolutionDue || resolvedAt) return 100;
    
    const totalTime = slaInfo.resolutionTimeHours * 60 * 60 * 1000;
    const startTime = new Date(resolutionDue.getTime() - totalTime);
    const elapsed = now.getTime() - startTime.getTime();
    const progress = Math.min((elapsed / totalTime) * 100, 100);
    
    return Math.max(progress, 0);
  };

  const responseTimeRemaining = getTimeRemaining(responseDue);
  const resolutionTimeRemaining = getTimeRemaining(resolutionDue);
  const responseProgress = getResponseProgress();
  const resolutionProgress = getResolutionProgress();

  if (compact) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Chip
          icon={slaStatusIcons[slaInfo.slaStatus]}
          label={slaStatusLabels[slaInfo.slaStatus]}
          color={slaStatusColors[slaInfo.slaStatus]}
          size="small"
        />
        {!firstResponseAt && responseDue && (
          <Tooltip title={`Одзив: ${responseTimeRemaining?.text}`}>
            <Chip
              icon={<AccessTime />}
              label={`Одзив: ${slaInfo.responseTimeHours}h`}
              variant="outlined"
              size="small"
              color={responseTimeRemaining?.isOverdue ? 'error' : 'default'}
            />
          </Tooltip>
        )}
        {!resolvedAt && resolutionDue && (
          <Tooltip title={`Решавање: ${resolutionTimeRemaining?.text}`}>
            <Chip
              icon={<Schedule />}
              label={`Решавање: ${slaInfo.resolutionTimeHours}h`}
              variant="outlined"
              size="small"
              color={resolutionTimeRemaining?.isOverdue ? 'error' : 'default'}
            />
          </Tooltip>
        )}
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* SLA Статус заглавље */}
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" display="flex" alignItems="center" gap={1}>
            <AccessTime color="primary" />
            SLA Статус
          </Typography>
          <Chip
            icon={slaStatusIcons[slaInfo.slaStatus]}
            label={slaStatusLabels[slaInfo.slaStatus]}
            color={slaStatusColors[slaInfo.slaStatus]}
          />
        </Box>

        {/* SLA Упозорење */}
        {slaInfo.slaStatus === 'warning' && (
          <Alert severity="warning" icon={<Warning />}>
            SLA рок се приближава. Потребно је хитно деловање.
          </Alert>
        )}

        {slaInfo.slaStatus === 'breached' && (
          <Alert severity="error" icon={<ErrorIcon />}>
            SLA рок је прекршен. Потребна је ескалација.
          </Alert>
        )}

        {/* Одзив SLA */}
        {!firstResponseAt && responseDue && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Време одзива ({slaInfo.responseTimeHours}h)
              </Typography>
              <Typography 
                variant="body2" 
                color={responseTimeRemaining?.isOverdue ? 'error.main' : 'text.primary'}
                fontWeight="medium"
              >
                {responseTimeRemaining?.text}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={responseProgress}
              color={responseProgress > 75 ? 'error' : responseProgress > 50 ? 'warning' : 'primary'}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary" mt={0.5}>
              Рок: {responseDue.toLocaleString('sr-RS')}
            </Typography>
          </Box>
        )}

        {/* Решавање SLA */}
        {!resolvedAt && resolutionDue && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Време решавања ({slaInfo.resolutionTimeHours}h)
              </Typography>
              <Typography 
                variant="body2" 
                color={resolutionTimeRemaining?.isOverdue ? 'error.main' : 'text.primary'}
                fontWeight="medium"
              >
                {resolutionTimeRemaining?.text}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={resolutionProgress}
              color={resolutionProgress > 75 ? 'error' : resolutionProgress > 50 ? 'warning' : 'primary'}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary" mt={0.5}>
              Рок: {resolutionDue.toLocaleString('sr-RS')}
            </Typography>
          </Box>
        )}

        {/* Завршени SLA-ови */}
        {firstResponseAt && (
          <Box>
            <Typography variant="subtitle2" color="success.main" display="flex" alignItems="center" gap={1}>
              <CheckCircle fontSize="small" />
              Одзив завршен: {new Date(firstResponseAt).toLocaleString('sr-RS')}
            </Typography>
          </Box>
        )}

        {resolvedAt && (
          <Box>
            <Typography variant="subtitle2" color="success.main" display="flex" alignItems="center" gap={1}>
              <CheckCircle fontSize="small" />
              Решавање завршено: {new Date(resolvedAt).toLocaleString('sr-RS')}
            </Typography>
          </Box>
        )}

        {/* Додатне информације */}
        {slaInfo.calculatedAt && (
          <Typography variant="caption" color="text.secondary">
            Последњи пут ажурирано: {new Date(slaInfo.calculatedAt).toLocaleString('sr-RS')}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}; 