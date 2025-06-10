/**
 * AI Feedback Controller
 * Handles feedback collection for AI categorization and model retraining
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import aiFeedbackService from '../services/aiCategorization/aiFeedbackService';
import { logger } from '../utils/logger';

// Validation schemas
const feedbackSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  originalText: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(1, 'Description is required')
  }),
  aiPrediction: z.object({
    category: z.string(),
    confidence: z.number().min(0).max(1),
    allPredictions: z.array(z.object({
      category: z.string(),
      confidence: z.number()
    })),
    processingTime: z.number(),
    modelVersion: z.string().optional().default('1.0')
  }),
  userCorrection: z.object({
    selectedCategory: z.string().min(1, 'Selected category is required'),
    correctionReason: z.string().optional(),
    isManualOverride: z.boolean(),
    feedbackType: z.enum(['accept', 'reject', 'modify'])
  }),
  contextData: z.object({
    userRole: z.string(),
    department: z.string(),
    sessionId: z.string().optional(),
    detectedLanguage: z.enum(['cyrillic', 'latin']),
    textLength: z.number(),
    keywordCount: z.number()
  })
});

const retrainingRequestSchema = z.object({
  feedbackDataRange: z.object({
    fromDate: z.string(),
    toDate: z.string(),
    minimumFeedbackCount: z.number().min(1)
  }),
  targetCategories: z.array(z.string()).optional(),
  retrainingConfig: z.object({
    epochs: z.number().min(1).max(100),
    batchSize: z.number().min(1).max(512),
    validationSplit: z.number().min(0.1).max(0.5),
    learningRate: z.number().min(0.0001).max(0.1)
  })
});

/**
 * Record user feedback on AI categorization
 * POST /api/ai/feedback
 */
export const recordFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('AI feedback submission received');

    // Validate request
    const validation = feedbackSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid feedback data',
        details: validation.error.errors
      });
      return;
    }

    const data = validation.data;
    const userId = (req as any).user?.id || 'unknown';

    // Record feedback
    const userCorrection = {
      selectedCategory: data.userCorrection.selectedCategory,
      isManualOverride: data.userCorrection.isManualOverride,
      feedbackType: data.userCorrection.feedbackType,
      ...(data.userCorrection.correctionReason && { correctionReason: data.userCorrection.correctionReason })
    };

    const contextData = {
      userRole: data.contextData.userRole,
      department: data.contextData.department,
      detectedLanguage: data.contextData.detectedLanguage,
      textLength: data.contextData.textLength,
      keywordCount: data.contextData.keywordCount,
      ...(data.contextData.sessionId && { sessionId: data.contextData.sessionId })
    };

    const feedbackId = await aiFeedbackService.recordFeedback(
      data.ticketId,
      userId,
      data.originalText,
      data.aiPrediction,
      userCorrection,
      contextData
    );

    console.log('AI feedback recorded successfully:', {
      feedbackId,
      ticketId: data.ticketId,
      feedbackType: data.userCorrection.feedbackType,
      isOverride: data.userCorrection.isManualOverride
    });

    res.status(201).json({
      success: true,
      feedbackId,
      message: 'Повратна информација је успешно забележена'
    });
  } catch (error) {
    logger.error('Error recording AI feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record feedback',
      message: 'Грешка при бележењу повратне информације'
    });
  }
};

/**
 * Get feedback statistics
 * GET /api/ai/feedback/statistics
 */
export const getFeedbackStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fromDate, toDate } = req.query;

    let dateRange;
    if (fromDate && toDate) {
      dateRange = {
        fromDate: fromDate as string,
        toDate: toDate as string
      };
    }

    const statistics = await aiFeedbackService.getFeedbackStatistics(dateRange);

    res.status(200).json({
      success: true,
      statistics,
      message: 'Статистике успешно учитане'
    });
  } catch (error) {
    logger.error('Error getting feedback statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: 'Грешка при учитавању статистика'
    });
  }
};

/**
 * Get unprocessed feedback for retraining
 * GET /api/ai/feedback/unprocessed
 */
