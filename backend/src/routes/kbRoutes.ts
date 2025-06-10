import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import { KnowledgeBaseService } from '../services/knowledgeBaseService.js';
import { ArticleWorkflowService, ArticleStatus } from '../services/articleWorkflowService.js';
import { SearchService } from '../services/searchService.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();
const kbService = new KnowledgeBaseService();
const articleWorkflowService = new ArticleWorkflowService();
const searchService = new SearchService();

// ================================
// IMAGE UPLOAD CONFIGURATION
// ================================

// Креирај uploads директорум ако не постоји
const uploadsDir = path.join(process.cwd(), 'uploads', 'kb-images');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Multer конфигурација за upload слика
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Валидација фајлова за upload
const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB лимит
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Дозвољени типови слика
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Неподржан тип фајла. Дозвољени су: JPEG, PNG, GIF, WebP, SVG'));
    }
  }
});

// Validation rules for KB categories
const createCategoryValidation = [
  body('name')
    .notEmpty()
    .withMessage('Назив категорије је обавезан')
    .isLength({ min: 2, max: 100 })
    .withMessage('Назив мора бити између 2 и 100 карактера'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Опис може имати највише 500 карактера'),
  body('parentId')
    .optional()
    .isString()
    .withMessage('Родитељска категорија мора бити валидна'),
  body('icon')
    .optional()
    .isString()
    .withMessage('Икона мора бити валидна'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Редослед приказа мора бити позитиван број')
];

// Validation rules for KB articles
const createArticleValidation = [
  body('title')
    .notEmpty()
    .withMessage('Наслов чланка је обавезан')
    .isLength({ min: 5, max: 255 })
    .withMessage('Наслов мора бити између 5 и 255 карактера'),
  body('content')
    .notEmpty()
    .withMessage('Садржај чланка је обавезан')
    .isLength({ min: 20 })
    .withMessage('Садржај мора имати најмање 20 карактера'),
  body('summary')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Сажетак може имати највише 500 карактера'),
  body('categoryId')
    .optional()
    .isString()
    .withMessage('Категорија мора бити валидна'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Тагови морају бити низ'),
  body('metaKeywords')
    .optional()
    .isString()
    .withMessage('Кључне речи морају бити валидне')
];

const updateArticleValidation = [
  param('id')
    .isString()
    .notEmpty()
    .withMessage('ID чланка је обавезан'),
  body('title')
    .optional()
    .isLength({ min: 5, max: 255 })
    .withMessage('Наслов мора бити између 5 и 255 карактера'),
  body('content')
    .optional()
    .isLength({ min: 20 })
    .withMessage('Садржај мора имати најмање 20 карактера'),
  body('status')
    .optional()
    .isIn(['draft', 'review', 'published', 'archived', 'rejected'])
    .withMessage('Статус није валидан')
];

// Helper function to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Грешка валидације',
      errors: errors.array().map(err => ({
        field: err.path || err.param || 'unknown',
        message: err.msg,
        value: 'value' in err ? err.value : undefined
      }))
    });
  }
  next();
};

// ================================
// KB CATEGORY ROUTES
// ================================

// GET /api/kb/categories - Get all categories
router.get('/categories',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const categories = await kbService.getCategories();

      res.json({
        success: true,
        message: 'Категорије успешно учитане',
        data: categories
      });
    } catch (error) {
      logger.error('Грешка при учитавању KB категорија:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању категорија'
      });
    }
  }
);

// GET /api/kb/categories/:id - Get category by ID
router.get('/categories/:id',
  authMiddleware,
  [
    param('id').isString().notEmpty().withMessage('ID категорије је обавезан')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const category = await kbService.getCategoryById(req.params.id);

      res.json({
        success: true,
        message: 'Категорија успешно учитана',
        data: category
      });
    } catch (error) {
      logger.error('Грешка при учитавању KB категорије:', error);
      const statusCode = error instanceof Error && error.message === 'Категорија није пронађена' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању категорије'
      });
    }
  }
);

