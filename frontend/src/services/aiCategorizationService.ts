/**
 * AI Categorization Service
 * Frontend service for communicating with AI categorization backend
 */

export interface AIPrediction {
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
}

export interface CategorizationResponse {
  success: boolean;
  prediction?: AIPrediction;
  message?: string;
  error?: string;
}

export interface AICategory {
  key: string;
  displayName: string;
  description: string;
}

export interface AIModelStatus {
  isLoaded: boolean;
  isTraining: boolean;
  categories: string[];
  categoryCount: number;
  vocabularySize: number;
  language: string;
  version: string;
}

class AICategorizationService {
  private baseUrl = '/api/ai';
  private cache = new Map<string, { prediction: AIPrediction; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get authentication token from localStorage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Create request headers with authentication
   */
  private getHeaders(): HeadersInit {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  /**
   * Generate cache key from title and description
   */
  private getCacheKey(title: string, description: string): string {
    return `${title.trim()}_${description.trim()}`.toLowerCase();
  }

  /**
   * Check if cached prediction is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  /**
   * Categorize ticket based on title and description
   */
  async categorizeTicket(
    title: string, 
    description: string, 
    immediate: boolean = true
  ): Promise<CategorizationResponse> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(title, description);
      const cached = this.cache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached.timestamp)) {
        return {
          success: true,
          prediction: cached.prediction
        };
      }

      // Validate input
      if (!title.trim() || !description.trim()) {
        return {
          success: false,
          error: 'Title and description are required'
        };
      }

      const response = await fetch(`${this.baseUrl}/categorize`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          immediate
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Неавторизован приступ. Молимо пријавите се поново.');
        }
        if (response.status === 503) {
          throw new Error('AI сервис тренутно није доступан. Покушајте поново касније.');
        }
        throw new Error(`Грешка сервера: ${response.status}`);
      }

      const data: CategorizationResponse = await response.json();

      // Cache successful prediction
      if (data.success && data.prediction) {
        this.cache.set(cacheKey, {
          prediction: data.prediction,
          timestamp: Date.now()
        });
      }

      return data;
    } catch (error) {
      console.error('AI Categorization error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Непозната грешка при AI категоризацији'
      };
    }
  }

  /**
   * Get available AI categories with Serbian names
   */
  async getCategories(): Promise<{ success: boolean; categories?: AICategory[]; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/categories`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching AI categories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Грешка при учитавању AI категорија'
      };
    }
  }

  /**
   * Get AI model status and information
   */
  async getModelStatus(): Promise<{ success: boolean; status?: AIModelStatus; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching AI model status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Грешка при провери статуса AI модела'
      };
    }
  }

  /**
   * Test AI categorization with custom text
   */
  async testCategorization(
    text: string, 
    expectedCategory?: string
  ): Promise<{ success: boolean; test?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/test`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          text: text.trim(),
          expectedCategory
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('AI Test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Грешка при тестирању AI категоризације'
      };
    }
  }

  /**
   * Get confidence level display information
   */
  getConfidenceDisplay(level: 'very_high' | 'high' | 'medium' | 'low'): {
    label: string;
    color: string;
    description: string;
  } {
    const displays = {
      very_high: {
        label: 'Веома висока',
        color: '#4CAF50',
        description: 'AI је веома сигуран у предлог (90%+)'
      },
      high: {
        label: 'Висока',
        color: '#8BC34A',
        description: 'AI је сигуран у предлог (75-90%)'
      },
      medium: {
        label: 'Средња',
        color: '#FF9800',
        description: 'AI има умерену сигурност (50-75%)'
      },
      low: {
        label: 'Ниска',
        color: '#F44336',
        description: 'AI има ниску сигурност (<50%)'
      }
    };

    return displays[level];
  }

  /**
   * Get language display information
   */
  getLanguageDisplay(language: 'cyrillic' | 'latin'): {
    label: string;
    icon: string;
  } {
    return language === 'cyrillic' 
      ? { label: 'Ћирилица', icon: 'Ћ' }
      : { label: 'Латиница', icon: 'L' };
  }

  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  /**
   * Debounced categorization for real-time suggestions
   */
  private debounceTimeouts = new Map<string, NodeJS.Timeout>();

  async debouncedCategorization(
    title: string,
    description: string,
    callback: (result: CategorizationResponse) => void,
    delay: number = 800
  ): Promise<void> {
    const key = this.getCacheKey(title, description);
    
    // Clear existing timeout for this key
    const existingTimeout = this.debounceTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      const result = await this.categorizeTicket(title, description, true);
      callback(result);
      this.debounceTimeouts.delete(key);
    }, delay);

    this.debounceTimeouts.set(key, timeout);
  }

  /**
   * Cancel pending debounced requests
   */
  cancelPendingRequests(): void {
    for (const timeout of this.debounceTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.debounceTimeouts.clear();
  }

  /**
   * Record feedback when user accepts, rejects, or modifies AI suggestion
   */
  async recordFeedback(
    ticketId: string,
    originalText: { title: string; description: string },
    aiPrediction: AIPrediction,
    userCorrection: {
      selectedCategory: string;
      correctionReason?: string;
      isManualOverride: boolean;
      feedbackType: 'accept' | 'reject' | 'modify';
    }
  ): Promise<{ success: boolean; feedbackId?: string; error?: string }> {
    try {
      const userInfo = this.getUserInfo();
      
      const response = await fetch(`${this.baseUrl}/feedback`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          ticketId,
          originalText,
          aiPrediction: {
            category: aiPrediction.category,
            confidence: aiPrediction.confidence,
            allPredictions: aiPrediction.allPredictions,
            processingTime: aiPrediction.processingTime,
            modelVersion: '1.0' // Should come from API
          },
          userCorrection,
          contextData: {
            userRole: userInfo.role || 'user',
            department: userInfo.department || 'unknown',
            sessionId: this.getSessionId(),
            detectedLanguage: aiPrediction.features.detectedLanguage,
            textLength: aiPrediction.features.textLength,
            keywordCount: aiPrediction.features.keywordCount
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error recording AI feedback:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Грешка при слању повратне информације'
      };
    }
  }

  /**
   * Get feedback statistics for administrators
   */
  async getFeedbackStatistics(dateRange?: {
    fromDate: string;
    toDate: string;
  }): Promise<{ success: boolean; statistics?: any; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('fromDate', dateRange.fromDate);
        params.append('toDate', dateRange.toDate);
      }

      const response = await fetch(`${this.baseUrl}/feedback/statistics?${params}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching feedback statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Грешка при учитавању статистика'
      };
    }
  }

  /**
   * Get model performance overview
   */
  async getPerformanceOverview(): Promise<{ success: boolean; overview?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/feedback/performance`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching performance overview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Грешка при учитавању прегледа перформанси'
      };
    }
  }

  /**
   * Get user information from localStorage or context
   */
  private getUserInfo(): { role?: string; department?: string } {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          role: user.role,
          department: user.department
        };
      }
    } catch (error) {
      console.warn('Could not get user info from localStorage');
    }
    return {};
  }

  /**
   * Get or generate session ID for tracking
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('aiCategorization_sessionId');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('aiCategorization_sessionId', sessionId);
    }
    return sessionId;
     }
 }

// Export singleton instance
const aiCategorizationService = new AICategorizationService();
export default aiCategorizationService; 