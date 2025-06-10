/**
 * Smart Routing Engine
 * AI-driven ticket routing based on agent skills, workload, and performance
 */

import { 
  AgentProfile, 
  AgentSkillLevel, 
  RoutingDecision, 
  RoutingWeight,
  RoutingRule
} from '../../models/agentProfile';
import agentProfileService from './agentProfileService';
import workloadCalculationService from './workloadCalculationService';
import { logger } from '../../utils/logger';

interface TicketRoutingRequest {
  ticketId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  categoryDisplayName: string;
  
  // AI categorization results
  aiConfidence: number;
  aiAlternativeCategories?: Array<{
    category: string;
    confidence: number;
  }>;
  
  // Customer context
  customerTier?: 'basic' | 'premium' | 'enterprise';
  createdAt: string;
  
  // Routing preferences
  preferredAgentId?: string;
  excludedAgentIds?: string[];
  requiresUrgentHandling?: boolean;
}

interface AgentScore {
  agentId: string;
  agentName: string;
  totalScore: number;
  confidence: number;
  
  // Score breakdown
  skillMatchScore: number;
  workloadScore: number;
  performanceScore: number;
  availabilityScore: number;
  categoryExperienceScore: number;
  
  // Detailed reasoning (in Serbian)
  scoreExplanation: string[];
  strengths: string[];
  concerns: string[];
  
  // Recommendations
  isRecommended: boolean;
  recommendationLevel: 'optimal' | 'good' | 'acceptable' | 'not_recommended';
}

interface RoutingResult {
  success: boolean;
  ticketId: string;
  selectedAgentId?: string;
  selectedAgentName?: string;
  routingConfidence: number;
  
  // Decision details
  allCandidates: AgentScore[];
  selectedCandidate?: AgentScore;
  routingReason: string; // Serbian explanation
  
  // Applied configurations
  appliedWeights: RoutingWeight;
  appliedRules?: RoutingRule[];
  
  // Metadata
  processingTime: number;
  routingEngine: string;
  decidedAt: string;
  
  // Alternatives and fallbacks
  alternativeCandidates: AgentScore[];
  fallbackOptions?: string[];
  
  error?: string;
}

export class SmartRoutingEngine {
  private defaultWeights: RoutingWeight;

