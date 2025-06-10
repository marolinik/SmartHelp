/**
 * AI Categorization Controller
 * Handles requests for automatic ticket categorization using Serbian language AI model
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import aiModelService from '../services/aiCategorization/aiModelService';
import dataPreprocessingService from '../services/aiCategorization/dataPreprocessingService';

// Validation schemas
const categorizationRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(3, 'Description must be at least 3 characters').max(2000, 'Description too long'),
  immediate: z.boolean().optional().default(true)
});

const testRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  expectedCategory: z.string().optional()
});

export interface CategorizationResponse {
  success: boolean;
  prediction?: {
    category: string;
    categoryDisplayName: string;
    confidence: number;
    confidenceLevel: 'very_high' | 'high' | 'medium' | 'low';
    allPredictions: Array<{
      category: string;
      categoryDisplayName: string;
      confidence: number;
    }>;
    processingTime: number;
    features: {
      textLength: number;
      keywordCount: number;
      detectedLanguage: 'cyrillic' | 'latin';
      suggestedKeywords: string[];
    };
  };
  message?: string;
  error?: string;
}

/**
 * Category display names in Serbian
 */
const CATEGORY_DISPLAY_NAMES: { [key: string]: string } = {
  'HARDWARE': 'Хардвер',
  'SOFTWARE': 'Софтвер', 
  'NETWORK': 'Мрежа и интернет',
  'ACCOUNT_ACCESS': 'Налог и приступ',
  'PASSWORDS': 'Лозинке',
  'EMAIL': 'Електронска пошта',
  'SYSTEM_ERRORS': 'Системске грешке',
  'TRAINING_SUPPORT': 'Обука и подршка',
  'NEW_REQUESTS': 'Нови захтеви',
  'OTHER': 'Остало'
};

/**
 * Determine confidence level based on numerical confidence
 */
function getConfidenceLevel(confidence: number): 'very_high' | 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'very_high';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Extract suggested keywords from ticket text
 */
async function extractSuggestedKeywords(text: string): Promise<string[]> {
  try {
    // Use preprocessing service to extract keywords
    const mockTicket = {
      id: 0,
      title: text.split(' ').slice(0, 5).join(' '),
      description: text,
      category: 'UNKNOWN',
      priority: 'medium',
      reporter: 'AI Analysis',
      department: 'System',
      created_date: new Date().toISOString(),
      keywords: []
    };

    const processed = dataPreprocessingService.processTicket(mockTicket);
    return processed.combinedFeatures.keywords.slice(0, 5); // Top 5 keywords
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return [];
  }
}

/**
 * Predict ticket category
 * POST /api/ai/categorize
 */
export const categorizeTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('AI Categorization request received:', { 
      title: req.body.title?.substring(0, 50) + '...', 
      hasDescription: !!req.body.description 
    });

    // Validate request
    const validation = categorizationRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        message: validation.error.errors.map(e => e.message).join(', ')
      } as CategorizationResponse);
      return;
    }

    const { title, description, immediate } = validation.data;

    // Check if model is loaded
    const modelInfo = aiModelService.getModelInfo();
    if (!modelInfo.isLoaded) {
      try {
        console.log('Loading AI model...');
        await aiModelService.loadModel();
      } catch (error) {
        console.error('Failed to load AI model:', error);
        res.status(503).json({
          success: false,
          error: 'AI service unavailable',
          message: 'Model could not be loaded. Please try again later.'
        } as CategorizationResponse);
        return;
      }
    }

    // Get prediction
    const prediction = await aiModelService.predictTicketCategory(title, description);

    // Extract suggested keywords
    const suggestedKeywords = await extractSuggestedKeywords(`${title} ${description}`);

    // Format response
    const response: CategorizationResponse = {
      success: true,
      prediction: {
        category: prediction.category,
        categoryDisplayName: CATEGORY_DISPLAY_NAMES[prediction.category] || prediction.category,
        confidence: prediction.confidence,
        confidenceLevel: getConfidenceLevel(prediction.confidence),
        allPredictions: prediction.allPredictions.map(pred => ({
          category: pred.category,
          categoryDisplayName: CATEGORY_DISPLAY_NAMES[pred.category] || pred.category,
          confidence: pred.confidence
        })),
        processingTime: prediction.processingTime,
        features: {
          textLength: prediction.features.textLength,
          keywordCount: prediction.features.keywordCount,
          detectedLanguage: prediction.features.detectedLanguage,
          suggestedKeywords
        }
      }
    };

    console.log('AI Categorization successful:', {
      category: prediction.category,
      confidence: prediction.confidence.toFixed(3),
      processingTime: prediction.processingTime + 'ms'
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('AI Categorization error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process categorization request'
    } as CategorizationResponse);
  }
};

