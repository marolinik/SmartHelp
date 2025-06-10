/**
 * Ticket Routing Service  
 * Integrates smart routing engine with ticket management system
 */

import { TicketService } from '../ticketService';
import smartRoutingEngine from './smartRoutingEngine';
import agentProfileService from './agentProfileService';
import workloadCalculationService from './workloadCalculationService';
import routingNotificationService from './routingNotificationService';
import { RoutingDecision } from '../../models/agentProfile';
import { logger } from '../../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface AutoRoutingRequest {
  ticketId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // AI Categorization results (from frontend)
  aiCategory?: string;
  aiCategoryDisplayName?: string;
  aiConfidence?: number;
  aiAlternativeCategories?: Array<{
    category: string;
    confidence: number;
  }>;
  
  // Manual preferences
  preferredAgentId?: string;
  excludedAgentIds?: string[];
  bypassRouting?: boolean;
  
  // Customer context
  customerTier?: 'basic' | 'premium' | 'enterprise';
  requesterId: string;
}

interface RoutingDecisionWithAgent extends RoutingDecision {
  agentDetails?: {
    displayName: string;
    email: string;
    department: string;
    experienceLevel: string;
  };
}

export class TicketRoutingService {
  private ticketService: TicketService;
  private routingDecisionsPath: string;
  private dataDir: string;

