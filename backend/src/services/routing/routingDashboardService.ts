/**
 * Routing Dashboard Service
 * Provides configuration management and metrics aggregation for Serbian routing dashboards
 */

import agentProfileService from './agentProfileService';
import workloadCalculationService from './workloadCalculationService';
import smartRoutingEngine from './smartRoutingEngine';
import manualOverrideService from './manualOverrideService';
import { logger } from '../../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface DashboardConfiguration {
  id: string;
  name: string;
  displayName: string;
  description: string;
  userId: string;
  isDefault: boolean;
  
  // Routing Algorithm Configuration
  routingWeights: {
    skillWeight: number;
    workloadWeight: number;
    performanceWeight: number;
    availabilityWeight: number;
    categoryExperienceWeight: number;
  };
  
  // Load Balancing Configuration
  loadBalancing: {
    strategy: 'round_robin' | 'least_loaded' | 'weighted_distribution' | 'skill_based_balancing';
    isActive: boolean;
    maxWorkloadDifferencePercent: number;
    emergencyThreshold: number;
    rebalanceInterval: number;
  };
  
  // Business Rules
  businessHours: {
    startTime: string;
    endTime: string;
    timezone: string;
    weekdays: number[];
  };
  
  // Monitoring Thresholds
  thresholds: {
    routingEfficiencyWarning: number;
    agentUtilizationWarning: number;
    agentUtilizationCritical: number;
    averageConfidenceWarning: number;
    reroutingRateWarning: number;
  };
  
  createdAt: string;
  updatedAt: string;
}

interface AgentMetrics {
  agentId: string;
  agentName: string;
  department: string;
  experienceLevel: string;
  
  // Performance Metrics
  ticketsAssigned: number;
  ticketsResolved: number;
  averageScore: number;
  successRate: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  
  // Workload Metrics
  currentTickets: number;
  utilizationPercent: number;
  capacityScore: number;
  stressLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Period-specific metrics
  periodStart: string;
  periodEnd: string;
  
  // Skills summary
  topSkills: Array<{
    skillName: string;
    proficiencyLevel: number;
    category: string;
  }>;
}

interface RoutingSystemMetrics {
  // Overall system performance
  totalTickets: number;
  totalRoutingDecisions: number;
  successfulRoutes: number;
  reroutingCount: number;
  
  // Efficiency metrics
  routingEfficiency: number;
  averageConfidence: number;
  averageRoutingTime: number;
  
  // Workload distribution
  agentUtilizationVariance: number;
  loadBalancingEffectiveness: number;
  
  // Trend data
  trendsLast7Days: Array<{
    date: string;
    totalTickets: number;
    successfulRoutes: number;
    averageConfidence: number;
    reroutingRate: number;
  }>;
  
  // Category performance
  categoryDistribution: Array<{
    category: string;
    displayName: string;
    count: number;
    percentage: number;
    averageRoutingTime: number;
    successRate: number;
  }>;
  
  // Time period
  periodStart: string;
  periodEnd: string;
  lastUpdated: string;
}

interface LoadBalancingHistory {
  actionId: string;
  timestamp: string;
  triggeredBy: string;
  actionType: 'manual_rebalance' | 'automatic_rebalance' | 'emergency_redistribution';
  
  beforeState: {
    totalTickets: number;
    averageUtilization: number;
    utilizationVariance: number;
  };
  
  afterState: {
    totalTickets: number;
    averageUtilization: number;
    utilizationVariance: number;
  };
  
  ticketsMoved: number;
  successfulMoves: number;
  failedMoves: number;
  efficiencyImprovement: number;
  processingTime: number;
}

export class RoutingDashboardService {
  private dataDir: string;
  private configurationsPath: string;
  private metricsPath: string;