// POST /api/kb/categories - Create new category
router.post('/categories',
  authMiddleware,
  requirePermission(['kb.categories.create', '*']),
  createCategoryValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const category = await kbService.createCategory(req.body);

      res.status(201).json({
        success: true,
        message: 'Категорија успешно креирана',
        data: category
      });
    } catch (error) {
      logger.error('Грешка при креирању KB категорије:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при креирању категорије'
      });
    }
  }
);

// PUT /api/kb/categories/:id - Update category
router.put('/categories/:id',
  authMiddleware,
  requirePermission(['kb.categories.update', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID категорије је обавезан'),
    ...createCategoryValidation.map(rule => rule.optional())
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const category = await kbService.updateCategory(req.params.id, req.body);

      res.json({
        success: true,
        message: 'Категорија успешно ажурирана',
        data: category
      });
    } catch (error) {
      logger.error('Грешка при ажурирању KB категорије:', error);
      const statusCode = error instanceof Error && error.message === 'Категорија није пронађена' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при ажурирању категорије'
      });
    }
  }
);

// DELETE /api/kb/categories/:id - Delete category
router.delete('/categories/:id',
  authMiddleware,
  requirePermission(['kb.categories.delete', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID категорије је обавезан')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      await kbService.deleteCategory(req.params.id);

      res.json({
        success: true,
        message: 'Категорија успешно обрисана'
      });
    } catch (error) {
      logger.error('Грешка при брисању KB категорије:', error);
      const statusCode = error instanceof Error && error.message === 'Категорија није пронађена' ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при брисању категорије'
      });
    }
  }
);

// ================================
// KB ARTICLE ROUTES
// ================================

// GET /api/kb/articles - Get all articles with filtering and pagination
router.get('/articles',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Страница мора бити позитиван број'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Лимит мора бити између 1 и 100'),
    query('status').optional().isString().withMessage('Статус мора бити стринг'),
    query('categoryId').optional().isString().withMessage('Категорија мора бити стринг'),
    query('authorId').optional().isString().withMessage('Аутор мора бити стринг'),
    query('search').optional().isString().withMessage('Претрага мора бити стринг'),
    query('tags').optional().isString().withMessage('Тагови морају бити стринг (разделјени запетом)')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        categoryId: req.query.categoryId as string,
        status: req.query.status as string,
        authorId: req.query.authorId as string,
        search: req.query.search as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });

      const result = await kbService.getArticles(filters, page, limit);

      res.json({
        success: true,
        message: 'Чланци успешно учитани',
        data: result
      });
    } catch (error) {
      logger.error('Грешка при учитавању KB чланака:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању чланака',
        error: error instanceof Error ? error.message : 'Непозната грешка'
      });
    }
  }
);

// GET /api/kb/articles/:id - Get article by ID
router.get('/articles/:id',
  authMiddleware,
  [
    param('id').isString().notEmpty().withMessage('ID чланка је обавезан'),
    query('incrementView').optional().isBoolean().withMessage('IncrementView мора бити boolean')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const incrementView = req.query.incrementView === 'true';
      const article = await kbService.getArticleById(req.params.id, incrementView);

      res.json({
        success: true,
        message: 'Чланак успешно учитан',
        data: article
      });
    } catch (error) {
      logger.error('Грешка при учитавању KB чланка:', error);
      const statusCode = error instanceof Error && error.message === 'Чланак није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању чланка'
      });
    }
  }
);

// POST /api/kb/articles - Create new article
router.post('/articles',
  authMiddleware,
  requirePermission(['kb.articles.create', '*']),
  createArticleValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const articleData = {
        ...req.body,
        authorId: req.user?.userId || req.body.authorId
      };

      const article = await kbService.createArticle(articleData);

      res.status(201).json({
        success: true,
        message: 'Чланак успешно креиран',
        data: article
      });
    } catch (error) {
      logger.error('Грешка при креирању KB чланка:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при креирању чланка'
      });
    }
  }
);