  constructor() {
    this.ticketService = new TicketService();
    this.dataDir = path.join(__dirname, '../../../..', 'data/routing');
    this.routingDecisionsPath = path.join(this.dataDir, 'routing-decisions.json');
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
   * Load routing decisions from JSON file
   */
  private async loadRoutingDecisions(): Promise<RoutingDecision[]> {
    try {
      const data = await fs.readFile(this.routingDecisionsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Save routing decision to JSON file
   */
  private async saveRoutingDecision(decision: RoutingDecision): Promise<void> {
    try {
      const decisions = await this.loadRoutingDecisions();
      decisions.push(decision);
      
      const jsonData = JSON.stringify(decisions, null, 2);
      await fs.writeFile(this.routingDecisionsPath, jsonData, 'utf-8');
    } catch (error) {
      logger.error('Error saving routing decision:', error);
    }
  }

  /**
   * Create ticket with automatic smart routing
   */
  async createTicketWithRouting(request: AutoRoutingRequest): Promise<{
    success: boolean;
    ticket?: any;
    routingResult?: any;
    message: string;
    error?: string;
  }> {
    try {
      logger.info(`🎯 Starting auto-routing for ticket: ${request.title}`, {
        aiCategory: request.aiCategory,
        priority: request.priority
      });

      // If routing is bypassed, create ticket normally
      if (request.bypassRouting) {
        const createRequest: any = {
          title: request.title,
          description: request.description,
          priority: request.priority,
          requesterId: request.requesterId
        };

        if (request.preferredAgentId) {
          createRequest.assignedTo = request.preferredAgentId;
        }

        const ticket = await this.ticketService.createTicket(createRequest);

        return {
          success: true,
          ticket,
          message: 'Тикет креиран без аутоматског рутирања'
        };
      }

      // Prepare routing request
      const routingRequest: any = {
        ticketId: request.ticketId,
        title: request.title,
        description: request.description,
        priority: request.priority === 'critical' ? 'urgent' as const : request.priority,
        category: request.aiCategory || 'other',
        categoryDisplayName: request.aiCategoryDisplayName || 'Остало',
        aiConfidence: request.aiConfidence || 0,
        aiAlternativeCategories: request.aiAlternativeCategories || [],
        createdAt: new Date().toISOString(),
        excludedAgentIds: request.excludedAgentIds || [],
        requiresUrgentHandling: request.priority === 'critical'
      };

      if (request.customerTier) {
        routingRequest.customerTier = request.customerTier;
      }
      if (request.preferredAgentId) {
        routingRequest.preferredAgentId = request.preferredAgentId;
      }

      // Get routing recommendation
      const routingResult = await smartRoutingEngine.routeTicket(routingRequest);

      if (!routingResult.success) {
        // Create unassigned ticket if routing fails
        const ticket = await this.ticketService.createTicket({
          title: request.title,
          description: request.description,
          priority: request.priority,
          requesterId: request.requesterId
        });

        logger.warn(`⚠️ Routing failed for ticket ${ticket.ticketNumber}: ${routingResult.error}`);

        return {
          success: true,
          ticket,
          routingResult,
          message: `Тикет креиран али рутирање није успешно: ${routingResult.routingReason}`
        };
      }

              // Create ticket with assigned agent
        const ticket = await this.ticketService.createTicket({
          title: request.title,
          description: request.description,
          priority: request.priority,
          requesterId: request.requesterId,
          assignedTo: routingResult.selectedAgentId!
        });

      // Create routing decision record
      await this.recordRoutingDecision(ticket.id, routingResult, request.requesterId);

      logger.info(`✅ Ticket ${ticket.ticketNumber} successfully routed to ${routingResult.selectedAgentName}`, {
        confidence: routingResult.routingConfidence,
        reason: routingResult.routingReason
      });

      return {
        success: true,
        ticket,
        routingResult,
        message: `Тикет успешно креиран и аутоматски додељен агенту ${routingResult.selectedAgentName}`
      };

    } catch (error) {
      logger.error('Error in createTicketWithRouting:', error);
      return {
        success: false,
        message: 'Грешка при креирању тикета са рутирањем',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Re-route existing ticket to different agent
   */
  async rerouteTicket(
    ticketId: string, 
    reason: string, 
    excludeCurrentAgent: boolean = true,
    requestedBy: string
  ): Promise<{
    success: boolean;
    ticket?: any;
    routingResult?: any;
    message: string;
    error?: string;
  }> {
    try {
      // Get current ticket
      const currentTicket = await this.ticketService.getTicketById(ticketId);
      if (!currentTicket) {
        return {
          success: false,
          message: 'Тикет није пронађен',
          error: 'Ticket not found'
        };
      }

      logger.info(`🔄 Re-routing ticket ${currentTicket.ticketNumber}: ${reason}`);

      // Prepare exclusions
      const excludedAgentIds = excludeCurrentAgent && currentTicket.assignedTo 
        ? [currentTicket.assignedTo] 
        : [];

      // Prepare routing request  
      const routingRequest = {
        ticketId: currentTicket.id,
        title: currentTicket.title,
        description: currentTicket.description,
        priority: currentTicket.priority === 'critical' ? 'urgent' as const : currentTicket.priority,
        category: currentTicket.category?.name || 'other',
        categoryDisplayName: currentTicket.category?.displayName || 'Остало',
        aiConfidence: 0.8, // Assume good confidence for existing tickets
        customerTier: 'basic' as const,
        createdAt: currentTicket.createdAt,
        excludedAgentIds,
        requiresUrgentHandling: currentTicket.priority === 'critical'
      };

      // Get new routing recommendation
      const routingResult = await smartRoutingEngine.routeTicket(routingRequest);

      if (!routingResult.success) {
        return {
          success: false,
          routingResult,
          message: `Није могуће пронаћи погодан агент: ${routingResult.routingReason}`
        };
      }

      // Update ticket assignment
      const updatedTicket = await this.ticketService.updateTicket(
        ticketId, 
        { 
          assignedTo: routingResult.selectedAgentId! 
        }, 
        requestedBy
      );

      // Record the re-routing decision
      await this.recordRoutingDecision(
        ticketId, 
        routingResult, 
        requestedBy,
        true, // This is a re-routing
        currentTicket.assignedTo,
        reason
      );

      logger.info(`✅ Ticket ${currentTicket.ticketNumber} re-routed to ${routingResult.selectedAgentName}`);

      return {
        success: true,
        ticket: updatedTicket,
        routingResult,
        message: `Тикет поново рутиран агенту ${routingResult.selectedAgentName}`
      };

    } catch (error) {
      logger.error('Error in rerouteTicket:', error);
      return {
        success: false,
        message: 'Грешка при поновном рутирању тикета',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get routing recommendation without creating ticket
   */
  async getRoutingRecommendation(request: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    aiCategory?: string;
    aiCategoryDisplayName?: string;
    preferredAgentId?: string;
    excludedAgentIds?: string[];
  }): Promise<{
    success: boolean;
    recommendation?: any;
    message: string;
    error?: string;
  }> {
    try {
      const routingRequest: any = {
        ticketId: `preview-${Date.now()}`,
        title: request.title,
        description: request.description,
        priority: request.priority === 'critical' ? 'urgent' as const : request.priority,
        category: request.aiCategory || 'other',
        categoryDisplayName: request.aiCategoryDisplayName || 'Остало',
        aiConfidence: 0.7,
        customerTier: 'basic' as const,
        createdAt: new Date().toISOString(),
        excludedAgentIds: request.excludedAgentIds || [],
        requiresUrgentHandling: request.priority === 'critical'
      };

      if (request.preferredAgentId) {
        routingRequest.preferredAgentId = request.preferredAgentId;
      }

      const recommendation = await smartRoutingEngine.routeTicket(routingRequest);

      return {
        success: recommendation.success,
        recommendation,
        message: recommendation.success 
          ? 'Препорука рутирања успешно генерисана'
          : 'Није могуће генерисати препоруку'
      };

    } catch (error) {
      logger.error('Error getting routing recommendation:', error);
      return {
        success: false,
        message: 'Грешка при генерисању препоруке',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get routing insights and statistics
   */
  async getRoutingInsights(): Promise<{
    success: boolean;
    insights?: any;
    message: string;
    error?: string;
  }> {
    try {
      const insights = await smartRoutingEngine.getRoutingInsights();

      return {
        success: true,
        insights,
        message: 'Статистике рутирања успешно учитане'
      };

    } catch (error) {
      logger.error('Error getting routing insights:', error);
      return {
        success: false,
        message: 'Грешка при учитавању статистика',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get routing history for a ticket
   */
  async getTicketRoutingHistory(ticketId: string): Promise<{
    success: boolean;
    history?: RoutingDecisionWithAgent[];
    message: string;
    error?: string;
  }> {
    try {
      const decisions = await this.loadRoutingDecisions();
      const ticketDecisions = decisions.filter(d => d.ticketId === ticketId);

      // Enrich with agent details
      const enrichedDecisions: RoutingDecisionWithAgent[] = [];
      
      for (const decision of ticketDecisions) {
        const agentProfile = await agentProfileService.getAgentProfile(decision.selectedAgentId);
        
        const enrichedDecision: RoutingDecisionWithAgent = {
          ...decision
        };

        if (agentProfile) {
          enrichedDecision.agentDetails = {
            displayName: agentProfile.displayName,
            email: agentProfile.email,
            department: agentProfile.department,
            experienceLevel: agentProfile.experienceLevel
          };
        }

        enrichedDecisions.push(enrichedDecision);
      }

      return {
        success: true,
        history: enrichedDecisions,
        message: 'Историја рутирања успешно учитана'
      };

    } catch (error) {
      logger.error('Error getting routing history:', error);
      return {
        success: false,
        message: 'Грешка при учитавању историје',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Record routing decision for audit trail
   */
  private async recordRoutingDecision(
    ticketId: string,
    routingResult: any,
    decidedBy: string,
    isReRouting: boolean = false,
    originalAgentId?: string,
    reroutingReason?: string
  ): Promise<void> {
    try {
      const decision: RoutingDecision = {
        id: uuidv4(),
        ticketId,
        decisionTimestamp: new Date().toISOString(),
        routingEngine: routingResult.routingEngine,
        weightConfigId: routingResult.appliedWeights?.id,
        availableAgents: routingResult.allCandidates.map((candidate: any) => ({
          agentId: candidate.agentId,
          score: candidate.totalScore,
          reasons: candidate.scoreExplanation,
          skillMatch: candidate.skillMatchScore,
          workloadScore: candidate.workloadScore,
          performanceScore: candidate.performanceScore,
          availabilityScore: candidate.availabilityScore
        })),
        selectedAgentId: routingResult.selectedAgentId,
        selectionReason: routingResult.routingReason,
        confidence: routingResult.routingConfidence,
        wasOverridden: isReRouting,
        wasAccepted: false, // Will be updated when agent responds
        reassignmentCount: isReRouting ? 1 : 0,
        createdAt: new Date().toISOString()
      };

      // Add optional fields only if they have values
      if (isReRouting && decidedBy) {
        decision.overriddenBy = decidedBy;
      }
      if (reroutingReason) {
        decision.overrideReason = reroutingReason;
      }
      if (originalAgentId) {
        decision.originalAgentId = originalAgentId;
      }
      if (routingResult.appliedWeights?.id) {
        decision.weightConfigId = routingResult.appliedWeights.id;
      }

      await this.saveRoutingDecision(decision);

    } catch (error) {
      logger.error('Error recording routing decision:', error);
      // Don't throw error - routing decision recording should not fail the main operation
    }
  }

  /**
   * Initialize sample data for testing
   */
  async initializeSampleData(): Promise<void> {
    await agentProfileService.initializeAllSampleData();
    logger.info('Routing sample data initialized');
  }

  /**
   * Get overall routing statistics  
   */
  async getRoutingStatistics(dateFrom?: string, dateTo?: string): Promise<{
    success: boolean;
    statistics?: {
      totalDecisions: number;
      successfulRoutes: number;
      reroutingCount: number;
      averageConfidence: number;
      topAgents: Array<{ agentId: string; ticketCount: number; averageScore: number }>;
      categoryDistribution: Array<{ category: string; count: number }>;
      timeToAcceptance: {
        average: number;
        median: number;
        distribution: Array<{ timeRange: string; count: number }>;
      };
    };
    message: string;
    error?: string;
  }> {
    try {
      const decisions = await this.loadRoutingDecisions();
      
      // Filter by date range if provided
      let filteredDecisions = decisions;
      if (dateFrom || dateTo) {
        filteredDecisions = decisions.filter(d => {
          const decisionDate = new Date(d.decisionTimestamp);
          const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
          const toDate = dateTo ? new Date(dateTo) : new Date();
          return decisionDate >= fromDate && decisionDate <= toDate;
        });
      }

      const totalDecisions = filteredDecisions.length;
      const successfulRoutes = filteredDecisions.filter(d => d.selectedAgentId).length;
      const reroutingCount = filteredDecisions.filter(d => d.wasOverridden).length;
      
      const totalConfidence = filteredDecisions.reduce((sum, d) => sum + d.confidence, 0);
      const averageConfidence = totalDecisions > 0 ? totalConfidence / totalDecisions : 0;

      // Top agents by ticket count
      const agentCounts: { [agentId: string]: { count: number; totalScore: number } } = {};
      for (const decision of filteredDecisions) {
        if (decision.selectedAgentId) {
          if (!agentCounts[decision.selectedAgentId]) {
            agentCounts[decision.selectedAgentId] = { count: 0, totalScore: 0 };
          }
          agentCounts[decision.selectedAgentId].count++;
          
          // Find agent's score from available agents
          const agentScore = decision.availableAgents.find(a => a.agentId === decision.selectedAgentId)?.score || 0;
          agentCounts[decision.selectedAgentId].totalScore += agentScore;
        }
      }

      const topAgents = Object.entries(agentCounts)
        .map(([agentId, data]) => ({
          agentId,
          ticketCount: data.count,
          averageScore: data.count > 0 ? data.totalScore / data.count : 0
        }))
        .sort((a, b) => b.ticketCount - a.ticketCount)
        .slice(0, 10);

      return {
        success: true,
        statistics: {
          totalDecisions,
          successfulRoutes,
          reroutingCount,
          averageConfidence: Math.round(averageConfidence * 100) / 100,
          topAgents,
          categoryDistribution: [], // Could be expanded with ticket data
          timeToAcceptance: {
            average: 0, // Could be calculated with actual acceptance data
            median: 0,
            distribution: []
          }
        },
        message: 'Статистике рутирања успешно учитане'
      };

    } catch (error) {
      logger.error('Error getting routing statistics:', error);
      return {
        success: false,
        message: 'Грешка при учитавању статистика',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default new TicketRoutingService(); 