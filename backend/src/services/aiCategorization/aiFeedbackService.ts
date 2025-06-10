/**
 * AI Feedback Service
 * Handles collection and analysis of user feedback for AI categorization continuous learning
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AITrainingFeedback,
  AIFeedbackStatistics,
  ModelRetrainingRequest
} from '../../models/aiTrainingFeedback';
import { logger } from '../../utils/logger';

export class AIFeedbackService {
  private feedbackStorePath: string;
  private statisticsPath: string;
  private retrainingRequestsPath: string;

  constructor() {
    const dataDir = path.join(__dirname, '../../../..', 'data/ai-feedback');
    this.feedbackStorePath = path.join(dataDir, 'feedback.json');
    this.statisticsPath = path.join(dataDir, 'statistics.json');
    this.retrainingRequestsPath = path.join(dataDir, 'retraining-requests.json');
    this.ensureDirectoriesExist();
  }

  /**
   * Ensure feedback data directories exist
   */
  private async ensureDirectoriesExist(): Promise<void> {
    try {
      const dataDir = path.dirname(this.feedbackStorePath);
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating feedback directories:', error);
    }
  }

  /**
   * Record user feedback when they accept, reject, or modify AI categorization
   */
  async recordFeedback(
    ticketId: string,
    userId: string,
    originalText: { title: string; description: string },
    aiPrediction: any,
    userCorrection: {
      selectedCategory: string;
      correctionReason?: string;
      isManualOverride: boolean;
      feedbackType: 'accept' | 'reject' | 'modify';
    },
    contextData: {
      userRole: string;
      department: string;
      sessionId?: string;
      detectedLanguage: 'cyrillic' | 'latin';
      textLength: number;
      keywordCount: number;
    }
  ): Promise<string> {
    try {
      const feedbackId = uuidv4();
      const timestamp = new Date().toISOString();

      const feedback: AITrainingFeedback = {
        id: feedbackId,
        ticketId,
        userId,
        originalText,
        aiPrediction: {
          ...aiPrediction,
          modelVersion: '1.0' // This should come from the actual model version
        },
        userCorrection,
        contextData: {
          ...contextData,
          timestamp
        },
        processed: false,
        usedForRetraining: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      // Load existing feedback
      const existingFeedback = await this.loadFeedbackData();
      existingFeedback.push(feedback);

      // Save updated feedback
      await this.saveFeedbackData(existingFeedback);

      // Update statistics
      await this.updateStatistics();

      logger.info(`AI feedback recorded: ${feedbackId}`, {
        ticketId,
        feedbackType: userCorrection.feedbackType,
        isOverride: userCorrection.isManualOverride,
        aiCategory: aiPrediction.category,
        userCategory: userCorrection.selectedCategory
      });

      return feedbackId;
    } catch (error) {
      logger.error('Error recording AI feedback:', error);
      throw new Error('Failed to record AI feedback');
    }
  }

  /**
   * Load feedback data from storage
   */
  private async loadFeedbackData(): Promise<AITrainingFeedback[]> {
    try {
      const data = await fs.readFile(this.feedbackStorePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, return empty array
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Save feedback data to storage
   */
  private async saveFeedbackData(feedback: AITrainingFeedback[]): Promise<void> {
    const data = JSON.stringify(feedback, null, 2);
    await fs.writeFile(this.feedbackStorePath, data, 'utf-8');
  }

  /**
   * Get feedback statistics for analysis
   */
  async getFeedbackStatistics(dateRange?: {
    fromDate: string;
    toDate: string;
  }): Promise<AIFeedbackStatistics> {
    try {
      const feedback = await this.loadFeedbackData();
      let filteredFeedback = feedback;

      // Apply date filter if provided
      if (dateRange) {
        const fromDate = new Date(dateRange.fromDate);
        const toDate = new Date(dateRange.toDate);
        filteredFeedback = feedback.filter(f => {
          const feedbackDate = new Date(f.createdAt);
          return feedbackDate >= fromDate && feedbackDate <= toDate;
        });
      }

      const totalFeedback = filteredFeedback.length;
      if (totalFeedback === 0) {
        return this.getEmptyStatistics();
      }

      // Calculate basic rates
      const acceptCount = filteredFeedback.filter(f => f.userCorrection.feedbackType === 'accept').length;
      const rejectCount = filteredFeedback.filter(f => f.userCorrection.feedbackType === 'reject').length;
      const overrideCount = filteredFeedback.filter(f => f.userCorrection.isManualOverride).length;

      const acceptanceRate = (acceptCount / totalFeedback) * 100;
      const rejectionRate = (rejectCount / totalFeedback) * 100;
      const overrideRate = (overrideCount / totalFeedback) * 100;

      // Calculate category accuracy
      const categoryAccuracy: { [category: string]: number } = {};
      const categoryStats: { [category: string]: { correct: number; total: number } } = {};

      filteredFeedback.forEach(f => {
        const aiCategory = f.aiPrediction.category;
        const userCategory = f.userCorrection.selectedCategory;

        if (!categoryStats[aiCategory]) {
          categoryStats[aiCategory] = { correct: 0, total: 0 };
        }

        categoryStats[aiCategory].total++;
        if (aiCategory === userCategory) {
          categoryStats[aiCategory].correct++;
        }
      });

      Object.keys(categoryStats).forEach(category => {
        const stats = categoryStats[category];
        if (stats) {
          categoryAccuracy[category] = (stats.correct / stats.total) * 100;
        }
      });

      // Calculate confidence level accuracy
      const confidenceLevelAccuracy = {
        very_high: this.calculateConfidenceLevelAccuracy(filteredFeedback, 90, 100),
        high: this.calculateConfidenceLevelAccuracy(filteredFeedback, 75, 90),
        medium: this.calculateConfidenceLevelAccuracy(filteredFeedback, 50, 75),
        low: this.calculateConfidenceLevelAccuracy(filteredFeedback, 0, 50)
      };

      // Find common corrections
      const commonCorrections = this.findCommonCorrections(filteredFeedback);

      // Generate performance trend (last 30 days)
      const modelPerformanceTrend = this.calculatePerformanceTrend(filteredFeedback);

      return {
        totalFeedback,
        acceptanceRate,
        rejectionRate,
        overrideRate,
        categoryAccuracy,
        confidenceLevelAccuracy,
        commonCorrections,
        modelPerformanceTrend
      };
    } catch (error) {
      logger.error('Error getting feedback statistics:', error);
      throw new Error('Failed to get feedback statistics');
    }
  }

  /**
   * Calculate accuracy for a specific confidence level range
   */
  private calculateConfidenceLevelAccuracy(
    feedback: AITrainingFeedback[],
    minConfidence: number,
    maxConfidence: number
  ): number {
    const relevantFeedback = feedback.filter(f => {
      const confidence = f.aiPrediction.confidence * 100;
      return confidence >= minConfidence && confidence < maxConfidence;
    });

    if (relevantFeedback.length === 0) return 0;

    const correctPredictions = relevantFeedback.filter(f =>
      f.aiPrediction.category === f.userCorrection.selectedCategory
    ).length;

    return (correctPredictions / relevantFeedback.length) * 100;
  }

  /**
   * Find most common correction patterns
   */
  private findCommonCorrections(feedback: AITrainingFeedback[]): Array<{
    fromCategory: string;
    toCategory: string;
    count: number;
    examples: string[];
  }> {
    const corrections: { [key: string]: { count: number; examples: string[] } } = {};

    feedback.forEach(f => {
      if (f.userCorrection.isManualOverride) {
        const key = `${f.aiPrediction.category}_to_${f.userCorrection.selectedCategory}`;
        if (!corrections[key]) {
          corrections[key] = { count: 0, examples: [] };
        }
        corrections[key].count++;
        if (corrections[key].examples.length < 3) {
          corrections[key].examples.push(f.originalText.title);
        }
      }
    });

    return Object.entries(corrections)
      .map(([key, data]) => {
        const [fromCategory, toCategory] = key.split('_to_');
        return {
          fromCategory: fromCategory || '',
          toCategory: toCategory || '',
          count: data.count,
          examples: data.examples
        };
      })
      .filter(item => item.fromCategory && item.toCategory) // Filter out invalid entries
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 corrections
  }

  /**
   * Calculate model performance trend over time
   */
  private calculatePerformanceTrend(feedback: AITrainingFeedback[]): Array<{
    date: string;
    accuracy: number;
    feedbackCount: number;
  }> {
    // Group feedback by day
    const dailyStats: { [date: string]: { correct: number; total: number } } = {};

    feedback.forEach(f => {
      const date = f.createdAt.split('T')[0]; // Get YYYY-MM-DD
      if (!dailyStats[date]) {
        dailyStats[date] = { correct: 0, total: 0 };
      }
      const dayStats = dailyStats[date];
      if (dayStats) {
        dayStats.total++;
        if (f.aiPrediction.category === f.userCorrection.selectedCategory) {
          dayStats.correct++;
        }
      }
    });

    return Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        accuracy: (stats.correct / stats.total) * 100,
        feedbackCount: stats.total
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }

  /**
   * Get empty statistics structure
   */
  private getEmptyStatistics(): AIFeedbackStatistics {
    return {
      totalFeedback: 0,
      acceptanceRate: 0,
      rejectionRate: 0,
      overrideRate: 0,
      categoryAccuracy: {},
      confidenceLevelAccuracy: {
        very_high: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      commonCorrections: [],
      modelPerformanceTrend: []
    };
  }

  /**
   * Update cached statistics
   */
  private async updateStatistics(): Promise<void> {
    try {
      const statistics = await this.getFeedbackStatistics();
      const data = JSON.stringify(statistics, null, 2);
      await fs.writeFile(this.statisticsPath, data, 'utf-8');
    } catch (error) {
      logger.error('Error updating statistics:', error);
    }
  }

  /**
   * Get unprocessed feedback for model retraining
   */
  async getUnprocessedFeedback(limit?: number): Promise<AITrainingFeedback[]> {
    try {
      const feedback = await this.loadFeedbackData();
      const unprocessed = feedback.filter(f => !f.usedForRetraining);
      
      return limit ? unprocessed.slice(0, limit) : unprocessed;
    } catch (error) {
      logger.error('Error getting unprocessed feedback:', error);
      throw new Error('Failed to get unprocessed feedback');
    }
  }

  /**
   * Mark feedback as used for retraining
   */
  async markFeedbackAsProcessed(feedbackIds: string[]): Promise<void> {
    try {
      const feedback = await this.loadFeedbackData();
      const updatedFeedback = feedback.map(f => {
        if (feedbackIds.includes(f.id)) {
          return {
            ...f,
            usedForRetraining: true,
            processed: true,
            updatedAt: new Date().toISOString()
          };
        }
        return f;
      });

      await this.saveFeedbackData(updatedFeedback);
      logger.info(`Marked ${feedbackIds.length} feedback entries as processed`);
    } catch (error) {
      logger.error('Error marking feedback as processed:', error);
      throw new Error('Failed to mark feedback as processed');
    }
  }

  /**
   * Request model retraining with collected feedback
   */
  async requestModelRetraining(
    requestedBy: string,
    config: {
      feedbackDataRange: {
        fromDate: string;
        toDate: string;
        minimumFeedbackCount: number;
      };
      targetCategories?: string[];
      retrainingConfig: {
        epochs: number;
        batchSize: number;
        validationSplit: number;
        learningRate: number;
      };
    }
  ): Promise<string> {
    try {
      const requestId = uuidv4();
      const timestamp = new Date().toISOString();

      const request: ModelRetrainingRequest = {
        id: requestId,
        requestedBy,
        feedbackDataRange: config.feedbackDataRange,
        ...(config.targetCategories && { targetCategories: config.targetCategories }),
        retrainingConfig: config.retrainingConfig,
        status: 'pending',
        progress: 0,
        modelVersionBefore: '1.0', // Should get from actual model
        createdAt: timestamp
      };

      // Load existing requests
      const existingRequests = await this.loadRetrainingRequests();
      existingRequests.push(request);

      // Save updated requests
      await this.saveRetrainingRequests(existingRequests);

      logger.info(`Model retraining requested: ${requestId}`, {
        requestedBy,
        feedbackDateRange: config.feedbackDataRange
      });

      return requestId;
    } catch (error) {
      logger.error('Error requesting model retraining:', error);
      throw new Error('Failed to request model retraining');
    }
  }

  /**
   * Load retraining requests from storage
   */
  private async loadRetrainingRequests(): Promise<ModelRetrainingRequest[]> {
    try {
      const data = await fs.readFile(this.retrainingRequestsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Save retraining requests to storage
   */
  private async saveRetrainingRequests(requests: ModelRetrainingRequest[]): Promise<void> {
    const data = JSON.stringify(requests, null, 2);
    await fs.writeFile(this.retrainingRequestsPath, data, 'utf-8');
  }

  /**
   * Get all retraining requests
   */
  async getRetrainingRequests(status?: string): Promise<ModelRetrainingRequest[]> {
    try {
      const requests = await this.loadRetrainingRequests();
      return status ? requests.filter(r => r.status === status) : requests;
    } catch (error) {
      logger.error('Error getting retraining requests:', error);
      throw new Error('Failed to get retraining requests');
    }
  }
}

export default new AIFeedbackService(); 