// PUT /api/kb/articles/:id - Update article
router.put('/articles/:id',
  authMiddleware,
  requirePermission(['kb.articles.update', '*']),
  updateArticleValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const article = await kbService.updateArticle(
        req.params.id,
        req.body,
        req.user?.userId || 'unknown'
      );

      res.json({
        success: true,
        message: 'Чланак успешно ажуриран',
        data: article
      });
    } catch (error) {
      logger.error('Грешка при ажурирању KB чланка:', error);
      const statusCode = error instanceof Error && error.message === 'Чланак није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при ажурирању чланка'
      });
    }
  }
);

// PUT /api/kb/articles/:id/approve - Approve article
router.put('/articles/:id/approve',
  authMiddleware,
  requirePermission(['kb.articles.approve', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID чланка је обавезан')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const article = await kbService.approveArticle(
        req.params.id,
        req.user?.userId || 'unknown'
      );

      res.json({
        success: true,
        message: 'Чланак успешно одобрен',
        data: article
      });
    } catch (error) {
      logger.error('Грешка при одобравању KB чланка:', error);
      const statusCode = error instanceof Error && error.message === 'Чланак није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при одобравању чланка'
      });
    }
  }
);

// PUT /api/kb/articles/:id/reject - Reject article
router.put('/articles/:id/reject',
  authMiddleware,
  requirePermission(['kb.articles.approve', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID чланка је обавезан'),
    body('reason').optional().isString().withMessage('Разлог одбацивања мора бити стринг')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const article = await kbService.rejectArticle(
        req.params.id,
        req.user?.userId || 'unknown',
        req.body.reason
      );

      res.json({
        success: true,
        message: 'Чланак успешно одбачен',
        data: article
      });
    } catch (error) {
      logger.error('Грешка при одбацивању KB чланка:', error);
      const statusCode = error instanceof Error && error.message === 'Чланак није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при одбацивању чланка'
      });
    }
  }
);

// DELETE /api/kb/articles/:id - Delete article
router.delete('/articles/:id',
  authMiddleware,
  requirePermission(['kb.articles.delete', '*']),
  [
    param('id').isString().notEmpty().withMessage('ID чланка је обавезан')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      await kbService.deleteArticle(req.params.id, req.user?.userId || 'unknown');

      res.json({
        success: true,
        message: 'Чланак успешно обрисан'
      });
    } catch (error) {
      logger.error('Грешка при брисању KB чланка:', error);
      const statusCode = error instanceof Error && error.message === 'Чланак није пронађен' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при брисању чланка'
      });
    }
  }
);

// ================================
// KB SEARCH ROUTES
// ================================

// GET /api/kb/search - Search articles
router.get('/search',
  authMiddleware,
  [
    query('q').notEmpty().withMessage('Упит за претрагу је обавезан'),
    query('page').optional().isInt({ min: 1 }).withMessage('Страница мора бити позитиван број'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Лимит мора бити између 1 и 100'),
    query('categoryId').optional().isString().withMessage('Категорија мора бити стринг'),
    query('tags').optional().isString().withMessage('Тагови морају бити стринг')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        categoryId: req.query.categoryId as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });

      const result = await kbService.searchArticles(query, filters, page, limit);

      res.json({
        success: true,
        message: 'Претрага успешно извршена',
        data: result
      });
    } catch (error) {
      logger.error('Грешка при претрази KB чланака:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при претрази',
        error: error instanceof Error ? error.message : 'Непозната грешка'
      });
    }
  }
);

// GET /api/kb/popular - Get popular articles
router.get('/popular',
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Лимит мора бити између 1 и 50')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const articles = await kbService.getPopularArticles(limit);

      res.json({
        success: true,
        message: 'Популарни чланци успешно учитани',
        data: articles
      });
    } catch (error) {
      logger.error('Грешка при учитавању популарних чланака:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању популарних чланака'
      });
    }
  }
);

