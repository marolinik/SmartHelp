import api from './api';

// Announcement interfaces
export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate?: string;
  isActive: boolean;
  isDismissible: boolean;
  targetAudience?: string[]; // roles or user groups
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  readBy?: string[]; // user IDs who have read/acknowledged
  dismissedBy?: string[]; // user IDs who have dismissed
}

export interface UserNotificationPreference {
  id: string;
  userId: string;
  emailNotifications: boolean;
  browserNotifications: boolean;
  smsNotifications: boolean;
  maintenanceNotifications: boolean;
  systemUpdateNotifications: boolean;
  generalNotifications: boolean;
  urgentOnly: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
  };
  createdAt: string;
  updatedAt: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  dismissed: number;
  byType: {
    [key: string]: number;
  };
  byPriority: {
    [key: string]: number;
  };
}

// Announcement API service
export const announcementApi = {
  // Get active announcements for current user
  async getActiveAnnouncements(): Promise<{ data: Announcement[] }> {
    const response = await api.get('/announcements/active');
    return response;
  },

  // Get all announcements with filtering
  async getAnnouncements(params: {
    type?: string;
    priority?: string;
    status?: 'active' | 'inactive' | 'all';
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: { announcements: Announcement[], total: number, page: number, totalPages: number } }> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString());
      }
    });

    const response = await api.get(`/announcements?${searchParams.toString()}`);
    return response;
  },

  // Get single announcement
  async getAnnouncement(id: string): Promise<{ data: Announcement }> {
    const response = await api.get(`/announcements/${id}`);
    return response;
  },

  // Mark announcement as read
  async markAsRead(announcementId: string): Promise<void> {
    await api.post(`/announcements/${announcementId}/read`);
  },

  // Dismiss announcement
  async dismissAnnouncement(announcementId: string): Promise<void> {
    await api.post(`/announcements/${announcementId}/dismiss`);
  },

  // Acknowledge announcement (stronger than read - requires user action)
  async acknowledgeAnnouncement(announcementId: string): Promise<void> {
    await api.post(`/announcements/${announcementId}/acknowledge`);
  },

  // Get user notification preferences
  async getNotificationPreferences(): Promise<{ data: UserNotificationPreference }> {
    const response = await api.get('/notifications/preferences');
    return response;
  },

  // Update user notification preferences
  async updateNotificationPreferences(preferences: Partial<UserNotificationPreference>): Promise<{ data: UserNotificationPreference }> {
    const response = await api.put('/notifications/preferences', preferences);
    return response;
  },

  // Get notification statistics
  async getNotificationStats(): Promise<{ data: NotificationStats }> {
    const response = await api.get('/notifications/stats');
    return response;
  },

  // Get maintenance schedule
  async getMaintenanceSchedule(): Promise<{ data: Announcement[] }> {
    const response = await api.get('/announcements/maintenance');
    return response;
  },

  // Get system status
  async getSystemStatus(): Promise<{ data: { status: 'operational' | 'maintenance' | 'degraded' | 'outage', message?: string, nextMaintenance?: string } }> {
    const response = await api.get('/system/status');
    return response;
  },

  // Admin functions (if user has admin role)
  async createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'readBy' | 'dismissedBy'>): Promise<{ data: Announcement }> {
    const response = await api.post('/announcements', announcement);
    return response;
  },

  async updateAnnouncement(id: string, announcement: Partial<Announcement>): Promise<{ data: Announcement }> {
    const response = await api.put(`/announcements/${id}`, announcement);
    return response;
  },

  async deleteAnnouncement(id: string): Promise<void> {
    await api.delete(`/announcements/${id}`);
  },

  // Bulk operations
  async markAllAsRead(): Promise<void> {
    await api.post('/announcements/mark-all-read');
  },

  async dismissAll(): Promise<void> {
    await api.post('/announcements/dismiss-all');
  }
}; 