/**
 * Workload Calculation Service
 * Calculates agent workload and capacity for intelligent ticket routing
 */

import { 
  AgentAvailability, 
  WorkingSchedule, 
  PerformanceMetrics,
  AgentProfile 
} from '../../models/agentProfile';
import agentProfileService from './agentProfileService';
import { logger } from '../../utils/logger';

interface WorkloadCalculation {
  agentId: string;
  calculatedAt: string;
  
  // Current workload metrics
  currentTicketCount: number;
  maxConcurrentTickets: number;
  utilizationPercentage: number; // 0-100%
  
  // Capacity metrics
  availableCapacity: number; // Remaining ticket slots
  capacityScore: number; // 0-1 score (1 = full capacity available)
  
  // Time-based availability
  isCurrentlyWorking: boolean;
  hoursUntilNextAvailable: number;
  nextAvailableTime?: string;
  
  // Workload quality factors
  averageTicketComplexity: number; // 1-5 scale
  urgentTicketCount: number;
  overdueTicketCount: number;
  
  // Performance impact
  recentPerformanceScore: number; // 0-1 based on recent metrics
  stressLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAssignment: boolean;
  
  // Serbian explanations
  statusExplanation: string;
  recommendationReason: string;
}

interface TicketWorkloadImpact {
  ticketId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  estimatedComplexity: number; // 1-5 scale
  estimatedResolutionTime: number; // minutes
  workloadWeight: number; // How much this ticket counts toward capacity
}

interface TimeSlot {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  dayOfWeek: number; // 0-6
  isAvailable: boolean;
  capacity: number; // Percentage of normal capacity
}

export class WorkloadCalculationService {
  
