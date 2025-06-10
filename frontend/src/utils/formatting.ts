import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

/**
 * Serbian formatting utilities for consistent number and date formatting
 */

// Serbian number formatting standards
export const SerbianNumberFormat = {
  // Standard Serbian locale formatting
  formatNumber: (value: number, options?: Intl.NumberFormatOptions): string => {
    return value.toLocaleString('sr-RS', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...options
    });
  },

  // Format integer without decimal places
  formatInteger: (value: number): string => {
    return value.toLocaleString('sr-RS', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  },

  // Format decimal with 2 decimal places
  formatDecimal: (value: number, decimals: number = 2): string => {
    return value.toLocaleString('sr-RS', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  // Format percentage with Serbian standards
  formatPercentage: (value: number, decimals: number = 1): string => {
    return `${value.toLocaleString('sr-RS', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}%`;
  },

  // Format currency (Serbian dinar)
  formatCurrency: (value: number): string => {
    return value.toLocaleString('sr-RS', {
      style: 'currency',
      currency: 'RSD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  // Format file size in Serbian
  formatFileSize: (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    return `${size.toLocaleString('sr-RS', {
      minimumFractionDigits: i === 0 ? 0 : 1,
      maximumFractionDigits: i === 0 ? 0 : 2
    })} ${sizes[i]}`;
  },

  // Format large numbers with K, M suffixes
  formatCompactNumber: (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toLocaleString('sr-RS', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      })}М`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toLocaleString('sr-RS', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      })}К`;
    }
    return value.toLocaleString('sr-RS');
  }
};

// Serbian date formatting standards
export const SerbianDateFormat = {
  // Standard Serbian date format: dd.MM.yyyy
  formatDate: (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd.MM.yyyy', { locale: sr });
  },

  // Time format: HH:mm
  formatTime: (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'HH:mm', { locale: sr });
  },

  // Full datetime format: dd.MM.yyyy у HH:mm
  formatDateTime: (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd.MM.yyyy у HH:mm', { locale: sr });
  },

  // Long datetime format: dd. MMMM yyyy у HH:mm
  formatLongDateTime: (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd. MMMM yyyy у HH:mm', { locale: sr });
  },

  // Month and year: MMMM yyyy
  formatMonthYear: (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMMM yyyy', { locale: sr });
  },

  // Short month format: dd. MMM
  formatShortDate: (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd. MMM', { locale: sr });
  },

  // Weekday format: EEEE, dd.MM.yyyy
  formatWeekday: (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'EEEE, dd.MM.yyyy', { locale: sr });
  },

  // Relative time formatting in Serbian
  formatRelativeTime: (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'управо сада';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `пре ${minutes} мин`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `пре ${hours} сат${hours === 1 ? '' : 'а'}`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `пре ${days} дан${days === 1 ? '' : 'а'}`;
    } else {
      return SerbianDateFormat.formatDate(dateObj);
    }
  },

  // Duration formatting in Serbian
  formatDuration: (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} мин`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}ч ${mins}мин` : `${hours}ч`;
    } else {
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      return hours > 0 ? `${days}д ${hours}ч` : `${days}д`;
    }
  }
};

// Combined formatting utilities
export const SerbianFormat = {
  ...SerbianNumberFormat,
  ...SerbianDateFormat,
  
  // Locale string for consistent use
  locale: 'sr-RS' as const,
  
  // Date-fns locale
  dateLocale: sr,
  
  // Common format patterns
  patterns: {
    date: 'dd.MM.yyyy',
    time: 'HH:mm',
    datetime: 'dd.MM.yyyy у HH:mm',
    longDatetime: 'dd. MMMM yyyy у HH:mm',
    monthYear: 'MMMM yyyy',
    shortDate: 'dd. MMM',
    weekday: 'EEEE, dd.MM.yyyy'
  }
};

export default SerbianFormat; 