/**
 * Get available categories with Serbian names
 * GET /api/ai/categories
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = Object.entries(CATEGORY_DISPLAY_NAMES).map(([key, displayName]) => ({
      key,
      displayName,
      description: getCategoryDescription(key)
    }));

    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories'
    });
  }
};

/**
 * Get category descriptions in Serbian
 */
function getCategoryDescription(category: string): string {
  const descriptions: { [key: string]: string } = {
    'HARDWARE': 'Проблеми са рачунарима, штампачима, мониторима и другим уређајима',
    'SOFTWARE': 'Проблеми са програмима, апликацијама и софтверским грешкама',
    'NETWORK': 'Проблеми са интернетом, мрежом и конекцијом',
    'ACCOUNT_ACCESS': 'Проблеми са корисничким налозима и правима приступа',
    'PASSWORDS': 'Проблеми са лозинкама, ресетовање и промена',
    'EMAIL': 'Проблеми са електронском поштом',
    'SYSTEM_ERRORS': 'Системске грешке, крахови и нестабилност',
    'TRAINING_SUPPORT': 'Обука корисника и техничка подршка',
    'NEW_REQUESTS': 'Нови захтеви за инсталацију или постављање',
    'OTHER': 'Остали проблеми који не спадају у дефинисане категорије'
  };

  return descriptions[category] || 'Непозната категорија';
}

/**
 * Get model status and information
 * GET /api/ai/status
 */
export const getModelStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const modelInfo = aiModelService.getModelInfo();
    
    res.status(200).json({
      success: true,
      status: {
        isLoaded: modelInfo.isLoaded,
        isTraining: modelInfo.isTraining,
        categories: modelInfo.categories,
        categoryCount: modelInfo.categories.length,
        vocabularySize: modelInfo.vocabularySize,
        language: 'serbian',
        version: '1.0'
      }
    });
  } catch (error) {
    console.error('Error getting model status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get model status'
    });
  }
};

/**
 * Test AI categorization with custom text
 * POST /api/ai/test
 */
export const testCategorization = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request
    const validation = testRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        message: validation.error.errors.map(e => e.message).join(', ')
      });
      return;
    }

    const { text, expectedCategory } = validation.data;

    // Use first few words as title, rest as description
    const words = text.split(' ');
    const title = words.slice(0, 5).join(' ');
    const description = words.slice(5).join(' ') || title;

    // Get prediction
    const prediction = await aiModelService.predictTicketCategory(title, description);

    // Check if prediction matches expected category
    const isCorrect = expectedCategory ? prediction.category === expectedCategory : undefined;

    res.status(200).json({
      success: true,
      test: {
        input: text,
        prediction: {
          category: prediction.category,
          categoryDisplayName: CATEGORY_DISPLAY_NAMES[prediction.category] || prediction.category,
          confidence: prediction.confidence,
          confidenceLevel: getConfidenceLevel(prediction.confidence)
        },
        expected: expectedCategory ? {
          category: expectedCategory,
          categoryDisplayName: CATEGORY_DISPLAY_NAMES[expectedCategory] || expectedCategory
        } : undefined,
        isCorrect,
        processingTime: prediction.processingTime,
        detectedLanguage: prediction.features.detectedLanguage
      }
    });
  } catch (error) {
    console.error('AI Test error:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed'
    });
  }
};

/**
 * Train or retrain the model (admin only)
 * POST /api/ai/train
 */
export const trainModel = async (req: Request, res: Response): Promise<void> => {
  try {
    // This would typically require admin authentication
    // For now, just return information about training
    
    res.status(200).json({
      success: true,
      message: 'Model training functionality available',
      info: {
        description: 'Use dataPreprocessingService.runPreprocessingPipeline() and aiModelService.trainModel()',
        note: 'Training requires proper dataset and can take several minutes'
      }
    });
  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({
      success: false,
      error: 'Training failed'
    });
  }
};

export default {
  categorizeTicket,
  getCategories,
  getModelStatus,
  testCategorization,
  trainModel
}; 