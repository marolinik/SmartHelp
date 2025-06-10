import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';

export interface SearchQuery {
  query: string;
  categoryId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date' | 'popularity' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  summary?: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
  };
  author: {
    id: string;
    displayName: string;
    firstName: string;
    lastName: string;
  };
  tags: string[];
  viewCount: number;
  helpfulCount: number;
  publishedAt: Date | null;
  relevanceScore?: number;
  matchedFields: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  executionTime: number;
  suggestions?: string[];
}

export class SearchService {
  /**
   * Српски карактери за нормализацију претраге
   */
  private static readonly SERBIAN_CHAR_MAP = {
    'ž': 'z', 'đ': 'dj', 'č': 'c', 'ć': 'c', 'š': 's',
    'Ž': 'Z', 'Đ': 'DJ', 'Č': 'C', 'Ć': 'C', 'Š': 'S'
  };

  /**
   * Главна претрага чланака
   */
  async searchArticles(searchQuery: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      const {
        query,
        categoryId,
        tags,
        limit = 20,
        offset = 0,
        sortBy = 'relevance',
        sortOrder = 'desc'
      } = searchQuery;

      logger.info(`Претрага KB чланака: "${query}"`, { categoryId, tags, limit, offset });

      // Нормализује упит за претрагу
      const normalizedQuery = this.normalizeSearchQuery(query);
      const searchTerms = this.extractSearchTerms(normalizedQuery);

      // Припрема WHERE услове
      const whereConditions: any = {
        status: 'published' // Претражује само објављене чланке
      };

      if (categoryId) {
        whereConditions.categoryId = categoryId;
      }

      if (tags && tags.length > 0) {
        // За SQLite, тагови су JSON стринг
        whereConditions.AND = tags.map(tag => ({
          tags: { contains: tag }
        }));
      }

      // Извршава претрагу
      const [results, total] = await Promise.all([
        this.executeSearch(whereConditions, searchTerms, limit, offset, sortBy, sortOrder),
        this.countSearchResults(whereConditions, searchTerms)
      ]);

      // Калкулише време извршавања
      const executionTime = Date.now() - startTime;

      // Генерише предлоге ако нема резултата
      let suggestions: string[] | undefined;
      if (results.length === 0 && query.length > 2) {
        suggestions = await this.generateSuggestions(query);
      }

      logger.info(`Претрага завршена: ${results.length}/${total} резултата за "${query}" (${executionTime}ms)`);

      return {
        results,
        total,
        query,
        executionTime,
        suggestions
      };
    } catch (error) {
      logger.error('Грешка при претрази KB чланака:', error);
      throw new Error('Грешка при претрази чланака');
    }
  }

  /**
   * Нормализује упит за претрагу (уклања специјалне карактере, нормализује српски)
   */
  private normalizeSearchQuery(query: string): string {
    let normalized = query.toLowerCase().trim();
    
    // Замењује српске карактере алтернативама
    Object.entries(SearchService.SERBIAN_CHAR_MAP).forEach(([srb, lat]) => {
      normalized = normalized.replace(new RegExp(srb, 'g'), lat);
    });
    
    return normalized;
  }

  /**
   * Извлачи појмове за претрагу из упита
   */
  private extractSearchTerms(query: string): string[] {
    // Дели упит на речи, уклања празне стрингове и кратке речи
    return query
      .split(/\s+/)
      .filter(term => term.length >= 2)
      .map(term => term.replace(/[^\w\u0400-\u04FF]/g, '')) // Очување ћирилице
      .filter(term => term.length >= 2);
  }

  /**
   * Извршава главну претрагу у бази
   */
  private async executeSearch(
    whereConditions: any,
    searchTerms: string[],
    limit: number,
    offset: number,
    sortBy: string,
    sortOrder: string
  ): Promise<SearchResult[]> {
    
    // Проширује WHERE услове са претрагом
    if (searchTerms.length > 0) {
      const searchConditions = searchTerms.map(term => ({
        OR: [
          { title: { contains: term, mode: 'insensitive' as const } },
          { content: { contains: term, mode: 'insensitive' as const } },
          { summary: { contains: term, mode: 'insensitive' as const } }
        ]
      }));

      if (whereConditions.AND) {
        whereConditions.AND.push(...searchConditions);
      } else {
        whereConditions.AND = searchConditions;
      }
    }

    // Припрема orderBy
    let orderBy: any = {};
    switch (sortBy) {
      case 'date':
        orderBy = { publishedAt: sortOrder };
        break;
      case 'popularity':
        orderBy = { viewCount: sortOrder };
        break;
      case 'title':
        orderBy = { title: sortOrder };
        break;
      case 'relevance':
      default:
        // За релевантност, сортира по популарности и датуму
        orderBy = [
          { viewCount: 'desc' },
          { helpfulCount: 'desc' },
          { publishedAt: 'desc' }
        ];
        break;
    }

    const articles = await prisma.kbArticle.findMany({
      where: whereConditions,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        author: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy,
      take: limit,
      skip: offset
    });

    // Конвертује резултате у SearchResult формат
    return articles.map(article => {
      const tags = article.tags ? JSON.parse(article.tags) : [];
      const matchedFields = this.findMatchedFields(article, searchTerms);
      
      return {
        id: article.id,
        title: article.title,
        content: article.content,
        summary: article.summary || undefined,
        categoryId: article.categoryId || undefined,
        category: article.category || undefined,
        author: article.author,
        tags,
        viewCount: article.viewCount,
        helpfulCount: article.helpfulCount,
        publishedAt: article.publishedAt,
        relevanceScore: this.calculateRelevanceScore(article, searchTerms),
        matchedFields
      };
    });
  }

  /**
   * Броји резултате претраге
   */
  private async countSearchResults(whereConditions: any, searchTerms: string[]): Promise<number> {
    // Исте WHERE услове као за главну претрагу
    if (searchTerms.length > 0) {
      const searchConditions = searchTerms.map(term => ({
        OR: [
          { title: { contains: term, mode: 'insensitive' as const } },
          { content: { contains: term, mode: 'insensitive' as const } },
          { summary: { contains: term, mode: 'insensitive' as const } }
        ]
      }));

      if (whereConditions.AND) {
        whereConditions.AND.push(...searchConditions);
      } else {
        whereConditions.AND = searchConditions;
      }
    }

    return await prisma.kbArticle.count({
      where: whereConditions
    });
  }

  /**
   * Проналази која поља одговарају претрази
   */
  private findMatchedFields(article: any, searchTerms: string[]): string[] {
    const matchedFields: string[] = [];
    
    searchTerms.forEach(term => {
      if (article.title.toLowerCase().includes(term)) {
        matchedFields.push('title');
      }
      if (article.content.toLowerCase().includes(term)) {
        matchedFields.push('content');
      }
      if (article.summary?.toLowerCase().includes(term)) {
        matchedFields.push('summary');
      }
    });

    return [...new Set(matchedFields)]; // Уклања дупликате
  }

  /**
   * Калкулише скор релевантности
   */
  private calculateRelevanceScore(article: any, searchTerms: string[]): number {
    let score = 0;
    
    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      
      // Бодови за наслов (највећи приоритет)
      if (article.title.toLowerCase().includes(termLower)) {
        score += 10;
        // Бонус ако је на почетку наслова
        if (article.title.toLowerCase().startsWith(termLower)) {
          score += 5;
        }
      }
      
      // Бодови за сажетак
      if (article.summary?.toLowerCase().includes(termLower)) {
        score += 5;
      }
      
      // Бодови за садржај
      if (article.content.toLowerCase().includes(termLower)) {
        score += 3;
      }
    });

    // Бонус за популарност
    score += Math.min(article.viewCount / 10, 5);
    score += Math.min(article.helpfulCount, 3);

    return Number(score.toFixed(2));
  }

  /**
   * Генерише предлоге ако нема резултата
   */
  private async generateSuggestions(query: string): Promise<string[]> {
    try {
      // Проналази најпопуларније чланке за предлоге
      const popularArticles = await prisma.kbArticle.findMany({
        where: { status: 'published' },
        select: { title: true },
        orderBy: [
          { viewCount: 'desc' },
          { helpfulCount: 'desc' }
        ],
        take: 5
      });

      // Проналази речи које су сличне упиту
      const suggestions: string[] = [];
      const queryWords = query.toLowerCase().split(/\s+/);
      
      popularArticles.forEach(article => {
        const titleWords = article.title.toLowerCase().split(/\s+/);
        titleWords.forEach(word => {
          if (word.length >= 3 && !suggestions.includes(word)) {
            // Проверава да ли реч има сличност са упитом
            queryWords.forEach(queryWord => {
              if (this.isStringSimilar(word, queryWord)) {
                suggestions.push(word);
              }
            });
          }
        });
      });

      return suggestions.slice(0, 3); // Максимално 3 предлога
    } catch (error) {
      logger.warn('Не могу да генеришем предлоге претраге:', error);
      return [];
    }
  }

  /**
   * Проверава сличност између две речи (једноставан алгоритам)
   */
  private isStringSimilar(str1: string, str2: string): boolean {
    if (str1.length < 3 || str2.length < 3) return false;
    
    // Проверава да ли је једна реч садржана у другој
    if (str1.includes(str2) || str2.includes(str1)) return true;
    
    // Проверава Левенштајн дистанцу (једноставна верзија)
    const maxDistance = Math.floor(Math.max(str1.length, str2.length) / 3);
    const distance = this.calculateLevenshteinDistance(str1, str2);
    
    return distance <= maxDistance;
  }

  /**
   * Калкулише Левенштајн дистанцу између две речи
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator   // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Претрага популарних термина (за autocomplete)
   */
  async getPopularSearchTerms(limit = 10): Promise<string[]> {
    try {
      // Добија најпопуларније чланке и извлачи кључне речи
      const popularArticles = await prisma.kbArticle.findMany({
        where: { status: 'published' },
        select: { title: true, metaKeywords: true },
        orderBy: { viewCount: 'desc' },
        take: 50
      });

      const termFrequency: Record<string, number> = {};
      
      popularArticles.forEach(article => {
        // Извлачи речи из наслова
        const titleWords = article.title
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length >= 3);
        
        titleWords.forEach(word => {
          termFrequency[word] = (termFrequency[word] || 0) + 2; // Наслов има већи приоритет
        });

        // Извлачи кључне речи
        if (article.metaKeywords) {
          const keywords = article.metaKeywords
            .toLowerCase()
            .split(',')
            .map(kw => kw.trim())
            .filter(kw => kw.length >= 3);
          
          keywords.forEach(keyword => {
            termFrequency[keyword] = (termFrequency[keyword] || 0) + 1;
          });
        }
      });

      // Сортира по фреквенцији и враћа најпопуларније
      return Object.entries(termFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([term]) => term);
    } catch (error) {
      logger.error('Грешка при добијању популарних термина:', error);
      return [];
    }
  }

  /**
   * Автокомплит претрага
   */
  async getSearchSuggestions(query: string, limit = 5): Promise<string[]> {
    if (query.length < 2) return [];

    try {
      const normalizedQuery = this.normalizeSearchQuery(query);
      
      // Претражује чланке чији наслови почињу или садрже упит
      const matchingArticles = await prisma.kbArticle.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { startsWith: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: { title: true },
        orderBy: { viewCount: 'desc' },
        take: limit
      });

      return matchingArticles.map(article => article.title);
    } catch (error) {
      logger.error('Грешка при добијању предлога:', error);
      return [];
    }
  }
} 