  constructor() {
    // Default routing weights
    this.defaultWeights = {
      id: 'default-weights',
      name: 'default_routing_weights',
      displayName: 'Основна подешавања рутирања',
      description: 'Стандардна подешавања за рутирање тикета',
      skillMatchWeight: 0.35,
      workloadWeight: 0.25,
      performanceWeight: 0.20,
      availabilityWeight: 0.15,
      categoryExperienceWeight: 0.05,
      urgentTicketModifier: 1.5,
      newAgentPenalty: 0.8,
      highPerformerBonus: 1.2,
      maxWorkloadThreshold: 90,
      skillLevelThreshold: 2,
      isDefault: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Main routing method - finds the best agent for a ticket
   */
  async routeTicket(request: TicketRoutingRequest): Promise<RoutingResult> {
    const startTime = Date.now();
    const decidedAt = new Date().toISOString();

    try {
      logger.info(`Starting routing for ticket ${request.ticketId}`, {
        category: request.category,
        priority: request.priority
      });

      // Get all available agents and their scores
      const candidateScores = await this.calculateAllAgentScores(request);
      
      if (candidateScores.length === 0) {
        return {
          success: false,
          ticketId: request.ticketId,
          routingConfidence: 0,
          allCandidates: [],
          routingReason: 'Нема доступних агената за ову врсту тикета',
          appliedWeights: this.defaultWeights,
          processingTime: Date.now() - startTime,
          routingEngine: 'smart_routing_v1',
          decidedAt,
          alternativeCandidates: [],
          error: 'No available agents'
        };
      }

      // Sort candidates by total score (descending)
      const sortedCandidates = candidateScores
        .sort((a, b) => b.totalScore - a.totalScore);

      // Select the best candidate
      const selectedCandidate = sortedCandidates[0];
      
      if (!selectedCandidate) {
        return {
          success: false,
          ticketId: request.ticketId,
          routingConfidence: 0,
          allCandidates: sortedCandidates,
          routingReason: 'Нема подесних агената за ову врсту тикета',
          appliedWeights: this.defaultWeights,
          processingTime: Date.now() - startTime,
          routingEngine: 'smart_routing_v1',
          decidedAt,
          alternativeCandidates: [],
          error: 'No suitable agents found'
        };
      }
      
      // Prepare alternatives (top 3 excluding selected)
      const alternativeCandidates = sortedCandidates.slice(1, 4);

      // Generate routing reason
      const routingReason = this.generateRoutingReason(
        selectedCandidate, 
        request, 
        sortedCandidates.length
      );

      return {
        success: true,
        ticketId: request.ticketId,
        selectedAgentId: selectedCandidate.agentId,
        selectedAgentName: selectedCandidate.agentName,
        routingConfidence: selectedCandidate.confidence,
        allCandidates: sortedCandidates,
        selectedCandidate,
        routingReason,
        appliedWeights: this.defaultWeights,
        processingTime: Date.now() - startTime,
        routingEngine: 'smart_routing_v1',
        decidedAt,
        alternativeCandidates
      };

    } catch (error) {
      logger.error(`Error routing ticket ${request.ticketId}:`, error);
      
      return {
        success: false,
        ticketId: request.ticketId,
        routingConfidence: 0,
        allCandidates: [],
        routingReason: 'Грешка у систему рутирања тикета',
        appliedWeights: this.defaultWeights,
        processingTime: Date.now() - startTime,
        routingEngine: 'smart_routing_v1',
        decidedAt,
        alternativeCandidates: [],
        error: error instanceof Error ? error.message : 'Unknown routing error'
      };
    }
  }

  /**
   * Calculate scores for all available agents
   */
  private async calculateAllAgentScores(request: TicketRoutingRequest): Promise<AgentScore[]> {
    const profiles = await agentProfileService.getAllAgentProfiles();
    const activeAgents = profiles.filter(p => p.isActive);
    
    const scores: AgentScore[] = [];

    for (const agent of activeAgents) {
      // Skip excluded agents
      if (request.excludedAgentIds?.includes(agent.id)) {
        continue;
      }

      const score = await this.calculateAgentScore(agent, request);
      if (score) {
        scores.push(score);
      }
    }

    return scores;
  }

  /**
   * Calculate routing score for a specific agent
   */
  private async calculateAgentScore(
    agent: AgentProfile, 
    request: TicketRoutingRequest
  ): Promise<AgentScore | null> {
    try {
      // Get agent data
      const [skillLevels, workload] = await Promise.all([
        agentProfileService.getAgentSkillLevels(agent.id),
        workloadCalculationService.calculateAgentWorkload(agent.id)
      ]);

      if (!workload) {
        return null;
      }

      // Calculate individual scores
      const skillMatchScore = this.calculateSkillMatchScore(skillLevels, request);
      const workloadScore = this.calculateWorkloadScore(workload);
      const performanceScore = this.calculatePerformanceScore(agent, workload);
      const availabilityScore = this.calculateAvailabilityScore(workload, agent);
      const categoryExperienceScore = this.calculateCategoryExperienceScore(agent, request);

      // Apply weights to calculate total score
      const weights = this.defaultWeights;
      let totalScore = 
        (skillMatchScore * weights.skillMatchWeight) +
        (workloadScore * weights.workloadWeight) +
        (performanceScore * weights.performanceWeight) +
        (availabilityScore * weights.availabilityWeight) +
        (categoryExperienceScore * weights.categoryExperienceWeight);

      // Apply modifiers
      totalScore = this.applyScoreModifiers(totalScore, agent, request, workload);

      // Calculate confidence (0-1)
      const confidence = Math.min(1, totalScore / 1.0);

      // Generate explanations
      const explanations = this.generateScoreExplanations(
        agent,
        skillMatchScore,
        workloadScore,
        performanceScore,
        availabilityScore,
        categoryExperienceScore,
        request
      );

      // Determine recommendation level  
      const recommendationLevel = workload ? this.determineRecommendationLevel(
        totalScore, 
        confidence, 
        workload
      ) : 'not_recommended';

      return {
        agentId: agent.id,
        agentName: agent.displayName,
        totalScore: Math.round(totalScore * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        skillMatchScore: Math.round(skillMatchScore * 100) / 100,
        workloadScore: Math.round(workloadScore * 100) / 100,
        performanceScore: Math.round(performanceScore * 100) / 100,
        availabilityScore: Math.round(availabilityScore * 100) / 100,
        categoryExperienceScore: Math.round(categoryExperienceScore * 100) / 100,
        scoreExplanation: explanations.explanation,
        strengths: explanations.strengths,
        concerns: explanations.concerns,
        isRecommended: recommendationLevel !== 'not_recommended',
        recommendationLevel
      };

    } catch (error) {
      logger.error(`Error calculating score for agent ${agent.id}:`, error);
      return null;
    }
  }

  /**
   * Calculate skill match score based on agent skills vs ticket category
   */
  private calculateSkillMatchScore(
    skillLevels: AgentSkillLevel[], 
    request: TicketRoutingRequest
  ): number {
    if (skillLevels.length === 0) return 0;

    // Find skills related to the ticket category
    const categoryKeywords = this.getCategoryKeywords(request.category);
    let bestMatch = 0;
    let matchCount = 0;

    for (const skill of skillLevels) {
      for (const keyword of categoryKeywords) {
        if (skill.skillId.includes(keyword)) {
          bestMatch = Math.max(bestMatch, skill.level / 5); // Normalize to 0-1
          matchCount++;
        }
      }
    }

    // Bonus for multiple matching skills
    const matchBonus = Math.min(0.2, matchCount * 0.05);
    return Math.min(1, bestMatch + matchBonus);
  }

  /**
   * Get keywords for category matching
   */
  private getCategoryKeywords(category: string): string[] {
    const categoryMap: { [key: string]: string[] } = {
      'hardware': ['hw', 'desktop', 'laptop', 'printer', 'monitor'],
      'software': ['sw', 'windows', 'office', 'pio', 'antivirus'],
      'network': ['net', 'connectivity', 'wifi', 'vpn'],
      'security': ['sec', 'password', 'account', 'permissions'],
      'email': ['email', 'outlook', 'server'],
      'training': ['train', 'users', 'documentation']
    };

    return categoryMap[category] || [category];
  }

  /**
   * Calculate workload score (lower workload = higher score)
   */
  private calculateWorkloadScore(workload: any): number {
    // Invert utilization - lower utilization = higher score
    const utilizationScore = 1 - (workload.utilizationPercentage / 100);
    
    // Bonus for having available capacity
    const capacityBonus = workload.availableCapacity > 0 ? 0.1 : 0;
    
    // Penalty for high stress
    const stressPenalties = {
      'low': 0,
      'medium': 0.1,
      'high': 0.3,
      'critical': 0.7
    } as const;
    const stressPenalty = stressPenalties[workload.stressLevel as keyof typeof stressPenalties] || 0;

    return Math.max(0, utilizationScore + capacityBonus - stressPenalty);
  }

  /**
   * Calculate performance score based on recent performance
   */
  private calculatePerformanceScore(agent: AgentProfile, workload: any): number {
    let baseScore = workload.recentPerformanceScore || 0.5;
    
    // Experience bonus
    const experienceBonus = {
      'junior': 0,
      'intermediate': 0.05,
      'senior': 0.1,
      'lead': 0.15,
      'expert': 0.2
    }[agent.experienceLevel] || 0;

    return Math.min(1, baseScore + experienceBonus);
  }

  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(workload: any, agent: AgentProfile): number {
    if (!workload.isCurrentlyWorking) return 0;
    if (!agent.isActive) return 0;
    
    let score = 1.0;
    
    // Reduce score based on current workload
    if (workload.utilizationPercentage > 80) score -= 0.3;
    else if (workload.utilizationPercentage > 60) score -= 0.1;
    
    // Bonus for agents who can handle urgent tickets
    if (agent.canHandleUrgentTickets) score += 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate category experience score
   */
  private calculateCategoryExperienceScore(
    agent: AgentProfile, 
    request: TicketRoutingRequest
  ): number {
    // Check if category is in agent's preferred categories
    if (agent.preferredCategories.includes(request.category)) {
      return 0.8;
    }
    
    // Base score on years of experience
    const experienceScore = Math.min(0.6, agent.yearsOfExperience / 20);
    
    return experienceScore;
  }

  /**
   * Apply score modifiers based on ticket and agent characteristics
   */
  private applyScoreModifiers(
    baseScore: number,
    agent: AgentProfile,
    request: TicketRoutingRequest,
    workload: any
  ): number {
    let modifiedScore = baseScore;
    const weights = this.defaultWeights;

    // Urgent ticket modifier
    if (request.priority === 'urgent' && agent.canHandleUrgentTickets) {
      modifiedScore *= weights.urgentTicketModifier;
    }

    // New agent penalty
    if (agent.experienceLevel === 'junior') {
      modifiedScore *= weights.newAgentPenalty;
    }

    // High performer bonus
    if (workload.recentPerformanceScore > 0.85) {
      modifiedScore *= weights.highPerformerBonus;
    }

    // Preferred agent bonus
    if (request.preferredAgentId === agent.id) {
      modifiedScore *= 1.3;
    }

    return modifiedScore;
  }

  /**
   * Generate detailed score explanations in Serbian
   */
  private generateScoreExplanations(
    agent: AgentProfile,
    skillScore: number,
    workloadScore: number,
    performanceScore: number,
    availabilityScore: number,
    categoryScore: number,
    request: TicketRoutingRequest
  ): { explanation: string[]; strengths: string[]; concerns: string[] } {
    
    const explanation: string[] = [];
    const strengths: string[] = [];
    const concerns: string[] = [];

    // Skill analysis
    if (skillScore > 0.8) {
      strengths.push('Одличне вештине за ову врсту проблема');
    } else if (skillScore > 0.6) {
      explanation.push('Добре вештине за решавање овог типа тикета');
    } else if (skillScore < 0.3) {
      concerns.push('Ограничене вештине за ову категорију');
    }

    // Workload analysis
    if (workloadScore > 0.8) {
      strengths.push('Висок расположиви капацитет');
    } else if (workloadScore > 0.5) {
      explanation.push('Умерено заузет, али има капацитет');
    } else {
      concerns.push('Висока заузетост или стрес');
    }

    // Performance analysis
    if (performanceScore > 0.8) {
      strengths.push('Одличне перформансе');
    } else if (performanceScore < 0.5) {
      concerns.push('Потребно побољшање перформанси');
    }

    // Availability analysis
    if (availabilityScore < 0.5) {
      concerns.push('Ограничена доступност');
    }

    // Experience analysis
    const experienceDescriptions = {
      'expert': 'Експерт са вишегодишњим искуством',
      'lead': 'Тим лидер са напредним искуством',
      'senior': 'Искусан агент',
      'intermediate': 'Агент са добрим искуством',
      'junior': 'Млађи агент, потребан ментор'
    } as const;
    
    explanation.push(experienceDescriptions[agent.experienceLevel] || 'Стандардно искуство');

    return { explanation, strengths, concerns };
  }

  /**
   * Determine recommendation level
   */
  private determineRecommendationLevel(
    totalScore: number,
    confidence: number,
    workload: any
  ): 'optimal' | 'good' | 'acceptable' | 'not_recommended' {
    if (!workload || !workload.recommendedAssignment) return 'not_recommended';
    
    if (totalScore >= 0.85 && confidence >= 0.8) return 'optimal';
    if (totalScore >= 0.7 && confidence >= 0.6) return 'good';
    if (totalScore >= 0.5) return 'acceptable';
    
    return 'not_recommended';
  }

  /**
   * Generate routing reason in Serbian
   */
  private generateRoutingReason(
    selectedCandidate: AgentScore,
    request: TicketRoutingRequest,
    totalCandidates: number
  ): string {
    const reasons: string[] = [];

    // Main selection reason
    if (selectedCandidate.recommendationLevel === 'optimal') {
      reasons.push(`${selectedCandidate.agentName} је оптимални избор`);
    } else if (selectedCandidate.recommendationLevel === 'good') {
      reasons.push(`${selectedCandidate.agentName} је добар избор`);
    } else {
      reasons.push(`${selectedCandidate.agentName} је изабран као најбољи доступан агент`);
    }

    // Add top strength
    if (selectedCandidate.strengths.length > 0) {
      reasons.push(selectedCandidate.strengths[0].toLowerCase());
    }

    // Add context about alternatives
    if (totalCandidates > 1) {
      reasons.push(`(разматрано ${totalCandidates} агената)`);
    }

    return reasons.join(' - ');
  }

  /**
   * Get routing statistics and insights
   */
  async getRoutingInsights(): Promise<{
    agentWorkloads: any[];
    totalCapacity: number;
    averageUtilization: number;
    recommendedAgents: string[];
    busyAgents: string[];
  }> {
    try {
      const workloads = await workloadCalculationService.calculateAllAgentWorkloads();
      const distribution = await workloadCalculationService.getWorkloadDistribution();
      
      const recommendedAgents = workloads
        .filter(w => w.recommendedAssignment)
        .map(w => w.agentId);
        
      const busyAgents = workloads
        .filter(w => w.utilizationPercentage > 80)
        .map(w => w.agentId);

      return {
        agentWorkloads: workloads,
        totalCapacity: distribution.totalCapacity,
        averageUtilization: distribution.utilizationPercentage,
        recommendedAgents,
        busyAgents
      };
    } catch (error) {
      logger.error('Error getting routing insights:', error);
      throw new Error('Failed to get routing insights');
    }
  }

  /**
   * Simulate routing for multiple tickets
   */
  async simulateRouting(requests: TicketRoutingRequest[]): Promise<{
    results: RoutingResult[];
    summary: {
      totalTickets: number;
      successfulRoutes: number;
      failedRoutes: number;
      averageConfidence: number;
      agentDistribution: { [agentId: string]: number };
    };
  }> {
    const results: RoutingResult[] = [];
    
    for (const request of requests) {
      const result = await this.routeTicket(request);
      results.push(result);
    }

    // Calculate summary
    const successfulRoutes = results.filter(r => r.success).length;
    const totalConfidence = results.reduce((sum, r) => sum + r.routingConfidence, 0);
    const averageConfidence = totalConfidence / results.length;
    
    // Agent distribution
    const agentDistribution: { [agentId: string]: number } = {};
    for (const result of results) {
      if (result.selectedAgentId) {
        agentDistribution[result.selectedAgentId] = 
          (agentDistribution[result.selectedAgentId] || 0) + 1;
      }
    }

    return {
      results,
      summary: {
        totalTickets: requests.length,
        successfulRoutes,
        failedRoutes: requests.length - successfulRoutes,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        agentDistribution
      }
    };
  }
}

export default new SmartRoutingEngine(); 