// GET /api/kb/recent - Get recent articles
router.get('/recent',
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Лимит мора бити између 1 и 50')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const articles = await kbService.getRecentArticles(limit);

      res.json({
        success: true,
        message: 'Недавни чланци успешно учитани',
        data: articles
      });
    } catch (error) {
      logger.error('Грешка при учитавању недавних чланака:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при учитавању недавних чланака'
      });
    }
  }
);

// ================================
// KB FEEDBACK ROUTES
// ================================

// POST /api/kb/articles/:id/feedback - Add feedback to article
router.post('/articles/:id/feedback',
  authMiddleware,
  [
    param('id').isString().notEmpty().withMessage('ID чланка је обавезан'),
    body('isHelpful').isBoolean().withMessage('IsHelpful мора бити boolean'),
    body('comment').optional().isString().withMessage('Коментар мора бити стринг')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const feedback = await kbService.addFeedback(
        req.params.id,
        req.user?.userId || 'unknown',
        req.body.isHelpful,
        req.body.comment
      );

      res.status(201).json({
        success: true,
        message: 'Оцена успешно додата',
        data: feedback
      });
    } catch (error) {
      logger.error('Грешка при додавању feedback-а:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Грешка при додавању оцене'
      });
    }
  }
);

// ================================
// KB WORKFLOW ROUTES
// ================================

// GET /api/kb/workflow/statuses - Get all available article statuses
router.get('/workflow/statuses', authMiddleware, async (req: Request, res: Response) => {
  try {
    const statuses = ArticleWorkflowService.getAllStatuses();
    res.json({
      success: true,
      message: 'Статуси чланака успешно учитани',
      data: statuses
    });
  } catch (error) {
    logger.error('Грешка при учитавању статуса:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при учитавању статуса чланака'
    });
  }
});

// PUT /api/kb/articles/:id/workflow/status - Change article status using workflow  
router.put('/articles/:id/workflow/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const articleId = req.params.id;
    const newStatus = req.body.status as ArticleStatus;
    const userId = req.user?.userId || 'unknown';
    const userPermissions = req.user?.permissions || ['*'];

    // Get current article
    const article = await kbService.getArticleById(articleId);
    const currentStatus = article.status as ArticleStatus;

    // Validate transition
    const workflowResult = ArticleWorkflowService.executeTransition(
      articleId, currentStatus, newStatus, userPermissions, userId
    );

    if (!workflowResult.success) {
      return res.status(403).json({
        success: false,
        message: workflowResult.message
      });
    }

    // Update article status
    const updatedArticle = await kbService.updateArticle(articleId, { status: newStatus }, userId);

    res.json({
      success: true,
      message: workflowResult.message,
      data: updatedArticle
    });
  } catch (error) {
    logger.error('Грешка при промени статуса:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при промени статуса чланка'
    });
  }
});

// ================================
// ENHANCED SEARCH ROUTES (using SearchService)
// ================================

// GET /api/kb/search/advanced - Advanced search with Serbian support
router.get('/search/advanced', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      q: query,
      categoryId,
      tags,
      limit = '20',
      offset = '0',
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Упит за претрагу је обавезан'
      });
    }

    const searchQuery = {
      query: query as string,
      categoryId: categoryId as string | undefined,
      tags: tags ? (tags as string).split(',') : undefined,
      limit: parseInt(limit as string) || 20,
      offset: parseInt(offset as string) || 0,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    };

    const searchResult = await searchService.searchArticles(searchQuery);

    res.json({
      success: true,
      message: 'Претрага успешно извршена',
      data: searchResult
    });
  } catch (error) {
    logger.error('Грешка при напредној претрази:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при претрази чланака'
    });
  }
});

