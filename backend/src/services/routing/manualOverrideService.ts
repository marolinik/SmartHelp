/**
 * Manual Override and Load Balancing Service
 * Provides manual intervention and automated load distribution features
 */

import { TicketService } from '../ticketService';
import ticketRoutingService from './ticketRoutingService';
import agentProfileService from './agentProfileService';
import workloadCalculationService from './workloadCalculationService';
import smartRoutingEngine from './smartRoutingEngine';
import routingNotificationService from './routingNotificationService';
import { logger } from '../../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface ManualOverride {
  id: string;
  ticketId: string;
  fromAgentId?: string;
  toAgentId: string;
  supervisorId: string;
  reason: string;
  overrideType: 'manual_reassign' | 'emergency_escalation' | 'load_balancing' | 'supervisor_decision';
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Context information
  originalRoutingReason?: string;
  originalRoutingConfidence?: number;
  newRoutingReason: string;
  
  // Timestamps
  requestedAt: string;
  processedAt?: string;
  
  // Approval workflow (for non-emergency overrides)
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'cancelled';
  notes?: string;
}

interface LoadBalancingConfig {
  id: string;
  name: string;
  displayName: string; // Serbian name
  description: string;
  
  strategy: 'round_robin' | 'least_loaded' | 'weighted_distribution' | 'skill_based_balancing';
  isActive: boolean;
  
  // Configuration parameters
  maxWorkloadDifferencePercent: number; // Max difference between agents (e.g., 20%)
  rebalanceInterval: number; // Minutes between automatic rebalancing
  emergencyThreshold: number; // Workload % that triggers emergency redistribution
  
  // Agent groups and weights
  agentWeights: Array<{
    agentId: string;
    weight: number; // 0.5-2.0, where 1.0 is normal capacity
    maxConcurrentTickets?: number; // Override default max
  }>;
  
  // Time-based rules
  businessHours: {
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    timezone: string;
    weekdays: number[]; // 0-6, 0=Sunday
  };
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface LoadBalancingAction {
  id: string;
  configId: string;
  actionType: 'manual_rebalance' | 'automatic_rebalance' | 'emergency_redistribution';
  triggeredBy: string;
  triggeredAt: string;
  
  // Before and after state
  beforeState: {
    totalTickets: number;
    agentWorkloads: Array<{
      agentId: string;
      utilizationPercent: number;
      ticketCount: number;
    }>;
  };
  
  actions: Array<{
    ticketId: string;
    fromAgentId: string;
    toAgentId: string;
    reason: string;
    success: boolean;
    error?: string;
  }>;
  
  afterState: {
    totalTickets: number;
    agentWorkloads: Array<{
      agentId: string;
      utilizationPercent: number;
      ticketCount: number;
    }>;
  };
  
  // Results
  totalTicketsMoved: number;
  successfulMoves: number;
  failedMoves: number;
  improvementPercent: number; // Reduction in workload variance
  
  processingTime: number; // milliseconds
  processedAt: string;
}

export class ManualOverrideService {
  private ticketService: TicketService;
  private dataDir: string;
  private overridesPath: string;
  private balancingConfigsPath: string;
  private balancingActionsPath: string;

  constructor() {
    this.ticketService = new TicketService();
    this.dataDir = path.join(__dirname, '../../../..', 'data/routing');
    this.overridesPath = path.join(this.dataDir, 'manual-overrides.json');
    this.balancingConfigsPath = path.join(this.dataDir, 'load-balancing-configs.json');
    this.balancingActionsPath = path.join(this.dataDir, 'load-balancing-actions.json');
    this.ensureDirectoriesExist();
  }

