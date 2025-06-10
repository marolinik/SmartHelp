import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  categoryId: string;
  category: {
    id: string;
    name: string;
    description: string;
  };
  customerId: string;
  customer: {
    id: string;
    displayName: string;
    email: string;
    department: string;
  };
  assignedToId?: string;
  assignedTo?: {
    id: string;
    displayName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  slaResponseDue: string;
  slaResolutionDue: string;
  resolution?: string;
  attachments: string[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  content: string;
  authorId: string;
  author: {
    id: string;
    displayName: string;
  };
  isInternal: boolean;
  createdAt: string;
}

interface TicketState {
  tickets: Ticket[];
  currentTicket: Ticket | null;
  comments: TicketComment[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    status?: string;
    priority?: string;
    categoryId?: string;
    assignedToId?: string;
    search?: string;
  };
}

const initialState: TicketState = {
  tickets: [],
  currentTicket: null,
  comments: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrev: false,
  },
  filters: {},
};

// Async thunks will be added when we create the ticket service
export const fetchTickets = createAsyncThunk(
  'tickets/fetchTickets',
  async (params: { page?: number; limit?: number; filters?: any }, { rejectWithValue }) => {
    try {
      // This will be implemented when we create the ticket service
      return { tickets: [], pagination: initialState.pagination };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Грешка при учитавању тикета');
    }
  }
);

const ticketSlice = createSlice({
  name: 'tickets',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action: PayloadAction<any>) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    setCurrentTicket: (state, action: PayloadAction<Ticket | null>) => {
      state.currentTicket = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTickets.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tickets = action.payload.tickets;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setFilters, clearFilters, setCurrentTicket } = ticketSlice.actions;
export default ticketSlice.reducer; 