export const getUnprocessedFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const unprocessedFeedback = await aiFeedbackService.getUnprocessedFeedback(limit);

    res.status(200).json({
      success: true,
      feedback: unprocessedFeedback,
      count: unprocessedFeedback.length,
      message: 'Необработена повратна информација учитана'
    });
  } catch (error) {
    logger.error('Error getting unprocessed feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unprocessed feedback',
      message: 'Грешка при учитавању необработене повратне информације'
    });
  }
};

/**
 * Request model retraining
 * POST /api/ai/feedback/retrain
 */
export const requestModelRetraining = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Model retraining request received');

    // Validate request
    const validation = retrainingRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid retraining request data',
        details: validation.error.errors
      });
      return;
    }

    const data = validation.data;
    const requestedBy = (req as any).user?.id || 'unknown';

    // Check if user has admin privileges (this should be implemented in middleware)
    // For now, we'll allow the request but log it
    if (!(req as any).user?.isAdmin) {
      logger.warn(`Non-admin user ${requestedBy} requested model retraining`);
    }

    // Request retraining
    const retrainingConfig = {
      feedbackDataRange: data.feedbackDataRange,
      retrainingConfig: data.retrainingConfig,
      ...(data.targetCategories && { targetCategories: data.targetCategories })
    };
    
    const requestId = await aiFeedbackService.requestModelRetraining(requestedBy, retrainingConfig);

    logger.info('Model retraining requested:', {
      requestId,
      requestedBy,
      feedbackDateRange: data.feedbackDataRange
    });

    res.status(201).json({
      success: true,
      requestId,
      message: 'Захтев за преобуку модела је послат'
    });
  } catch (error) {
    logger.error('Error requesting model retraining:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request retraining',
      message: 'Грешка при слању захтева за преобуку'
    });
  }
};

/**
 * Get retraining requests
 * GET /api/ai/feedback/retrain/requests
 */
export const getRetrainingRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string;
    const requests = await aiFeedbackService.getRetrainingRequests(status);

    res.status(200).json({
      success: true,
      requests,
      count: requests.length,
      message: 'Захтеви за преобуку учитани'
    });
  } catch (error) {
    logger.error('Error getting retraining requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get retraining requests',
      message: 'Грешка при учитавању захтева за преобуку'
    });
  }
};

/**
 * Mark feedback as processed
 * POST /api/ai/feedback/mark-processed
 */
export const markFeedbackAsProcessed = async (req: Request, res: Response): Promise<void> => {
  try {
    const { feedbackIds } = req.body;

    if (!Array.isArray(feedbackIds) || feedbackIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Feedback IDs array is required'
      });
      return;
    }

    await aiFeedbackService.markFeedbackAsProcessed(feedbackIds);

    res.status(200).json({
      success: true,
      message: `${feedbackIds.length} feedback entries marked as processed`,
      serbianMessage: `${feedbackIds.length} повратних информација је означено као обрађено`
    });
  } catch (error) {
    logger.error('Error marking feedback as processed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark feedback as processed'
    });
  }
};

/**
 * Get AI model performance overview
 * GET /api/ai/feedback/performance
 */
export const getPerformanceOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const statistics = await aiFeedbackService.getFeedbackStatistics();
    
    // Create performance overview
    const overview = {
      overallAccuracy: statistics.acceptanceRate,
      totalFeedback: statistics.totalFeedback,
      modelPerformance: {
        excellent: statistics.confidenceLevelAccuracy.very_high,
        good: statistics.confidenceLevelAccuracy.high,
        fair: statistics.confidenceLevelAccuracy.medium,
        poor: statistics.confidenceLevelAccuracy.low
      },
      topIssues: statistics.commonCorrections.slice(0, 5),
      recentTrend: statistics.modelPerformanceTrend.slice(-7), // Last 7 days
      categoryPerformance: Object.entries(statistics.categoryAccuracy)
        .map(([category, accuracy]) => ({ category, accuracy }))
        .sort((a, b) => b.accuracy - a.accuracy)
    };

    res.status(200).json({
      success: true,
      overview,
      message: 'Преглед перформанси модела учитан'
    });
  } catch (error) {
    logger.error('Error getting performance overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance overview'
    });
  }
};

export default {
  recordFeedback,
  getFeedbackStatistics,
  getUnprocessedFeedback,
  requestModelRetraining,
  getRetrainingRequests,
  markFeedbackAsProcessed,
  getPerformanceOverview
}; 