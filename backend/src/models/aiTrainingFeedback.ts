/**
 * AI Training Feedback Model
 * Tracks user corrections to AI categorization suggestions for continuous learning
 */

export interface AITrainingFeedback {
  id: string;
  ticketId: string;
  userId: string;
  originalText: {
    title: string;
    description: string;
  };
  aiPrediction: {
    category: string;
    confidence: number;
    allPredictions: Array<{
      category: string;
      confidence: number;
    }>;
    processingTime: number;
    modelVersion: string;
  };
  userCorrection: {
    selectedCategory: string;
    correctionReason?: string;
    isManualOverride: boolean;
    feedbackType: 'accept' | 'reject' | 'modify';
  };
  contextData: {
    userRole: string;
    department: string;
    sessionId?: string;
    timestamp: string;
    detectedLanguage: 'cyrillic' | 'latin';
    textLength: number;
    keywordCount: number;
  };
  processed: boolean;
  usedForRetraining: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIFeedbackStatistics {
  totalFeedback: number;
  acceptanceRate: number;
  rejectionRate: number;
  overrideRate: number;
  categoryAccuracy: { [category: string]: number };
  confidenceLevelAccuracy: {
    very_high: number;
    high: number;
    medium: number;
    low: number;
  };
  commonCorrections: Array<{
    fromCategory: string;
    toCategory: string;
    count: number;
    examples: string[];
  }>;
  modelPerformanceTrend: Array<{
    date: string;
    accuracy: number;
    feedbackCount: number;
  }>;
}

export interface ModelRetrainingRequest {
  id: string;
  requestedBy: string;
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
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: {
    newAccuracy: number;
    previousAccuracy: number;
    improvementPercentage: number;
    feedbackDataUsed: number;
    trainingTime: number;
  };
  modelVersionBefore: string;
  modelVersionAfter?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export default {
  AITrainingFeedback,
  AIFeedbackStatistics,
  ModelRetrainingRequest
}; 