  /**
   * Calculate comprehensive workload for an agent
   */
  async calculateAgentWorkload(agentId: string): Promise<WorkloadCalculation | null> {
    try {
      // Get agent data
      const [profile, availability] = await Promise.all([
        agentProfileService.getAgentProfile(agentId),
        agentProfileService.getAgentAvailability(agentId)
      ]);

      if (!profile || !availability) {
        logger.warn(`Missing data for agent ${agentId}`);
        return null;
      }

      const currentTime = new Date();
      const calculatedAt = currentTime.toISOString();

      // Calculate basic workload metrics
      const utilizationPercentage = (availability.currentTicketCount / availability.maxConcurrentTickets) * 100;
      const availableCapacity = availability.maxConcurrentTickets - availability.currentTicketCount;
      const capacityScore = Math.max(0, availableCapacity / availability.maxConcurrentTickets);

      // Calculate time-based availability
      const timeAvailability = this.calculateTimeAvailability(availability.workingSchedule, currentTime);
      
      // Get current tickets and calculate complexity
      const ticketMetrics = await this.calculateTicketComplexity(agentId);
      
      // Calculate recent performance impact
      const performanceScore = await this.calculatePerformanceScore(agentId);
      
      // Determine stress level
      const stressLevel = this.calculateStressLevel(utilizationPercentage, ticketMetrics);
      
      // Generate recommendations
      const recommendedAssignment = this.shouldRecommendAssignment(
        utilizationPercentage, 
        timeAvailability.isCurrentlyWorking,
        stressLevel,
        profile.isActive
      );

      // Generate Serbian explanations
      const explanations = this.generateSerbianExplanations(
        utilizationPercentage,
        stressLevel,
        timeAvailability.isCurrentlyWorking,
        recommendedAssignment
      );

      const result: WorkloadCalculation = {
        agentId,
        calculatedAt,
        currentTicketCount: availability.currentTicketCount,
        maxConcurrentTickets: availability.maxConcurrentTickets,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        availableCapacity,
        capacityScore: Math.round(capacityScore * 100) / 100,
        isCurrentlyWorking: timeAvailability.isCurrentlyWorking,
        hoursUntilNextAvailable: timeAvailability.hoursUntilNextAvailable,
        averageTicketComplexity: ticketMetrics.averageComplexity,
        urgentTicketCount: ticketMetrics.urgentCount,
        overdueTicketCount: ticketMetrics.overdueCount,
        recentPerformanceScore: performanceScore,
        stressLevel,
        recommendedAssignment,
        statusExplanation: explanations.statusExplanation,
        recommendationReason: explanations.recommendationReason
      };

      if (timeAvailability.nextAvailableTime) {
        result.nextAvailableTime = timeAvailability.nextAvailableTime;
      }

      return result;

    } catch (error) {
      logger.error(`Error calculating workload for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Calculate workload for all active agents
   */
  async calculateAllAgentWorkloads(): Promise<WorkloadCalculation[]> {
    try {
      const profiles = await agentProfileService.getAllAgentProfiles();
      const activeAgents = profiles.filter(p => p.isActive);
      
      const workloads: WorkloadCalculation[] = [];
      
      for (const agent of activeAgents) {
        const workload = await this.calculateAgentWorkload(agent.id);
        if (workload) {
          workloads.push(workload);
        }
      }

      return workloads.sort((a, b) => a.utilizationPercentage - b.utilizationPercentage);
    } catch (error) {
      logger.error('Error calculating all agent workloads:', error);
      return [];
    }
  }

  /**
   * Get agents with available capacity sorted by best capacity
   */
  async getAgentsWithCapacity(minimumCapacity: number = 1): Promise<WorkloadCalculation[]> {
    const workloads = await this.calculateAllAgentWorkloads();
    
    return workloads
      .filter(w => w.availableCapacity >= minimumCapacity && w.recommendedAssignment)
      .sort((a, b) => {
        // Sort by capacity score (higher is better), then by performance
        if (b.capacityScore !== a.capacityScore) {
          return b.capacityScore - a.capacityScore;
        }
        return b.recentPerformanceScore - a.recentPerformanceScore;
      });
  }

  /**
   * Calculate time-based availability
   */
  private calculateTimeAvailability(schedule: WorkingSchedule[], currentTime: Date): {
    isCurrentlyWorking: boolean;
    hoursUntilNextAvailable: number;
    nextAvailableTime?: string;
  } {
    const now = new Date(currentTime);
    const currentDay = now.getDay(); // 0 = Sunday
    const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM format
    
    // Find today's schedule
    const todaySchedule = schedule.find(s => s.dayOfWeek === currentDay && s.isActive);
    
    if (todaySchedule) {
      const isCurrentlyWorking = 
        currentTimeStr >= todaySchedule.startTime && 
        currentTimeStr <= todaySchedule.endTime;
      
      if (isCurrentlyWorking) {
        return {
          isCurrentlyWorking: true,
          hoursUntilNextAvailable: 0
        };
      }
    }

    // Find next available time
    const nextAvailable = this.findNextAvailableTime(schedule, now);
    
    const result: { isCurrentlyWorking: boolean; hoursUntilNextAvailable: number; nextAvailableTime?: string } = {
      isCurrentlyWorking: false,
      hoursUntilNextAvailable: nextAvailable.hoursUntil
    };

    if (nextAvailable.timeString) {
      result.nextAvailableTime = nextAvailable.timeString;
    }

    return result;
  }

  /**
   * Find the next available working time
   */
  private findNextAvailableTime(schedule: WorkingSchedule[], currentTime: Date): {
    hoursUntil: number;
    timeString?: string;
  } {
    const now = new Date(currentTime);
    const currentDay = now.getDay();
    const currentTimeStr = now.toTimeString().slice(0, 5);

    // Check remaining time today
    const todaySchedule = schedule.find(s => s.dayOfWeek === currentDay && s.isActive);
    if (todaySchedule && currentTimeStr < todaySchedule.startTime) {
      const timeParts = todaySchedule.startTime.split(':');
      const hour = parseInt(timeParts[0] || '0', 10);
      const minute = parseInt(timeParts[1] || '0', 10);
      const nextTime = new Date(now);
      nextTime.setHours(hour, minute, 0, 0);
      
      const hoursUntil = (nextTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      return {
        hoursUntil: Math.max(0, hoursUntil),
        timeString: nextTime.toISOString()
      };
    }

    // Check next 7 days
    for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
      const checkDay = (currentDay + daysAhead) % 7;
      const daySchedule = schedule.find(s => s.dayOfWeek === checkDay && s.isActive);
      
      if (daySchedule) {
        const timeParts = daySchedule.startTime.split(':');
        const hour = parseInt(timeParts[0] || '0', 10);
        const minute = parseInt(timeParts[1] || '0', 10);
        const nextTime = new Date(now);
        nextTime.setDate(nextTime.getDate() + daysAhead);
        nextTime.setHours(hour, minute, 0, 0);
        
        const hoursUntil = (nextTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        return {
          hoursUntil,
          timeString: nextTime.toISOString()
        };
      }
    }

    // No schedule found in next 7 days
    return { hoursUntil: 999 };
  }

  /**
   * Calculate ticket complexity metrics (simulated for now)
   */
  private async calculateTicketComplexity(agentId: string): Promise<{
    averageComplexity: number;
    urgentCount: number;
    overdueCount: number;
  }> {
    // TODO: Integrate with actual ticket service
    // For now, return realistic sample data based on agent workload
    
    const availability = await agentProfileService.getAgentAvailability(agentId);
    if (!availability) {
      return { averageComplexity: 2.5, urgentCount: 0, overdueCount: 0 };
    }

    const ticketCount = availability.currentTicketCount;
    
    // Simulate complexity based on current workload
    const averageComplexity = Math.min(5, 2 + (ticketCount / availability.maxConcurrentTickets) * 2);
    const urgentCount = Math.floor(ticketCount * 0.2); // 20% urgent tickets
    const overdueCount = Math.floor(ticketCount * 0.1); // 10% overdue

    return {
      averageComplexity: Math.round(averageComplexity * 10) / 10,
      urgentCount,
      overdueCount
    };
  }

  /**
   * Calculate recent performance score
   */
  private async calculatePerformanceScore(agentId: string): Promise<number> {
    // TODO: Integrate with actual performance metrics
    // For now, return simulated score based on agent experience
    
    const profile = await agentProfileService.getAgentProfile(agentId);
    if (!profile) return 0.5;

    // Base score on experience level
    const experienceScores = {
      'junior': 0.6,
      'intermediate': 0.7,
      'senior': 0.8,
      'lead': 0.9,
      'expert': 0.95
    };

    return experienceScores[profile.experienceLevel] || 0.5;
  }

  /**
   * Calculate stress level based on workload factors
   */
  private calculateStressLevel(
    utilizationPercentage: number,
    ticketMetrics: { urgentCount: number; overdueCount: number; averageComplexity: number }
  ): 'low' | 'medium' | 'high' | 'critical' {
    let stressPoints = 0;

    // Utilization stress
    if (utilizationPercentage > 90) stressPoints += 3;
    else if (utilizationPercentage > 75) stressPoints += 2;
    else if (utilizationPercentage > 50) stressPoints += 1;

    // Urgent tickets stress
    if (ticketMetrics.urgentCount > 3) stressPoints += 2;
    else if (ticketMetrics.urgentCount > 1) stressPoints += 1;

    // Overdue tickets stress
    if (ticketMetrics.overdueCount > 0) stressPoints += 2;

    // Complexity stress
    if (ticketMetrics.averageComplexity > 4) stressPoints += 2;
    else if (ticketMetrics.averageComplexity > 3) stressPoints += 1;

    // Determine stress level
    if (stressPoints >= 6) return 'critical';
    if (stressPoints >= 4) return 'high';
    if (stressPoints >= 2) return 'medium';
    return 'low';
  }

  /**
   * Determine if agent should be recommended for assignment
   */
  private shouldRecommendAssignment(
    utilizationPercentage: number,
    isCurrentlyWorking: boolean,
    stressLevel: 'low' | 'medium' | 'high' | 'critical',
    isActive: boolean
  ): boolean {
    if (!isActive) return false;
    if (!isCurrentlyWorking) return false;
    if (stressLevel === 'critical') return false;
    if (utilizationPercentage >= 100) return false;
    if (utilizationPercentage >= 90 && stressLevel === 'high') return false;
    
    return true;
  }

  /**
   * Generate Serbian language explanations
   */
  private generateSerbianExplanations(
    utilizationPercentage: number,
    stressLevel: 'low' | 'medium' | 'high' | 'critical',
    isCurrentlyWorking: boolean,
    recommendedAssignment: boolean
  ): { statusExplanation: string; recommendationReason: string } {
    
    let statusExplanation = '';
    let recommendationReason = '';

    // Status explanation
    if (!isCurrentlyWorking) {
      statusExplanation = 'Агент тренутно није у радном времену';
    } else if (utilizationPercentage >= 100) {
      statusExplanation = 'Агент је потпуно заузет - нема слободног капацитета';
    } else if (utilizationPercentage >= 90) {
      statusExplanation = 'Агент је веома заузет - ограничен капацитет';
    } else if (utilizationPercentage >= 75) {
      statusExplanation = 'Агент је умерено заузет';
    } else if (utilizationPercentage >= 50) {
      statusExplanation = 'Агент има добар капацитет';
    } else {
      statusExplanation = 'Агент има висок расположиви капацитет';
    }

    // Add stress level context
    const stressDescriptions = {
      'low': 'ниво стреса низак',
      'medium': 'ниво стреса умерен',
      'high': 'ниво стреса висок',
      'critical': 'ниво стреса критичан'
    };
    statusExplanation += ` (${stressDescriptions[stressLevel]})`;

    // Recommendation reason
    if (!recommendedAssignment) {
      if (!isCurrentlyWorking) {
        recommendationReason = 'Није препоручено: агент није у радном времену';
      } else if (utilizationPercentage >= 100) {
        recommendationReason = 'Није препоручено: агент је потпуно заузет';
      } else if (stressLevel === 'critical') {
        recommendationReason = 'Није препоручено: критичан ниво стреса';
      } else if (stressLevel === 'high' && utilizationPercentage >= 90) {
        recommendationReason = 'Није препоручено: висок стрес и заузетост';
      } else {
        recommendationReason = 'Није препоручено: неповољни услови';
      }
    } else {
      if (utilizationPercentage <= 25) {
        recommendationReason = 'Препоручено: агент има висок капацитет';
      } else if (utilizationPercentage <= 50) {
        recommendationReason = 'Препоручено: агент има добар капацитет';
      } else if (utilizationPercentage <= 75) {
        recommendationReason = 'Препоручено: агент је доступан';
      } else {
        recommendationReason = 'Условно препоручено: ограничен капацитет';
      }
    }

    return { statusExplanation, recommendationReason };
  }

  /**
   * Simulate ticket assignment impact
   */
  async simulateTicketAssignment(
    agentId: string, 
    ticketImpact: TicketWorkloadImpact
  ): Promise<WorkloadCalculation | null> {
    const currentWorkload = await this.calculateAgentWorkload(agentId);
    if (!currentWorkload) return null;

    // Simulate the impact of assigning this ticket
    const newTicketCount = currentWorkload.currentTicketCount + 1;
    const newUtilization = (newTicketCount / currentWorkload.maxConcurrentTickets) * 100;
    
    // Calculate impact on complexity
    const totalComplexity = currentWorkload.averageTicketComplexity * currentWorkload.currentTicketCount;
    const newAverageComplexity = (totalComplexity + ticketImpact.estimatedComplexity) / newTicketCount;
    
    // Update urgent count if needed
    const newUrgentCount = currentWorkload.urgentTicketCount + 
      (ticketImpact.priority === 'urgent' ? 1 : 0);

    return {
      ...currentWorkload,
      currentTicketCount: newTicketCount,
      utilizationPercentage: Math.round(newUtilization * 100) / 100,
      availableCapacity: Math.max(0, currentWorkload.maxConcurrentTickets - newTicketCount),
      capacityScore: Math.max(0, (currentWorkload.maxConcurrentTickets - newTicketCount) / currentWorkload.maxConcurrentTickets),
      averageTicketComplexity: Math.round(newAverageComplexity * 10) / 10,
      urgentTicketCount: newUrgentCount,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * Get workload distribution across all agents
   */
  async getWorkloadDistribution(): Promise<{
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    utilizationPercentage: number;
    agentDistribution: Array<{
      agentId: string;
      displayName: string;
      utilization: number;
      status: string;
    }>;
  }> {
    try {
      const workloads = await this.calculateAllAgentWorkloads();
      const profiles = await agentProfileService.getAllAgentProfiles();
      
      const totalCapacity = workloads.reduce((sum, w) => sum + w.maxConcurrentTickets, 0);
      const usedCapacity = workloads.reduce((sum, w) => sum + w.currentTicketCount, 0);
      const availableCapacity = totalCapacity - usedCapacity;
      const utilizationPercentage = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

      const agentDistribution = workloads.map(w => {
        const profile = profiles.find(p => p.id === w.agentId);
        return {
          agentId: w.agentId,
          displayName: profile?.displayName || w.agentId,
          utilization: w.utilizationPercentage,
          status: w.isCurrentlyWorking ? 'Ради' : 'Ван радног времена'
        };
      });

      return {
        totalCapacity,
        usedCapacity,
        availableCapacity,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        agentDistribution
      };
    } catch (error) {
      logger.error('Error getting workload distribution:', error);
      throw new Error('Failed to get workload distribution');
    }
  }
}

export default new WorkloadCalculationService(); 