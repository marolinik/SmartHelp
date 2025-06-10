/**
 * Backend Serbian formatting utilities for consistent number and date formatting
 * This mirrors the frontend formatting utilities to ensure consistency across the system
 */

import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

// Serbian number formatting standards for backend
export class SerbianNumberFormat {
  /**
   * Format number with Serbian locale
   */
  static formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return value.toLocaleString('sr-RS', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...options
    });
  }

  /**
   * Format integer without decimal places
   */
  static formatInteger(value: number): string {
    return value.toLocaleString('sr-RS', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  /**
   * Format decimal with specified decimal places
   */
  static formatDecimal(value: number, decimals: number = 2): string {
    return value.toLocaleString('sr-RS', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Format percentage with Serbian standards
   */
  static formatPercentage(value: number, decimals: number = 1): string {
    return `${value.toLocaleString('sr-RS', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}%`;
  }

  /**
   * Format currency (Serbian dinar)
   */
  static formatCurrency(value: number): string {
    return value.toLocaleString('sr-RS', {
      style: 'currency',
      currency: 'RSD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Format file size in Serbian
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    return `${size.toLocaleString('sr-RS', {
      minimumFractionDigits: i === 0 ? 0 : 1,
      maximumFractionDigits: i === 0 ? 0 : 2
    })} ${sizes[i]}`;
  }

  /**
   * Format large numbers with K, M suffixes
   */
  static formatCompactNumber(value: number): string {
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
}

// Serbian date formatting standards for backend
export class SerbianDateFormat {
  /**
   * Standard Serbian date format: dd.MM.yyyy
   */
  static formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd.MM.yyyy', { locale: sr });
  }

  /**
   * Time format: HH:mm
   */
  static formatTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'HH:mm', { locale: sr });
  }

  /**
   * Full datetime format: dd.MM.yyyy у HH:mm
   */
  static formatDateTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd.MM.yyyy у HH:mm', { locale: sr });
  }

  /**
   * Long datetime format: dd. MMMM yyyy у HH:mm
   */
  static formatLongDateTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd. MMMM yyyy у HH:mm', { locale: sr });
  }

  /**
   * Month and year: MMMM yyyy
   */
  static formatMonthYear(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMMM yyyy', { locale: sr });
  }

  /**
   * Short month format: dd. MMM
   */
  static formatShortDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd. MMM', { locale: sr });
  }

  /**
   * Weekday format: EEEE, dd.MM.yyyy
   */
  static formatWeekday(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'EEEE, dd.MM.yyyy', { locale: sr });
  }

  /**
   * Format period in Serbian
   */
  static formatPeriod(startDate: Date, endDate: Date): string {
    const start = SerbianDateFormat.formatDate(startDate);
    const end = SerbianDateFormat.formatDate(endDate);
    return `${start} - ${end}`;
  }

  /**
   * Duration formatting in Serbian
   */
  static formatDuration(minutes: number): string {
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

  /**
   * Relative time formatting in Serbian
   */
  static formatRelativeTime(date: Date | string): string {
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
  }
}

// Combined formatting utilities for backend
export class SerbianFormat {
  // Number formatting
  static formatNumber = SerbianNumberFormat.formatNumber;
  static formatInteger = SerbianNumberFormat.formatInteger;
  static formatDecimal = SerbianNumberFormat.formatDecimal;
  static formatPercentage = SerbianNumberFormat.formatPercentage;
  static formatCurrency = SerbianNumberFormat.formatCurrency;
  static formatFileSize = SerbianNumberFormat.formatFileSize;
  static formatCompactNumber = SerbianNumberFormat.formatCompactNumber;

  // Date formatting
  static formatDate = SerbianDateFormat.formatDate;
  static formatTime = SerbianDateFormat.formatTime;
  static formatDateTime = SerbianDateFormat.formatDateTime;
  static formatLongDateTime = SerbianDateFormat.formatLongDateTime;
  static formatMonthYear = SerbianDateFormat.formatMonthYear;
  static formatShortDate = SerbianDateFormat.formatShortDate;
  static formatWeekday = SerbianDateFormat.formatWeekday;
  static formatPeriod = SerbianDateFormat.formatPeriod;
  static formatDuration = SerbianDateFormat.formatDuration;
  static formatRelativeTime = SerbianDateFormat.formatRelativeTime;

  // Constants
  static readonly locale = 'sr-RS' as const;
  static readonly dateLocale = sr;

  // Common format patterns
  static readonly patterns = {
    date: 'dd.MM.yyyy',
    time: 'HH:mm',
    datetime: 'dd.MM.yyyy у HH:mm',
    longDatetime: 'dd. MMMM yyyy у HH:mm',
    monthYear: 'MMMM yyyy',
    shortDate: 'dd. MMM',
    weekday: 'EEEE, dd.MM.yyyy'
  } as const;
}

export default SerbianFormat; 