  /**
   * Ensure routing data directories exist
   */
  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating routing directories:', error);
    }
  }

  /**
   * Load data from JSON file with default fallback
   */
  private async loadData<T>(filePath: string, defaultValue: T[] = []): Promise<T[]> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Save data to JSON file
   */
  private async saveData<T>(filePath: string, data: T[]): Promise<void> {
    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonData, 'utf-8');
  }

  /**
   * Request manual override for ticket assignment
   */
  async requestManualOverride(request: {
    ticketId: string;
    toAgentId: string;
    supervisorId: string;
    reason: string;
    overrideType: 'manual_reassign' | 'emergency_escalation' | 'supervisor_decision';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    requiresApproval?: boolean;
  }): Promise<{
    success: boolean;
    overrideId?: string;
    message: string;
    error?: string;
  }> {
    try {
      // Get current ticket information
      const ticket = await this.ticketService.getTicketById(request.ticketId);
      if (!ticket) {
        return {
          success: false,
          message: 'Тикет није пронађен',
          error: 'Ticket not found'
        };
      }

      // Validate target agent
      const targetAgent = await agentProfileService.getAgentProfile(request.toAgentId);
      if (!targetAgent || !targetAgent.isActive) {
        return {
          success: false,
          message: 'Циљни агент није доступан',
          error: 'Target agent not available'
        };
      }

      // Check agent workload before override
      const workload = await workloadCalculationService.calculateAgentWorkload(request.toAgentId);
      if (!workload || !workload.recommendedAssignment) {
        logger.warn(`Agent ${request.toAgentId} has high workload, proceeding with override anyway`);
      }

      const overrideId = uuidv4();
      const requiresApproval = request.requiresApproval !== false && 
                              request.overrideType !== 'emergency_escalation';

      const override: ManualOverride = {
        id: overrideId,
        ticketId: request.ticketId,
        fromAgentId: ticket.assignedTo || undefined,
        toAgentId: request.toAgentId,
        supervisorId: request.supervisorId,
        reason: request.reason,
        overrideType: request.overrideType,
        priority: request.priority || 'medium',
        newRoutingReason: `Мануелно преусмерено: ${request.reason}`,
        requestedAt: new Date().toISOString(),
        requiresApproval: requiresApproval,
        status: requiresApproval ? 'pending' : 'approved',
        notes: `Захтев од супервизора ${request.supervisorId}`
      };

      // Save override request
      const overrides = await this.loadData<ManualOverride>(this.overridesPath);
      overrides.push(override);
      await this.saveData(this.overridesPath, overrides);

      // If no approval required or emergency, process immediately
      if (!requiresApproval) {
        const processResult = await this.processOverride(overrideId);
        if (processResult.success) {
          return {
            success: true,
            overrideId,
            message: `Тикет успешно преусмерен агенту ${targetAgent.displayName}`
          };
        } else {
                     return {
             success: false,
             message: `Грешка при обради преусмеравања: ${processResult.message}`,
             error: processResult.error || 'Unknown processing error'
           };
        }
      }

      logger.info(`Manual override requested: ${overrideId} for ticket ${request.ticketId}`);

      return {
        success: true,
        overrideId,
        message: requiresApproval 
          ? 'Захтев за преусмеравање је послат на одобрење'
          : 'Захтев за преусмеравање је обрађен'
      };

    } catch (error) {
      logger.error('Error requesting manual override:', error);
      return {
        success: false,
        message: 'Грешка при захтеву за преусмеравање',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Approve manual override request
   */
  async approveOverride(
    overrideId: string, 
    approvedBy: string, 
    notes?: string
  ): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      const overrides = await this.loadData<ManualOverride>(this.overridesPath);
      const override = overrides.find(o => o.id === overrideId);

      if (!override) {
        return {
          success: false,
          message: 'Захтев за преусмеравање није пронађен',
          error: 'Override request not found'
        };
      }

      if (override.status !== 'pending') {
        return {
          success: false,
          message: `Захтев је већ ${override.status}`,
          error: `Override already ${override.status}`
        };
      }

      // Update override status
      override.approvedBy = approvedBy;
      override.approvedAt = new Date().toISOString();
      override.status = 'approved';
      if (notes) {
        override.notes = (override.notes || '') + `\nОдобрено: ${notes}`;
      }

      await this.saveData(this.overridesPath, overrides);

      // Process the approved override
      const processResult = await this.processOverride(overrideId);

             return {
         success: processResult.success,
         message: processResult.success 
           ? 'Захтев одобрен и тикет преусмерен'
           : `Захтев одобрен али је обрада неуспешна: ${processResult.message}`,
         error: processResult.error || undefined
       };

    } catch (error) {
      logger.error('Error approving override:', error);
      return {
        success: false,
        message: 'Грешка при одобравању преусмеравања',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process an approved override
   */
  private async processOverride(overrideId: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      const overrides = await this.loadData<ManualOverride>(this.overridesPath);
      const override = overrides.find(o => o.id === overrideId);

      if (!override || override.status !== 'approved') {
        return {
          success: false,
          message: 'Захтев није одобрен',
          error: 'Override not approved'
        };
      }

      // Update ticket assignment
      const updateResult = await this.ticketService.updateTicket(
        override.ticketId,
        { assignedTo: override.toAgentId },
        override.supervisorId
      );

      // Update override status
      override.processedAt = new Date().toISOString();
      override.status = 'processed';

      await this.saveData(this.overridesPath, overrides);

      logger.info(`Manual override processed: ${overrideId} - ticket ${override.ticketId} assigned to ${override.toAgentId}`);

      return {
        success: true,
        message: 'Тикет успешно преусмерен'
      };

    } catch (error) {
      logger.error('Error processing override:', error);
      return {
        success: false,
        message: 'Грешка при обради преусмеравања',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reject manual override request
   */
  async rejectOverride(
    overrideId: string, 
    rejectedBy: string, 
    reason: string
  ): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      const overrides = await this.loadData<ManualOverride>(this.overridesPath);
      const override = overrides.find(o => o.id === overrideId);

      if (!override) {
        return {
          success: false,
          message: 'Захтев за преусмеравање није пронађен',
          error: 'Override request not found'
        };
      }

      if (override.status !== 'pending') {
        return {
          success: false,
          message: `Захтев је већ ${override.status}`,
          error: `Override already ${override.status}`
        };
      }

      // Update override status
      override.rejectedBy = rejectedBy;
      override.rejectedAt = new Date().toISOString();
      override.rejectionReason = reason;
      override.status = 'rejected';

      await this.saveData(this.overridesPath, overrides);

      logger.info(`Manual override rejected: ${overrideId} by ${rejectedBy} - ${reason}`);

      return {
        success: true,
        message: 'Захтев за преусмеравање је одбачен'
      };

    } catch (error) {
      logger.error('Error rejecting override:', error);
      return {
        success: false,
        message: 'Грешка при одбацивању захтева',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform manual load balancing
   */
  async performLoadBalancing(request: {
    configId?: string;
    triggeredBy: string;
    reason: string;
    dryRun?: boolean;
  }): Promise<{
    success: boolean;
    actionId?: string;
    message: string;
    preview?: any;
    error?: string;
  }> {
    try {
      const startTime = Date.now();

      // Get load balancing configuration
      const configs = await this.loadData<LoadBalancingConfig>(this.balancingConfigsPath);
      const config = request.configId 
        ? configs.find(c => c.id === request.configId)
        : configs.find(c => c.isActive);

      if (!config) {
        return {
          success: false,
          message: 'Конфигурација за распоређивање оптерећења није пронађена',
          error: 'Load balancing config not found'
        };
      }

      // Get current workload state
      const workloads = await workloadCalculationService.calculateAllAgentWorkloads();
      const activeWorkloads = workloads.filter(w => w.recommendedAssignment);

      if (activeWorkloads.length < 2) {
        return {
          success: false,
          message: 'Недовољно доступних агената за распоређивање',
          error: 'Insufficient available agents'
        };
      }

      // Calculate variance and determine if rebalancing is needed
      const utilizationVariance = this.calculateUtilizationVariance(activeWorkloads);
      
      if (utilizationVariance < config.maxWorkloadDifferencePercent) {
        return {
          success: true,
          message: 'Распоређивање оптерећења није потребно - разлика је у прихватљивим границама',
          preview: {
            currentVariance: Math.round(utilizationVariance * 100) / 100,
            threshold: config.maxWorkloadDifferencePercent,
            needsRebalancing: false
          }
        };
      }

      // Identify tickets to move based on strategy
      const rebalancingPlan = this.generateRebalancingPlan(activeWorkloads, config);

      if (request.dryRun) {
        return {
          success: true,
          message: 'Приказ плана распоређивања (није извршено)',
          preview: {
            currentVariance: Math.round(utilizationVariance * 100) / 100,
            projectedVariance: Math.round(rebalancingPlan.projectedVariance * 100) / 100,
            ticketsToMove: rebalancingPlan.moves.length,
            moves: rebalancingPlan.moves,
            improvement: Math.round((utilizationVariance - rebalancingPlan.projectedVariance) * 100) / 100
          }
        };
      }

      // Execute rebalancing plan
      const actionId = uuidv4();
      const beforeState = {
        totalTickets: activeWorkloads.reduce((sum, w) => sum + w.currentTicketCount, 0),
        agentWorkloads: activeWorkloads.map(w => ({
          agentId: w.agentId,
          utilizationPercent: w.utilizationPercentage,
          ticketCount: w.currentTicketCount
        }))
      };

      const executionResults = await this.executeRebalancingPlan(rebalancingPlan, request.triggeredBy);

      // Get final state
      const finalWorkloads = await workloadCalculationService.calculateAllAgentWorkloads();
      const afterState = {
        totalTickets: finalWorkloads.reduce((sum, w) => sum + w.currentTicketCount, 0),
        agentWorkloads: finalWorkloads.map(w => ({
          agentId: w.agentId,
          utilizationPercent: w.utilizationPercentage,
          ticketCount: w.currentTicketCount
        }))
      };

      const finalVariance = this.calculateUtilizationVariance(finalWorkloads.filter(w => w.recommendedAssignment));
      const improvement = ((utilizationVariance - finalVariance) / utilizationVariance) * 100;

      // Save load balancing action
      const action: LoadBalancingAction = {
        id: actionId,
        configId: config.id,
        actionType: 'manual_rebalance',
        triggeredBy: request.triggeredBy,
        triggeredAt: new Date().toISOString(),
        beforeState,
        actions: executionResults,
        afterState,
        totalTicketsMoved: executionResults.length,
        successfulMoves: executionResults.filter(r => r.success).length,
        failedMoves: executionResults.filter(r => !r.success).length,
        improvementPercent: Math.round(improvement * 100) / 100,
        processingTime: Date.now() - startTime,
        processedAt: new Date().toISOString()
      };

      const actions = await this.loadData<LoadBalancingAction>(this.balancingActionsPath);
      actions.push(action);
      await this.saveData(this.balancingActionsPath, actions);

      logger.info(`Load balancing completed: ${actionId} - ${action.successfulMoves}/${action.totalTicketsMoved} tickets moved`);

      return {
        success: true,
        actionId,
        message: `Распоређивање извршено: ${action.successfulMoves}/${action.totalTicketsMoved} тикета премештено (${action.improvementPercent}% побољшање)`
      };

    } catch (error) {
      logger.error('Error performing load balancing:', error);
      return {
        success: false,
        message: 'Грешка при распоређивању оптерећења',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate utilization variance among agents
   */
  private calculateUtilizationVariance(workloads: any[]): number {
    if (workloads.length === 0) return 0;

    const utilizationValues = workloads.map(w => w.utilizationPercentage);
    const mean = utilizationValues.reduce((sum, val) => sum + val, 0) / utilizationValues.length;
    const variance = utilizationValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / utilizationValues.length;
    
    return Math.sqrt(variance); // Standard deviation
  }

  /**
   * Generate rebalancing plan based on strategy
   */
  private generateRebalancingPlan(workloads: any[], config: LoadBalancingConfig): {
    moves: Array<{
      ticketId: string;
      fromAgentId: string;
      toAgentId: string;
      reason: string;
    }>;
    projectedVariance: number;
  } {
    // Sort agents by utilization (highest first)
    const sortedWorkloads = [...workloads].sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);
    
    const moves: Array<{
      ticketId: string;
      fromAgentId: string;
      toAgentId: string;
      reason: string;
    }> = [];

    // Simple strategy: move tickets from highest to lowest utilized agents
    const overloadedAgents = sortedWorkloads.filter(w => w.utilizationPercentage > 70);
    const underloadedAgents = sortedWorkloads.filter(w => w.utilizationPercentage < 50);

    for (const overloaded of overloadedAgents) {
      for (const underloaded of underloadedAgents) {
        if (overloaded.utilizationPercentage - underloaded.utilizationPercentage > config.maxWorkloadDifferencePercent) {
          // Simulate moving one ticket
          moves.push({
            ticketId: `simulated-${Date.now()}-${Math.random()}`, // Would be real ticket IDs
            fromAgentId: overloaded.agentId,
            toAgentId: underloaded.agentId,
            reason: `Распоређивање: ${Math.round(overloaded.utilizationPercentage)}% → ${Math.round(underloaded.utilizationPercentage)}%`
          });
          
          // Update simulated utilization
          overloaded.utilizationPercentage -= 10; // Approximate reduction
          underloaded.utilizationPercentage += 10; // Approximate increase
          
          if (moves.length >= 5) break; // Limit moves per rebalancing
        }
      }
      if (moves.length >= 5) break;
    }

    const projectedVariance = this.calculateUtilizationVariance(sortedWorkloads);

    return { moves, projectedVariance };
  }

  /**
   * Execute rebalancing plan
   */
  private async executeRebalancingPlan(
    plan: any, 
    triggeredBy: string
  ): Promise<Array<{
    ticketId: string;
    fromAgentId: string;
    toAgentId: string;
    reason: string;
    success: boolean;
    error?: string;
  }>> {
    const results = [];

    for (const move of plan.moves) {
      try {
        // In a real implementation, this would actually move tickets
        // For now, we'll simulate successful moves
        results.push({
          ...move,
          success: true
        });

        logger.info(`Simulated ticket move: ${move.ticketId} from ${move.fromAgentId} to ${move.toAgentId}`);
      } catch (error) {
        results.push({
          ...move,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get pending override requests
   */
  async getPendingOverrides(): Promise<{
    success: boolean;
    overrides?: ManualOverride[];
    message: string;
    error?: string;
  }> {
    try {
      const overrides = await this.loadData<ManualOverride>(this.overridesPath);
      const pending = overrides.filter(o => o.status === 'pending');

      return {
        success: true,
        overrides: pending,
        message: `Пронађено ${pending.length} захтева на чекању`
      };
    } catch (error) {
      logger.error('Error getting pending overrides:', error);
      return {
        success: false,
        message: 'Грешка при учитавању захтева за преусмеравање',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get override history
   */
  async getOverrideHistory(filters?: {
    supervisorId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<{
    success: boolean;
    overrides?: ManualOverride[];
    message: string;
    error?: string;
  }> {
    try {
      let overrides = await this.loadData<ManualOverride>(this.overridesPath);

      // Apply filters
      if (filters) {
        if (filters.supervisorId) {
          overrides = overrides.filter(o => o.supervisorId === filters.supervisorId);
        }
        if (filters.status) {
          overrides = overrides.filter(o => o.status === filters.status);
        }
        if (filters.fromDate) {
          const fromDate = new Date(filters.fromDate);
          overrides = overrides.filter(o => new Date(o.requestedAt) >= fromDate);
        }
        if (filters.toDate) {
          const toDate = new Date(filters.toDate);
          overrides = overrides.filter(o => new Date(o.requestedAt) <= toDate);
        }
      }

      // Sort by most recent first
      overrides.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

      return {
        success: true,
        overrides,
        message: `Пронађено ${overrides.length} захтева за преусмеравање`
      };
    } catch (error) {
      logger.error('Error getting override history:', error);
      return {
        success: false,
        message: 'Грешка при учитавању историје преусмеравања',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Initialize default load balancing configuration
   */
  async initializeDefaultConfig(): Promise<void> {
    try {
      const configs = await this.loadData<LoadBalancingConfig>(this.balancingConfigsPath);
      
      if (configs.length > 0) {
        logger.info('Load balancing configs already initialized');
        return;
      }

      const defaultConfig: LoadBalancingConfig = {
        id: 'default-load-balancing',
        name: 'default_load_balancing',
        displayName: 'Основно распоређивање оптерећења',
        description: 'Стандардна конфигурација за аутоматско распоређивање тикета',
        strategy: 'least_loaded',
        isActive: true,
        maxWorkloadDifferencePercent: 20,
        rebalanceInterval: 30, // 30 minutes
        emergencyThreshold: 90, // 90% utilization
        agentWeights: [], // Will be populated from agent profiles
        businessHours: {
          startTime: '08:00',
          endTime: '16:00',
          timezone: 'Europe/Belgrade',
          weekdays: [1, 2, 3, 4, 5] // Monday to Friday
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      };

      configs.push(defaultConfig);
      await this.saveData(this.balancingConfigsPath, configs);
      
      logger.info('Default load balancing configuration initialized');
    } catch (error) {
      logger.error('Error initializing default config:', error);
    }
  }
}

export default new ManualOverrideService(); 