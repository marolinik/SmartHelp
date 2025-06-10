import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { SerbianFormat } from '../../../utils/formatting';

interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: number; // percentage change
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  suffix?: string;
  prefix?: string;
  description?: string;
  compact?: boolean;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  icon,
  color = 'primary',
  suffix = '',
  prefix = '',
  description,
  compact = false,
  onClick
}) => {
  const formatValue = (val: number | string): string => {
    if (typeof val === 'number') {
      return SerbianFormat.formatCompactNumber(val);
    }
    return val.toString();
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    
    if (trend > 0) {
      return <TrendingUpIcon fontSize="small" />;
    } else if (trend < 0) {
      return <TrendingDownIcon fontSize="small" />;
    } else {
      return <TrendingFlatIcon fontSize="small" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return 'text.secondary';
    
    if (trend > 0) {
      return 'success.main';
    } else if (trend < 0) {
      return 'error.main';
    } else {
      return 'text.secondary';
    }
  };

  const getTrendText = () => {
    if (!trend) return '';
    
    const absValue = Math.abs(trend);
    const direction = trend > 0 ? 'пораст' : trend < 0 ? 'опадање' : 'без промене';
    
    return `${SerbianFormat.formatDecimal(absValue, 1)}% ${direction}`;
  };

  const getColorConfig = () => {
    const colors = {
      primary: {
        background: 'rgba(25, 118, 210, 0.1)',
        border: 'rgba(25, 118, 210, 0.3)',
        iconColor: '#1976d2'
      },
      secondary: {
        background: 'rgba(156, 39, 176, 0.1)',
        border: 'rgba(156, 39, 176, 0.3)',
        iconColor: '#9c27b0'
      },
      success: {
        background: 'rgba(76, 175, 80, 0.1)',
        border: 'rgba(76, 175, 80, 0.3)',
        iconColor: '#4caf50'
      },
      error: {
        background: 'rgba(244, 67, 54, 0.1)',
        border: 'rgba(244, 67, 54, 0.3)',
        iconColor: '#f44336'
      },
      warning: {
        background: 'rgba(255, 152, 0, 0.1)',
        border: 'rgba(255, 152, 0, 0.3)',
        iconColor: '#ff9800'
      },
      info: {
        background: 'rgba(33, 150, 243, 0.1)',
        border: 'rgba(33, 150, 243, 0.3)',
        iconColor: '#2196f3'
      }
    };
    
    return colors[color];
  };

  const colorConfig = getColorConfig();

  return (
    <Card
      sx={{
        height: '100%',
        background: colorConfig.background,
        border: `1px solid ${colorConfig.border}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 3
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: compact ? 2 : 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Typography
                variant={compact ? "body2" : "subtitle2"}
                color="text.secondary"
                sx={{ 
                  fontWeight: 500,
                  fontSize: compact ? '0.75rem' : '0.875rem'
                }}
              >
                {title}
              </Typography>
              {description && (
                <Tooltip title={description} arrow>
                  <InfoIcon 
                    fontSize="small" 
                    sx={{ 
                      color: 'text.secondary',
                      fontSize: '16px'
                    }} 
                  />
                </Tooltip>
              )}
            </Box>

            <Typography
              variant={compact ? "h6" : "h4"}
              sx={{
                fontWeight: 'bold',
                color: 'text.primary',
                lineHeight: 1.2,
                mb: compact ? 0.5 : 1
              }}
            >
              {prefix}{formatValue(value)}{suffix}
            </Typography>

            {trend !== undefined && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <Chip
                  icon={getTrendIcon() || undefined}
                  label={getTrendText()}
                  size="small"
                  variant="outlined"
                  sx={{
                    color: getTrendColor(),
                    borderColor: getTrendColor(),
                    backgroundColor: 'transparent',
                    fontSize: compact ? '0.65rem' : '0.75rem',
                    height: compact ? 20 : 24,
                    '& .MuiChip-icon': {
                      color: getTrendColor(),
                      fontSize: compact ? '14px' : '16px'
                    }
                  }}
                />
              </Box>
            )}
          </Box>

          {icon && (
            <Box
              sx={{
                p: compact ? 1 : 1.5,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: compact ? 32 : 40,
                minHeight: compact ? 32 : 40
              }}
            >
              {React.cloneElement(icon as React.ReactElement, {
                sx: {
                  color: colorConfig.iconColor,
                  fontSize: compact ? 18 : 24
                }
              })}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default MetricCard; 