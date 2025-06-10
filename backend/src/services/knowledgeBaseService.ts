import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';

export interface CreateKbCategoryData {
  name: string;
  description?: string;
  parentId?: string;
  icon?: string;
  displayOrder?: number;
}

export interface UpdateKbCategoryData {
  name?: string;
  description?: string;
  parentId?: string;
  icon?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateKbArticleData {
  title: string;
  content: string;
  summary?: string;
  categoryId?: string;
  authorId: string;
  tags?: string[];
  metaKeywords?: string;
}

export interface UpdateKbArticleData {
  title?: string;
  content?: string;
  summary?: string;
  categoryId?: string;
  tags?: string[];
  metaKeywords?: string;
  status?: 'draft' | 'review' | 'published' | 'archived' | 'rejected';
}

export interface KbArticleFilters {
  categoryId?: string;
  status?: string;
  authorId?: string;
  search?: string;
  tags?: string[];
}

export class KnowledgeBaseService {
  // ================================
  // KB CATEGORY OPERATIONS
  // ================================

  /**
   * Добија све KB категорије са хијерархијом
   */
  async getCategories() {
    try {
      const categories = await prisma.kbCategory.findMany({
        where: { isActive: true },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' }
          },
          _count: {
            select: { articles: true }
          }
        },
        orderBy: [
          { parentId: 'asc' },
          { displayOrder: 'asc' },
          { name: 'asc' }
        ]
      });