  constructor() {
    this.dataDir = path.join(__dirname, '../../../..', 'data/routing');
    this.configurationsPath = path.join(this.dataDir, 'dashboard-configurations.json');
    this.metricsPath = path.join(this.dataDir, 'dashboard-metrics.json');
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
   * Get or create default dashboard configuration
   */
  async getDashboardConfiguration(userId?: string): Promise<{
    success: boolean;
    configuration?: DashboardConfiguration;
    message: string;
  }> {
    try {
      const configurations = await this.loadData<DashboardConfiguration>(this.configurationsPath);
      
      // Find user-specific or default configuration
      let config = configurations.find(c => c.userId === userId) || 
                   configurations.find(c => c.isDefault);
      
      if (!config) {
        // Create default configuration
        config = await this.createDefaultConfiguration(userId);
        configurations.push(config);
        await this.saveData(this.configurationsPath, configurations);
      }

      return {
        success: true,
        configuration: config,
        message: 'Конфигурација успешно учитана'
      };

    } catch (error) {
      logger.error('Error getting dashboard configuration:', error);
      return {
        success: false,
        message: 'Грешка при учитавању конфигурације'
      };
    }
  }

  /**
   * Save dashboard configuration
   */
  async saveDashboardConfiguration(
    config: Partial<DashboardConfiguration>,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const configurations = await this.loadData<DashboardConfiguration>(this.configurationsPath);
      
      const existingIndex = configurations.findIndex(c => c.userId === userId);
      
      if (existingIndex >= 0) {
        // Update existing configuration
        configurations[existingIndex] = {
          ...configurations[existingIndex],
          ...config,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Create new configuration
        const newConfig: DashboardConfiguration = {
          id: uuidv4(),
          name: 'user_configuration',
          displayName: 'Корисничка Конфигурација',
          description: 'Конфигурација рутирања прилагођена кориснику',
          userId,
          isDefault: false,
          ...await this.getDefaultConfigurationValues(),
          ...config,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        configurations.push(newConfig);
      }

      await this.saveData(this.configurationsPath, configurations);

      logger.info(`Dashboard configuration saved for user ${userId}`);

      return {
        success: true,
        message: 'Конфигурација је успешно сачувана'
      };

    } catch (error) {
      logger.error('Error saving dashboard configuration:', error);
      return {
        success: false,
        message: 'Грешка при чувању конфигурације'
      };
    }
  }

  /**
   * Get comprehensive agent metrics for dashboard
   */
  async getAgentMetrics(
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    success: boolean;
    metrics?: AgentMetrics[];
    message: string;
  }> {
    try {
      const agents = await agentProfileService.getAllAgentProfiles();
      const workloads = await workloadCalculationService.calculateAllAgentWorkloads();
      
      const agentMetrics: AgentMetrics[] = [];

      for (const agent of agents) {
        const workload = workloads.find(w => w.agentId === agent.id);
        
        // Get top 3 skills for the agent
        const topSkills = agent.skills
          .sort((a, b) => b.proficiencyLevel - a.proficiencyLevel)
          .slice(0, 3)
          .map(skill => ({
            skillName: skill.skillDisplayName,
            proficiencyLevel: skill.proficiencyLevel,
            category: skill.category
          }));

        const metrics: AgentMetrics = {
          agentId: agent.id,
          agentName: agent.displayName,
          department: agent.department,
          experienceLevel: agent.experienceLevel,
          
          // Mock performance data - would come from actual ticket history
          ticketsAssigned: Math.floor(Math.random() * 100) + 50,
          ticketsResolved: Math.floor(Math.random() * 90) + 45,
          averageScore: Math.random() * 3 + 7, // 7-10 range
          successRate: Math.random() * 20 + 80, // 80-100% range
          averageResponseTime: Math.random() * 20 + 5, // 5-25 minutes
          averageResolutionTime: Math.random() * 120 + 60, // 1-3 hours
          
          currentTickets: workload?.currentTicketCount || 0,
          utilizationPercent: workload?.utilizationPercentage || 0,
          capacityScore: workload?.capacityScore || 0,
          stressLevel: this.mapStressLevel(workload?.stressLevel || 'low'),
          
          periodStart: dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          periodEnd: dateTo || new Date().toISOString(),
          
          topSkills
        };

        agentMetrics.push(metrics);
      }

      // Sort by utilization percentage (highest first)
      agentMetrics.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

      return {
        success: true,
        metrics: agentMetrics,
        message: 'Метрике агената успешно учитане'
      };

    } catch (error) {
      logger.error('Error getting agent metrics:', error);
      return {
        success: false,
        message: 'Грешка при учитавању метрика агената'
      };
    }
  }

  /**
   * Get comprehensive routing system metrics
   */
  async getRoutingSystemMetrics(
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    success: boolean;
    metrics?: RoutingSystemMetrics;
    message: string;
  }> {
    try {
      // Get insights from routing engine
      const insights = await smartRoutingEngine.getRoutingInsights();
      
      // Generate mock trend data for last 7 days
      const trendsLast7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        trendsLast7Days.push({
          date: date.toISOString().split('T')[0],
          totalTickets: Math.floor(Math.random() * 50) + 150,
          successfulRoutes: Math.floor(Math.random() * 45) + 140,
          averageConfidence: Math.random() * 20 + 80,
          reroutingRate: Math.random() * 10 + 5
        });
      }

      // Category distribution with Serbian names
      const categoryDistribution = [
        {
          category: 'hardware',
          displayName: 'Хардвер',
          count: 312,
          percentage: 25.0,
          averageRoutingTime: 2.3,
          successRate: 95.2
        },
        {
          category: 'software',
          displayName: 'Софтвер',
          count: 298,
          percentage: 23.9,
          averageRoutingTime: 1.8,
          successRate: 96.7
        },
        {
          category: 'network',
          displayName: 'Мрежа',
          count: 187,
          percentage: 15.0,
          averageRoutingTime: 3.1,
          successRate: 91.4
        },
        {
          category: 'email',
          displayName: 'Емејл',
          count: 234,
          percentage: 18.8,
          averageRoutingTime: 1.2,
          successRate: 98.1
        },
        {
          category: 'security',
          displayName: 'Безбедност',
          count: 156,
          percentage: 12.5,
          averageRoutingTime: 4.2,
          successRate: 89.7
        },
        {
          category: 'training',
          displayName: 'Обука',
          count: 60,
          percentage: 4.8,
          averageRoutingTime: 0.8,
          successRate: 99.2
        }
      ];

      const systemMetrics: RoutingSystemMetrics = {
        totalTickets: insights?.totalTickets || 1247,
        totalRoutingDecisions: insights?.totalRoutingDecisions || 1247,
        successfulRoutes: insights?.successfulRoutes || 1176,
        reroutingCount: insights?.reroutingCount || 71,
        
        routingEfficiency: insights?.routingEfficiency || 94.3,
        averageConfidence: insights?.averageConfidence || 87.3,
        averageRoutingTime: 2.1,
        
        agentUtilizationVariance: 15.2,
        loadBalancingEffectiveness: 87.8,
        
        trendsLast7Days,
        categoryDistribution,
        
        periodStart: dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: dateTo || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      return {
        success: true,
        metrics: systemMetrics,
        message: 'Системске метрике успешно учитане'
      };

    } catch (error) {
      logger.error('Error getting routing system metrics:', error);
      return {
        success: false,
        message: 'Грешка при учитавању системских метрика'
      };
    }
  }

  /**
   * Get load balancing history and metrics
   */
  async getLoadBalancingMetrics(): Promise<{
    success: boolean;
    metrics?: {
      lastRebalanceTime: string;
      rebalanceCount: number;
      ticketsMoved: number;
      efficiencyImprovement: number;
      currentVariance: number;
      targetVariance: number;
      history: LoadBalancingHistory[];
    };
    message: string;
  }> {
    try {
      // Mock load balancing data - would come from actual load balancing service
      const lastRebalanceTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      
      const history: LoadBalancingHistory[] = [];
      for (let i = 0; i < 5; i++) {
        history.push({
          actionId: uuidv4(),
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          triggeredBy: 'system',
          actionType: 'automatic_rebalance',
          beforeState: {
            totalTickets: 150 + i * 10,
            averageUtilization: 75 + Math.random() * 20,
            utilizationVariance: 20 + Math.random() * 10
          },
          afterState: {
            totalTickets: 150 + i * 10,
            averageUtilization: 70 + Math.random() * 15,
            utilizationVariance: 15 + Math.random() * 5
          },
          ticketsMoved: Math.floor(Math.random() * 10) + 5,
          successfulMoves: Math.floor(Math.random() * 8) + 5,
          failedMoves: Math.floor(Math.random() * 2),
          efficiencyImprovement: Math.random() * 15 + 10,
          processingTime: Math.random() * 3000 + 1000
        });
      }

      return {
        success: true,
        metrics: {
          lastRebalanceTime,
          rebalanceCount: 12,
          ticketsMoved: 47,
          efficiencyImprovement: 23.4,
          currentVariance: 15.2,
          targetVariance: 20,
          history
        },
        message: 'Метрике распоређивања успешно учитане'
      };

    } catch (error) {
      logger.error('Error getting load balancing metrics:', error);
      return {
        success: false,
        message: 'Грешка при учитавању метрика распоређивања'
      };
    }
  }

  /**
   * Create default dashboard configuration
   */
  private async createDefaultConfiguration(userId?: string): Promise<DashboardConfiguration> {
    const defaultValues = await this.getDefaultConfigurationValues();
    
    return {
      id: uuidv4(),
      name: 'default_configuration',
      displayName: 'Основна Конфигурација',
      description: 'Стандардна конфигурација система за рутирање тикета',
      userId: userId || 'system',
      isDefault: !userId,
      ...defaultValues,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Get default configuration values
   */
  private async getDefaultConfigurationValues() {
    return {
      routingWeights: {
        skillWeight: 35,
        workloadWeight: 25,
        performanceWeight: 20,
        availabilityWeight: 15,
        categoryExperienceWeight: 5
      },
      loadBalancing: {
        strategy: 'least_loaded' as const,
        isActive: true,
        maxWorkloadDifferencePercent: 20,
        emergencyThreshold: 90,
        rebalanceInterval: 30
      },
      businessHours: {
        startTime: '08:00',
        endTime: '16:00',
        timezone: 'Europe/Belgrade',
        weekdays: [1, 2, 3, 4, 5] // Monday to Friday
      },
      thresholds: {
        routingEfficiencyWarning: 90,
        agentUtilizationWarning: 80,
        agentUtilizationCritical: 95,
        averageConfidenceWarning: 85,
        reroutingRateWarning: 10
      }
    };
  }

  /**
   * Map stress level to Serbian terms
   */
  private mapStressLevel(level: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (level.toLowerCase()) {
      case 'low': return 'low';
      case 'medium': return 'medium';
      case 'high': return 'high';
      case 'critical': return 'critical';
      default: return 'low';
    }
  }

  /**
   * Initialize sample dashboard data
   */
  async initializeSampleData(): Promise<void> {
    try {
      const configurations = await this.loadData<DashboardConfiguration>(this.configurationsPath);
      
      if (configurations.length === 0) {
        const defaultConfig = await this.createDefaultConfiguration();
        await this.saveData(this.configurationsPath, [defaultConfig]);
        logger.info('Default dashboard configuration created');
      }
      
    } catch (error) {
      logger.error('Error initializing dashboard sample data:', error);
    }
  }
}

export default new RoutingDashboardService(); 