/**
 * Agent Profile and Performance Models
 * Defines data structures for smart ticket routing system
 */

export interface AgentSkill {
  id: string;
  name: string;
  displayName: string; // Serbian display name
  category: 'hardware' | 'software' | 'network' | 'security' | 'email' | 'training' | 'other';
  description: string;
}

export interface AgentSkillLevel {
  skillId: string;
  agentId: string;
  level: 1 | 2 | 3 | 4 | 5; // 1=Basic, 2=Intermediate, 3=Advanced, 4=Expert, 5=Master
  certifiedDate?: string;
  lastUpdated: string;
  certificationSource?: string; // e.g., "Обука", "Сертификат", "Искуство"
}

export interface WorkingSchedule {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, etc.
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isActive: boolean;
  timezone: string; // Default: "Europe/Belgrade"
}

export interface AgentAvailability {
  agentId: string;
  currentStatus: 'available' | 'busy' | 'away' | 'offline';
  lastStatusUpdate: string;
  workingSchedule: WorkingSchedule[];
  maxConcurrentTickets: number;
  currentTicketCount: number;
  isOnVacation: boolean;
  vacationStartDate?: string;
  vacationEndDate?: string;
  notes?: string; // Serbian notes about availability
}

export interface PerformanceMetrics {
  agentId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  periodStartDate: string;
  periodEndDate: string;
  
  // Ticket handling metrics
  ticketsAssigned: number;
  ticketsResolved: number;
  ticketsEscalated: number;
  ticketsCancelled: number;
  
  // Time metrics (in minutes)
  averageResponseTime: number;
  averageResolutionTime: number;
  
  // Quality metrics
  customerSatisfactionRating: number; // 1-5 scale
  firstCallResolutionRate: number; // Percentage
  slaComplianceRate: number; // Percentage
  
  // Workload metrics
  totalWorkingHours: number;
  totalTicketTime: number;
  utilizationRate: number; // Percentage
  
  // Category-specific performance
  categoryPerformance: Array<{
    categoryId: string;
    ticketsHandled: number;
    averageResolutionTime: number;
    successRate: number;
  }>;
  
  // Serbian comments
  managerNotes?: string;
  selfAssessmentNotes?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface AgentProfile {
  id: string;
  userId: string; // Reference to User table
  
  // Basic info
  displayName: string;
  department: string;
  jobTitle: string;
  email: string;
  phoneNumber?: string;
  
  // Agent settings
  isActive: boolean;
  startDate: string;
  endDate?: string; // If agent is no longer active
  
  // Experience and seniority
  experienceLevel: 'junior' | 'intermediate' | 'senior' | 'lead' | 'expert';
  yearsOfExperience: number;
  primaryLanguages: string[]; // e.g., ["sr", "en"]
  
  // Preferences
  preferredCategories: string[]; // Category IDs agent prefers
  preferredWorkload: 'light' | 'medium' | 'heavy';
  canHandleUrgentTickets: boolean;
  canMentorJuniors: boolean;
  
  // Contact preferences  
  preferredContactMethod: 'email' | 'slack' | 'teams' | 'sms';
  workingHoursContactOnly: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

export interface RoutingWeight {
  id: string;
  name: string;
  displayName: string; // Serbian name
  description: string;
  
  // Weight factors (0.0 to 1.0)
  skillMatchWeight: number;
  workloadWeight: number;
  performanceWeight: number;
  availabilityWeight: number;
  categoryExperienceWeight: number;
  
  // Modifier settings
  urgentTicketModifier: number; // Multiplier for urgent tickets
  newAgentPenalty: number; // Penalty for agents with < 30 days experience
  highPerformerBonus: number; // Bonus for top performers
  
  // Constraints
  maxWorkloadThreshold: number; // Maximum workload percentage
  skillLevelThreshold: number; // Minimum skill level required
  
  isDefault: boolean;
  isActive: boolean;
  applicableCategories?: string[]; // If specific to certain categories
  
  createdAt: string;
  updatedAt: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  displayName: string; // Serbian name
  description: string;
  
  // Rule conditions
  conditions: {
    ticketPriority?: 'low' | 'medium' | 'high' | 'urgent';
    ticketCategory?: string[];
    timeOfDay?: {
      startTime: string;
      endTime: string;
    };
    dayOfWeek?: number[]; // 0-6
    requiredSkillLevel?: number; // Minimum skill level
    customerTier?: 'basic' | 'premium' | 'enterprise';
  };
  
  // Rule actions
  actions: {
    assignmentStrategy: 'round_robin' | 'skill_based' | 'workload_based' | 'random' | 'manual';
    preferredAgents?: string[]; // Agent IDs
    excludedAgents?: string[]; // Agent IDs
    escalationDelay?: number; // Minutes before escalation
    maxReassignments?: number;
    notificationTemplate?: string;
  };
  
  // Rule properties
  priority: number; // Higher number = higher priority
  isActive: boolean;
  validFromDate?: string;
  validToDate?: string;
  
  // Usage tracking
  timesTriggered: number;
  lastTriggered?: string;
  successRate: number; // Percentage of successful assignments
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RoutingDecision {
  id: string;
  ticketId: string;
  
  // Decision context
  decisionTimestamp: string;
  routingEngine: string; // "auto" | "manual" | "rule-based"
  triggeredRuleId?: string;
  weightConfigId?: string;
  
  // Available agents at decision time
  availableAgents: Array<{
    agentId: string;
    score: number;
    reasons: string[]; // Serbian reasons for the score
    skillMatch: number;
    workloadScore: number;
    performanceScore: number;
    availabilityScore: number;
  }>;
  
  // Final decision
  selectedAgentId: string;
  selectionReason: string; // Serbian explanation
  confidence: number; // 0-1 score
  
  // Override information
  wasOverridden: boolean;
  overriddenBy?: string; // User ID
  overrideReason?: string; // Serbian reason
  originalAgentId?: string;
  
  // Outcome tracking
  wasAccepted: boolean;
  acceptanceTime?: string;
  reassignmentCount: number;
  finalResolution?: {
    resolutionTime: number;
    customerSatisfaction?: number;
    wasEscalated: boolean;
  };
  
  createdAt: string;
}

export interface RoutingStatistics {
  agentId: string;
  period: string; // YYYY-MM format
  
  // Assignment statistics
  ticketsReceived: number;
  ticketsAccepted: number;
  ticketsDeclined: number;
  ticketsReassigned: number;
  
  // Performance in routing context
  averageAssignmentScore: number;
  acceptanceRate: number; // Percentage
  averageTimeToAccept: number; // Minutes
  
  // Category breakdown
  categoryStats: Array<{
    categoryId: string;
    ticketsReceived: number;
    successRate: number;
    averageScore: number;
  }>;
  
  // Comparison metrics
  rankAmongPeers: number; // 1-based ranking
  percentilePerformance: number; // 0-100
  
  generatedAt: string;
}

// Utility types
export type AgentStatus = 'available' | 'busy' | 'away' | 'offline';
export type SkillCategory = 'hardware' | 'software' | 'network' | 'security' | 'email' | 'training' | 'other';
export type ExperienceLevel = 'junior' | 'intermediate' | 'senior' | 'lead' | 'expert';
export type AssignmentStrategy = 'round_robin' | 'skill_based' | 'workload_based' | 'random' | 'manual';

export default {
  AgentSkill,
  AgentSkillLevel,
  WorkingSchedule,
  AgentAvailability,
  PerformanceMetrics,
  AgentProfile,
  RoutingWeight,
  RoutingRule,
  RoutingDecision,
  RoutingStatistics
}; 