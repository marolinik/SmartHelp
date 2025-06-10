import api from './api';

// Knowledge Base interfaces
export interface KbCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  displayOrder: number;
  isActive: boolean;
  articleCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KbArticle {
  id: string;
  title: string;
  content: string;
  summary?: string;
  status: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
  categoryId: string;
  authorId: string;
  tags?: string[];
  metadata?: any;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  category?: KbCategory;
  author?: {
    id: string;
    displayName: string;
    email: string;
  };
}

export interface KbFeedback {
  id: string;
  articleId: string;
  userId?: string;
  isHelpful: boolean;
  rating?: number;
  comment?: string;
  createdAt: string;
}

export interface KbSearchParams {
  q?: string;
  categoryId?: string;
  tags?: string[];
  status?: string;
  sortBy?: 'relevance' | 'date' | 'popularity' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface KbSearchResult {
  articles: KbArticle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  suggestions?: string[];
}

// Knowledge Base API service
export const knowledgeBaseApi = {
  // Categories
  async getCategories(): Promise<{ data: KbCategory[] }> {
    const response = await api.get('/kb/categories');
    return response;
  },

  async getCategory(id: string): Promise<{ data: KbCategory }> {
    const response = await api.get(`/kb/categories/${id}`);
    return response;
  },

  // Articles
  async getArticles(params: KbSearchParams = {}): Promise<{ data: KbSearchResult }> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v.toString()));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });

    const response = await api.get(`/kb/articles?${searchParams.toString()}`);
    return response;
  },

  async getArticle(id: string, incrementView: boolean = false): Promise<{ data: KbArticle }> {
    const params = incrementView ? '?incrementView=true' : '';
    const response = await api.get(`/kb/articles/${id}${params}`);
    return response;
  },

  async getPopularArticles(limit: number = 10): Promise<{ data: KbArticle[] }> {
    const response = await api.get(`/kb/popular?limit=${limit}`);
    return response;
  },

  async getRecentArticles(limit: number = 10): Promise<{ data: KbArticle[] }> {
    const response = await api.get(`/kb/recent?limit=${limit}`);
    return response;
  },

  async getFeaturedArticles(limit: number = 5): Promise<{ data: KbArticle[] }> {
    const response = await api.get(`/kb/featured?limit=${limit}`);
    return response;
  },

  // Search
  async searchArticles(params: KbSearchParams): Promise<{ data: KbSearchResult }> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v.toString()));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });

    const response = await api.get(`/kb/search?${searchParams.toString()}`);
    return response;
  },

  async getSearchSuggestions(query: string): Promise<{ data: string[] }> {
    const response = await api.get(`/kb/search/suggestions?q=${encodeURIComponent(query)}`);
    return response;
  },

  async getAdvancedSearch(params: KbSearchParams): Promise<{ data: KbSearchResult }> {
    const response = await api.post('/kb/search/advanced', params);
    return response;
  },

  // Article interactions
  async incrementViewCount(articleId: string): Promise<void> {
    await api.post(`/kb/articles/${articleId}/view`);
  },

  async submitFeedback(articleId: string, feedback: {
    isHelpful: boolean;
    rating?: number;
    comment?: string;
  }): Promise<{ data: KbFeedback }> {
    const response = await api.post(`/kb/articles/${articleId}/feedback`, feedback);
    return response;
  },

  async getArticleFeedback(articleId: string): Promise<{ data: KbFeedback[] }> {
    const response = await api.get(`/kb/articles/${articleId}/feedback`);
    return response;
  },

  // Related articles
  async getRelatedArticles(articleId: string, limit: number = 5): Promise<{ data: KbArticle[] }> {
    const response = await api.get(`/kb/articles/${articleId}/related?limit=${limit}`);
    return response;
  },

  async getArticlesByCategory(categoryId: string, params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ data: KbSearchResult }> {
    const searchParams = new URLSearchParams();
    searchParams.append('categoryId', categoryId);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString());
      }
    });

    const response = await api.get(`/kb/articles?${searchParams.toString()}`);
    return response;
  },

  // Statistics
  async getKbStats(): Promise<{ data: any }> {
    const response = await api.get('/kb/stats');
    return response;
  },

  async getCategoryStats(categoryId: string): Promise<{ data: any }> {
    const response = await api.get(`/kb/categories/${categoryId}/stats`);
    return response;
  },

  // Bookmarks (if user is logged in)
  async bookmarkArticle(articleId: string): Promise<void> {
    await api.post(`/kb/articles/${articleId}/bookmark`);
  },

  async unbookmarkArticle(articleId: string): Promise<void> {
    await api.delete(`/kb/articles/${articleId}/bookmark`);
  },

  async getUserBookmarks(): Promise<{ data: KbArticle[] }> {
    const response = await api.get('/kb/bookmarks');
    return response;
  },

  // Tags
  async getPopularTags(limit: number = 20): Promise<{ data: string[] }> {
    const response = await api.get(`/kb/tags/popular?limit=${limit}`);
    return response;
  },

  async getArticlesByTag(tag: string, params: {
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: KbSearchResult }> {
    const searchParams = new URLSearchParams();
    searchParams.append('tag', tag);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    const response = await api.get(`/kb/articles?${searchParams.toString()}`);
    return response;
  }
}; 