      return categories;
    } catch (error) {
      logger.error('Грешка при добијању KB категорија:', error);
      throw new Error('Грешка при добијању категорија');
    }
  }

  /**
   * Добија категорију по ID-у
   */
  async getCategoryById(id: string) {
    try {
      const category = await prisma.kbCategory.findUnique({
        where: { id },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' }
          },
          articles: {
            where: { status: 'published' },
            select: {
              id: true,
              title: true,
              summary: true,
              viewCount: true,
              helpfulCount: true,
              publishedAt: true
            },
            orderBy: { publishedAt: 'desc' }
          },
          _count: {
            select: { articles: true }
          }
        }
      });

      if (!category) {
        throw new Error('Категорија није пронађена');
      }

      return category;
    } catch (error) {
      logger.error('Грешка при добијању KB категорије:', error);
      throw error;
    }
  }

  /**
   * Креира нову KB категорију
   */
  async createCategory(data: CreateKbCategoryData) {
    try {
      const category = await prisma.kbCategory.create({
        data,
        include: {
          parent: true,
          _count: {
            select: { articles: true }
          }
        }
      });

      logger.info(`Креирана нова KB категорија: ${category.name}`);
      return category;
    } catch (error) {
      logger.error('Грешка при креирању KB категорије:', error);
      throw new Error('Грешка при креирању категорије');
    }
  }

  /**
   * Ажурира KB категорију
   */
  async updateCategory(id: string, data: UpdateKbCategoryData) {
    try {
      const category = await prisma.kbCategory.update({
        where: { id },
        data,
        include: {
          parent: true,
          _count: {
            select: { articles: true }
          }
        }
      });

      logger.info(`Ажурирана KB категорија: ${category.name}`);
      return category;
    } catch (error) {
      logger.error('Грешка при ажурирању KB категорије:', error);
      throw new Error('Грешка при ажурирању категорије');
    }
  }

  /**
   * Брише KB категорију
   */
  async deleteCategory(id: string) {
    try {
      // Проверава да ли категорија има чланке
      const articleCount = await prisma.kbArticle.count({
        where: { categoryId: id }
      });

      if (articleCount > 0) {
        throw new Error('Не можете обрисати категорију која садржи чланке');
      }

      // Проверава да ли има подкатегорије
      const childrenCount = await prisma.kbCategory.count({
        where: { parentId: id }
      });

      if (childrenCount > 0) {
        throw new Error('Не можете обрисати категорију која има подкатегорије');
      }

      await prisma.kbCategory.delete({
        where: { id }
      });

      logger.info(`Обрисана KB категорија: ${id}`);
    } catch (error) {
      logger.error('Грешка при брисању KB категорије:', error);
      throw error;
    }
  }

  // ================================
  // KB ARTICLE OPERATIONS  
  // ================================

  /**
   * Добија чланке са филтерима и пагинацијом
   */
  async getArticles(filters: KbArticleFilters = {}, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const where: any = {};
      
      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }
      
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.authorId) {
        where.authorId = filters.authorId;
      }
      
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
          { summary: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      if (filters.tags && filters.tags.length > 0) {
        // За SQLite, тагови су JSON стринг, па требамо LIKE претрагу
        where.AND = filters.tags.map(tag => ({
          tags: { contains: tag }
        }));
      }

      const [articles, total] = await Promise.all([
        prisma.kbArticle.findMany({
          where,
          skip,
          take: limit,
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
            },
            approver: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true
              }
            },
            _count: {
              select: { feedback: true }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }),
        prisma.kbArticle.count({ where })
      ]);

      return {
        articles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Грешка при добијању KB чланака:', error);
      throw new Error('Грешка при добијању чланака');
    }
  }

  /**
   * Добија чланак по ID-у
   */
  async getArticleById(id: string, incrementView = false) {
    try {
      const article = await prisma.kbArticle.findUnique({
        where: { id },
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
          },
          approver: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true
            }
          },
          feedback: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  firstName: true,
                  lastName: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!article) {
        throw new Error('Чланак није пронађен');
      }

      // Увећај број прегледа ако је потребно
      if (incrementView && article.status === 'published') {
        await prisma.kbArticle.update({
          where: { id },
          data: {
            viewCount: {
              increment: 1
            }
          }
        });
        article.viewCount += 1;
      }

      return article;
    } catch (error) {
      logger.error('Грешка при добијању KB чланка:', error);
      throw error;
    }
  }

  /**
   * Креира нови KB чланак
   */
  async createArticle(data: CreateKbArticleData) {
    try {
      const articleData = {
        ...data,
        tags: data.tags ? JSON.stringify(data.tags) : null
      };

      const article = await prisma.kbArticle.create({
        data: articleData,
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
        }
      });

      logger.info(`Креиран нови KB чланак: ${article.title}`);
      return article;
    } catch (error) {
      logger.error('Грешка при креирању KB чланка:', error);
      throw new Error('Грешка при креирању чланка');
    }
  }

  /**
   * Ажурира KB чланак
   */
  async updateArticle(id: string, data: UpdateKbArticleData, userId: string) {
    try {
      const updateData: any = { ...data };
      
      if (data.tags) {
        updateData.tags = JSON.stringify(data.tags);
      }

      // Ако мењамо статус на published, постави publishedAt
      if (data.status === 'published' && updateData.status !== 'published') {
        updateData.publishedAt = new Date();
      }

      const article = await prisma.kbArticle.update({
        where: { id },
        data: updateData,
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
          },
          approver: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      logger.info(`Ажуриран KB чланак: ${article.title} (${userId})`);
      return article;
    } catch (error) {
      logger.error('Грешка при ажурирању KB чланка:', error);
      throw new Error('Грешка при ажурирању чланка');
    }
  }

  /**
   * Одобрава чланак за објављивање
   */
  async approveArticle(id: string, approverId: string) {
    try {
      const article = await prisma.kbArticle.update({
        where: { id },
        data: {
          status: 'published',
          approvedBy: approverId,
          approvedAt: new Date(),
          publishedAt: new Date()
        },
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
          },
          approver: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      logger.info(`Одобрен KB чланак: ${article.title} (одобрио: ${approverId})`);
      return article;
    } catch (error) {
      logger.error('Грешка при одобравању KB чланка:', error);
      throw new Error('Грешка при одобравању чланка');
    }
  }

  /**
   * Одбацује чланак
   */
  async rejectArticle(id: string, approverId: string, reason?: string) {
    try {
      const article = await prisma.kbArticle.update({
        where: { id },
        data: {
          status: 'rejected',
          approvedBy: approverId,
          approvedAt: new Date()
        },
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
          },
          approver: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      logger.info(`Одбачен KB чланак: ${article.title} (одбацио: ${approverId})`);
      return article;
    } catch (error) {
      logger.error('Грешка при одбацивању KB чланка:', error);
      throw new Error('Грешка при одбацивању чланка');
    }
  }

  /**
   * Брише KB чланак
   */
  async deleteArticle(id: string, userId: string) {
    try {
      await prisma.kbArticle.delete({
        where: { id }
      });

      logger.info(`Обрисан KB чланак: ${id} (обрисао: ${userId})`);
    } catch (error) {
      logger.error('Грешка при брисању KB чланка:', error);
      throw new Error('Грешка при брисању чланка');
    }
  }

  // ================================
  // KB FEEDBACK OPERATIONS
  // ================================

  /**
   * Додаје feedback за чланак
   */
  async addFeedback(articleId: string, userId: string, isHelpful: boolean, comment?: string) {
    try {
      // Проверава да ли корисник већ има feedback за овај чланак
      const existingFeedback = await prisma.kbFeedback.findUnique({
        where: {
          articleId_userId: {
            articleId,
            userId
          }
        }
      });

      let feedback;
      
      if (existingFeedback) {
        // Ажурира постојећи feedback
        feedback = await prisma.kbFeedback.update({
          where: {
            articleId_userId: {
              articleId,
              userId
            }
          },
          data: {
            isHelpful,
            comment
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true
              }
            }
          }
        });
      } else {
        // Креира нови feedback
        feedback = await prisma.kbFeedback.create({
          data: {
            articleId,
            userId,
            isHelpful,
            comment
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true
              }
            }
          }
        });
      }

      // Ажурира бројаче у чланку
      await this.updateArticleFeedbackCounts(articleId);

      logger.info(`Додат feedback за KB чланак: ${articleId} (корисник: ${userId})`);
      return feedback;
    } catch (error) {
      logger.error('Грешка при додавању feedback-а:', error);
      throw new Error('Грешка при додавању оцене');
    }
  }

  /**
   * Ажурира бројаче feedback-а за чланак
   */
  private async updateArticleFeedbackCounts(articleId: string) {
    try {
      const [helpfulCount, notHelpfulCount] = await Promise.all([
        prisma.kbFeedback.count({
          where: { articleId, isHelpful: true }
        }),
        prisma.kbFeedback.count({
          where: { articleId, isHelpful: false }
        })
      ]);

      await prisma.kbArticle.update({
        where: { id: articleId },
        data: {
          helpfulCount,
          notHelpfulCount
        }
      });
    } catch (error) {
      logger.error('Грешка при ажурирању бројача feedback-а:', error);
    }
  }

  // ================================
  // SEARCH OPERATIONS
  // ================================

  /**
   * Претражује KB чланке
   */
  async searchArticles(query: string, filters: KbArticleFilters = {}, page = 1, limit = 20) {
    try {
      const searchFilters = {
        ...filters,
        search: query,
        status: filters.status || 'published' // Подразумевано претражује само објављене чланке
      };

      return await this.getArticles(searchFilters, page, limit);
    } catch (error) {
      logger.error('Грешка при претрази KB чланака:', error);
      throw new Error('Грешка при претрази');
    }
  }

  /**
   * Добија популарне чланке
   */
  async getPopularArticles(limit = 10) {
    try {
      const articles = await prisma.kbArticle.findMany({
        where: { status: 'published' },
        take: limit,
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
        orderBy: [
          { viewCount: 'desc' },
          { helpfulCount: 'desc' }
        ]
      });

      return articles;
    } catch (error) {
      logger.error('Грешка при добијању популарних чланака:', error);
      throw new Error('Грешка при добијању популарних чланака');
    }
  }

  /**
   * Добија недавне чланке
   */
  async getRecentArticles(limit = 10) {
    try {
      const articles = await prisma.kbArticle.findMany({
        where: { status: 'published' },
        take: limit,
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
        orderBy: { publishedAt: 'desc' }
      });

      return articles;
    } catch (error) {
      logger.error('Грешка при добијању недавних чланака:', error);
      throw new Error('Грешка при добијању недавних чланака');
    }
  }
} 