import api from './api';

// Ticket interfaces
export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  categoryId: string;
  customerId: string;
  assignedToId?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  category?: {
    id: string;
    name: string;
    description?: string;
  };
  customer?: {
    id: string;
    displayName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    displayName: string;
    email: string;
  };
}

export interface TicketListResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TicketFilters {
  customer?: string;
  status?: string;
  priority?: string;
  categoryId?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateTicketData {
  subject: string;
  description: string;
  categoryId: string;
  priority: string;
  tags?: string[];
}

export interface UpdateTicketData {
  subject?: string;
  description?: string;
  status?: string;
  priority?: string;
  categoryId?: string;
  assignedToId?: string;
  resolution?: string;
  tags?: string[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  user?: {
    id: string;
    displayName: string;
    email: string;
  };
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

// Ticket API service
export const ticketApi = {
  // Get tickets with filters
  async getTickets(filters: TicketFilters = {}): Promise<{ data: TicketListResponse }> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await api.get(`/tickets?${params.toString()}`);
    return response;
  },

  // Get single ticket by ID
  async getTicket(id: string): Promise<{ data: Ticket }> {
    const response = await api.get(`/tickets/${id}`);
    return response;
  },

  // Create new ticket
  async createTicket(ticketData: CreateTicketData): Promise<{ data: Ticket }> {
    const response = await api.post('/tickets', ticketData);
    return response;
  },

  // Update ticket
  async updateTicket(id: string, updateData: UpdateTicketData): Promise<{ data: Ticket }> {
    const response = await api.put(`/tickets/${id}`, updateData);
    return response;
  },

  // Delete ticket
  async deleteTicket(id: string): Promise<void> {
    await api.delete(`/tickets/${id}`);
  },

  // Update ticket status
  async updateTicketStatus(id: string, status: string): Promise<{ data: Ticket }> {
    const response = await api.put(`/tickets/${id}/status`, { status });
    return response;
  },

  // Get ticket comments
  async getTicketComments(ticketId: string): Promise<{ data: TicketComment[] }> {
    const response = await api.get(`/tickets/${ticketId}/comments`);
    return response;
  },

  // Add ticket comment
  async addTicketComment(ticketId: string, content: string, isInternal: boolean = false): Promise<{ data: TicketComment }> {
    const response = await api.post(`/tickets/${ticketId}/comments`, {
      content,
      isInternal
    });
    return response;
  },

  // Get ticket categories
  async getCategories(): Promise<{ data: Category[] }> {
    const response = await api.get('/tickets/categories');
    return response;
  },

  // Get ticket statistics for dashboard
  async getTicketStats(userId?: string): Promise<{ data: any }> {
    const params = userId ? `?customerId=${userId}` : '';
    const response = await api.get(`/tickets/stats${params}`);
    return response;
  },

  // Get user's recent tickets
  async getUserRecentTickets(userId: string, limit: number = 5): Promise<{ data: Ticket[] }> {
    const response = await api.get(`/tickets?customer=${userId}&limit=${limit}&sortBy=createdAt&sortOrder=desc`);
    return response;
  }
}; 