// GET /api/kb/search/suggestions - Get search suggestions for autocomplete
router.get('/search/suggestions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { q: query, limit = '5' } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Упит је обавезан'
      });
    }

    const suggestions = await searchService.getSearchSuggestions(
      query as string,
      parseInt(limit as string) || 5
    );

    res.json({
      success: true,
      message: 'Предлози успешно учитани',
      data: suggestions
    });
  } catch (error) {
    logger.error('Грешка при добијању предлога:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању предлога'
    });
  }
});

// GET /api/kb/search/popular-terms - Get popular search terms
router.get('/search/popular-terms', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    
    const popularTerms = await searchService.getPopularSearchTerms(
      parseInt(limit as string) || 10
    );

    res.json({
      success: true,
      message: 'Популарни термини успешно учитани',
      data: popularTerms
    });
  } catch (error) {
    logger.error('Грешка при добијању популарних термина:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању популарних термина'
    });
  }
});

// ================================
// IMAGE UPLOAD ROUTES
// ================================

// POST /api/kb/images/upload - Upload image for KB articles
router.post('/images/upload',
  authMiddleware,
  requirePermission(['kb.articles.create', 'kb.articles.update', '*']),
  (req: Request, res: Response, next: any) => {
    imageUpload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              return res.status(400).json({
                success: false,
                message: 'Слика је превелика. Максимална величина је 5MB.'
              });
            case 'LIMIT_FILE_COUNT':
              return res.status(400).json({
                success: false,
                message: 'Можете послати само једну слику по захтеву.'
              });
            default:
              return res.status(400).json({
                success: false,
                message: 'Грешка при upload-у слике: ' + err.message
              });
          }
        }
        
        return res.status(400).json({
          success: false,
          message: err.message || 'Грешка при upload-у слике'
        });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Нисте приложили слику'
        });
      }

      const fileUrl = `/uploads/kb-images/${req.file.filename}`;
      
      logger.info(`Успешно upload-ована слика за KB: ${req.file.filename}`, {
        originalName: req.file.originalname,
        size: req.file.size,
        uploadedBy: req.user?.userId
      });

      res.status(201).json({
        success: true,
        message: 'Слика је успешно upload-ована',
        data: {
          url: fileUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype
        }
      });
    } catch (error) {
      logger.error('Грешка при upload-у KB слике:', error);
      
      // Обриши фајл ако се догодила грешка
      if (req.file) {
        fs.unlink(req.file.path).catch(err => 
          logger.warn('Не могу да обришем неуспешно upload-овану слику:', err)
        );
      }
      
      res.status(500).json({
        success: false,
        message: 'Грешка при upload-у слике'
      });
    }
  }
);

// GET /api/kb/images/:filename - Serve uploaded images
router.get('/images/:filename',
  async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(uploadsDir, filename);
      
      // Провери да ли фајл постоји
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: 'Слика није пронађена'
        });
      }

      // Постави правилне header-е за слику
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };

      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 година cache
      
      res.sendFile(filePath);
    } catch (error) {
      logger.error('Грешка при сервирању KB слике:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при учитавању слике'
      });
    }
  }
);

// DELETE /api/kb/images/:filename - Delete uploaded image
router.delete('/images/:filename',
  authMiddleware,
  requirePermission(['kb.articles.update', 'kb.articles.delete', '*']),
  async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(uploadsDir, filename);
      
      // Провери да ли фајл постоји
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: 'Слика није пронађена'
        });
      }

      // Обриши фајл
      await fs.unlink(filePath);
      
      logger.info(`Обрисана KB слика: ${filename}`, {
        deletedBy: req.user?.userId
      });

      res.json({
        success: true,
        message: 'Слика је успешно обрисана'
      });
    } catch (error) {
      logger.error('Грешка при брисању KB слике:', error);
      res.status(500).json({
        success: false,
        message: 'Грешка при брисању слике'
      });
    }
  }
);

export default router; 