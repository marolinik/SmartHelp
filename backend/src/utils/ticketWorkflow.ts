// Ticket workflow management with Serbian language support
export type TicketStatus = 
  | 'new' 
  | 'assigned' 
  | 'in_progress' 
  | 'pending_user' 
  | 'pending_vendor' 
  | 'resolved' 
  | 'closed' 
  | 'on_hold' 
  | 'cancelled';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

// Serbian labels for ticket statuses
export const statusLabels: Record<TicketStatus, string> = {
  new: 'Нов',
  assigned: 'Додељен',
  in_progress: 'У раду',
  pending_user: 'Чека корисника',
  pending_vendor: 'Чека добављача',
  resolved: 'Решен',
  closed: 'Затворен',
  on_hold: 'На чекању',
  cancelled: 'Отказан'
};

// Serbian labels for priorities
export const priorityLabels: Record<TicketPriority, string> = {
  low: 'Низак',
  medium: 'Средњи',
  high: 'Висок',
  critical: 'Критичан'
};

// Colors for status display (for frontend)
export const statusColors: Record<TicketStatus, string> = {
  new: '#2196F3',        // Blue
  assigned: '#FF9800',   // Orange
  in_progress: '#4CAF50', // Green
  pending_user: '#FFC107', // Amber
  pending_vendor: '#9C27B0', // Purple
  resolved: '#8BC34A',   // Light Green
  closed: '#607D8B',     // Blue Grey
  on_hold: '#795548',    // Brown
  cancelled: '#F44336'   // Red
};

// Valid status transitions
export const validTransitions: Record<TicketStatus, TicketStatus[]> = {
  new: ['assigned', 'in_progress', 'on_hold', 'cancelled'],
  assigned: ['in_progress', 'pending_user', 'on_hold', 'cancelled'],
  in_progress: ['pending_user', 'pending_vendor', 'resolved', 'on_hold', 'cancelled'],
  pending_user: ['in_progress', 'resolved', 'on_hold', 'cancelled'],
  pending_vendor: ['in_progress', 'resolved', 'on_hold', 'cancelled'],
  resolved: ['closed', 'in_progress'], // Can reopen if needed
  closed: [], // Final state - cannot be changed
  on_hold: ['in_progress', 'assigned', 'cancelled'],
  cancelled: [] // Final state - cannot be changed
};

// Workflow validation functions
export class TicketWorkflow {
  /**
   * Check if status transition is valid
   */
  static isValidTransition(fromStatus: TicketStatus, toStatus: TicketStatus): boolean {
    const allowedTransitions = validTransitions[fromStatus];
    return allowedTransitions.includes(toStatus);
  }

  /**
   * Get allowed next statuses for current status
   */
  static getAllowedTransitions(currentStatus: TicketStatus): TicketStatus[] {
    return validTransitions[currentStatus] || [];
  }

  /**
   * Get Serbian label for status
   */
  static getStatusLabel(status: TicketStatus): string {
    return statusLabels[status] || status;
  }

  /**
   * Get Serbian label for priority
   */
  static getPriorityLabel(priority: TicketPriority): string {
    return priorityLabels[priority] || priority;
  }

  /**
   * Get color for status
   */
  static getStatusColor(status: TicketStatus): string {
    return statusColors[status] || '#757575';
  }

  /**
   * Validate status transition and return error message if invalid
   */
  static validateStatusTransition(fromStatus: TicketStatus, toStatus: TicketStatus): { 
    valid: boolean; 
    error?: string; 
  } {
    if (fromStatus === toStatus) {
      return { valid: true };
    }

    if (!this.isValidTransition(fromStatus, toStatus)) {
      return {
        valid: false,
        error: `Неважећа промена статуса са "${this.getStatusLabel(fromStatus)}" на "${this.getStatusLabel(toStatus)}"`
      };
    }

    return { valid: true };
  }

  /**
   * Get workflow description for status
   */
  static getStatusDescription(status: TicketStatus): string {
    const descriptions: Record<TicketStatus, string> = {
      new: 'Тикет је креиран и чека доделу',
      assigned: 'Тикет је додељен агенту',
      in_progress: 'Агент ради на решавању тикета',
      pending_user: 'Чека се одговор или акција од корисника',
      pending_vendor: 'Чека се одговор или акција од спољног добављача',
      resolved: 'Тикет је решен и чека потврду',
      closed: 'Тикет је затворен и завршен',
      on_hold: 'Рад на тикету је привремено заустављен',
      cancelled: 'Тикет је отказан'
    };

    return descriptions[status] || '';
  }

  /**
   * Check if status is final (cannot be changed)
   */
  static isFinalStatus(status: TicketStatus): boolean {
    return validTransitions[status].length === 0;
  }

  /**
   * Check if user can perform status transition based on role
   */
  static canUserChangeStatus(userRole: string, fromStatus: TicketStatus, toStatus: TicketStatus): boolean {
    // Admin can change any status
    if (userRole === 'admin') {
      return true;
    }

    // Agents can change most statuses
    if (['l1_agent', 'l2_specialist', 'l3_expert'].includes(userRole)) {
      // Cannot change from final statuses
      if (this.isFinalStatus(fromStatus)) {
        return false;
      }
      return true;
    }

    // End users can only change limited statuses
    if (userRole === 'end_user') {
      // Can only move from pending_user to in_progress (providing feedback)
      if (fromStatus === 'pending_user' && toStatus === 'in_progress') {
        return true;
      }
      // Can cancel their own tickets if not final
      if (toStatus === 'cancelled' && !this.isFinalStatus(fromStatus)) {
        return true;
      }
      return false;
    }

    return false;
  }

  /**
   * Get all available statuses with Serbian labels
   */
  static getAllStatuses(): Array<{ value: TicketStatus; label: string; description: string; color: string }> {
    return Object.keys(statusLabels).map(status => ({
      value: status as TicketStatus,
      label: this.getStatusLabel(status as TicketStatus),
      description: this.getStatusDescription(status as TicketStatus),
      color: this.getStatusColor(status as TicketStatus)
    }));
  }

  /**
   * Get all available priorities with Serbian labels
   */
  static getAllPriorities(): Array<{ value: TicketPriority; label: string }> {
    return Object.keys(priorityLabels).map(priority => ({
      value: priority as TicketPriority,
      label: this.getPriorityLabel(priority as TicketPriority)
    }));
  }
} 