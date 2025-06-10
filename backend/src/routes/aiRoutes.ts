/**
 * AI Categorization Routes
 * Routes for automatic ticket categorization using Serbian language AI model
 */

import { Router } from 'express';
import aiCategorizationController from '../controllers/aiCategorizationController';
import aiFeedbackController from '../controllers/aiFeedbackController';
import { authMiddleware } from '../middleware/auth';
import { generalRateLimit, sensitiveRateLimit } from '../middleware/rateLimitMiddleware';

const router = Router();

/**
 * @route POST /api/ai/categorize
 * @desc Predict category for a ticket based on title and description
 * @access Private (requires authentication)
 * @body { title: string, description: string, immediate?: boolean }
 */
router.post('/categorize', 
  authMiddleware,
  generalRateLimit,  // Apply standard API rate limiting
  aiCategorizationController.categorizeTicket
);

/**
 * @route GET /api/ai/categories
 * @desc Get all available categories with Serbian display names
 * @access Private (requires authentication)
 */
router.get('/categories',
  authMiddleware,
  aiCategorizationController.getCategories
);

/**
 * @route GET /api/ai/status
 * @desc Get AI model status and information
 * @access Private (requires authentication)
 */
router.get('/status',
  authMiddleware,
  aiCategorizationController.getModelStatus
);

/**
 * @route POST /api/ai/test
 * @desc Test AI categorization with custom text (for development/testing)
 * @access Private (requires authentication)
 * @body { text: string, expectedCategory?: string }
 */
router.post('/test',
  authMiddleware,
  generalRateLimit,
  aiCategorizationController.testCategorization
);

/**
 * @route POST /api/ai/train
 * @desc Train or retrain the AI model (admin only)
 * @access Private (requires admin authentication)
 * @note This endpoint would typically be restricted to admin users
 */
router.post('/train',
  authMiddleware,
  // TODO: Add admin role check middleware
  sensitiveRateLimit,  // More restrictive rate limiting for training
  aiCategorizationController.trainModel
);

// AI Feedback and Continuous Learning Routes

/**
 * @route POST /api/ai/feedback
 * @desc Record user feedback on AI categorization for continuous learning
 * @access Private (requires authentication)
 * @body { ticketId, originalText, aiPrediction, userCorrection, contextData }
 */
router.post('/feedback',
  authMiddleware,
  generalRateLimit,
  aiFeedbackController.recordFeedback
);

/**
 * @route GET /api/ai/feedback/statistics
 * @desc Get AI feedback statistics and performance metrics
 * @access Private (requires authentication)
 * @query { fromDate?, toDate? }
 */
router.get('/feedback/statistics',
  authMiddleware,
  aiFeedbackController.getFeedbackStatistics
);

/**
 * @route GET /api/ai/feedback/performance
 * @desc Get AI model performance overview
 * @access Private (requires authentication)
 */
router.get('/feedback/performance',
  authMiddleware,
  aiFeedbackController.getPerformanceOverview
);

/**
 * @route GET /api/ai/feedback/unprocessed
 * @desc Get unprocessed feedback for model retraining (admin only)
 * @access Private (requires admin authentication)
 * @query { limit? }
 */
router.get('/feedback/unprocessed',
  authMiddleware,
  // TODO: Add admin role check middleware
  aiFeedbackController.getUnprocessedFeedback
);

/**
 * @route POST /api/ai/feedback/retrain
 * @desc Request model retraining with collected feedback (admin only)
 * @access Private (requires admin authentication)
 * @body { feedbackDataRange, targetCategories?, retrainingConfig }
 */
router.post('/feedback/retrain',
  authMiddleware,
  // TODO: Add admin role check middleware
  sensitiveRateLimit,
  aiFeedbackController.requestModelRetraining
);

/**
 * @route GET /api/ai/feedback/retrain/requests
 * @desc Get model retraining requests (admin only)
 * @access Private (requires admin authentication)
 * @query { status? }
 */
router.get('/feedback/retrain/requests',
  authMiddleware,
  // TODO: Add admin role check middleware
  aiFeedbackController.getRetrainingRequests
);

/**
 * @route POST /api/ai/feedback/mark-processed
 * @desc Mark feedback entries as processed (admin only)
 * @access Private (requires admin authentication)
 * @body { feedbackIds: string[] }
 */
router.post('/feedback/mark-processed',
  authMiddleware,
  // TODO: Add admin role check middleware
  aiFeedbackController.markFeedbackAsProcessed
);

export default router; 