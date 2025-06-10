import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Примени аутентификацију на све руте
router.use(authMiddleware);

// Валидација за креирање корисника
const createUserSchema = z.object({
  username: z.string().min(3, 'Корисничко име мора имати најмање 3 карактера'),
  email: z.string().email('Неисправан формат е-мејла'),
  displayName: z.string().min(1, 'Име за приказ је обавезно'),
  department: z.string().optional(),
  roleId: z.string().min(1, 'Улога је обавезна'),
  password: z.string().min(6, 'Лозинка мора имати најмање 6 карактера'),
  isActive: z.boolean().default(true)
});

// Валидација за ажурирање корисника
const updateUserSchema = z.object({
  email: z.string().email('Неисправан формат е-мејла').optional(),
  displayName: z.string().min(1, 'Име за приказ је обавезно').optional(),
  department: z.string().optional(),
  roleId: z.string().optional(),
  password: z.string().min(6, 'Лозинка мора имати најмање 6 карактера').optional(),
  isActive: z.boolean().optional()
});

// Провери да ли корисник има администраторске дозволе
const checkAdminPermissions = (req: AuthenticatedRequest) => {
  const user = req.user;
  return user?.role?.name === 'admin' || user?.role?.permissions?.includes('manage_users');
};

// GET /api/users - Листа корисника са пагинацијом и филтерима
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkAdminPermissions(req)) {
      return res.status(403).json({
        success: false,
        message: 'Немате дозволу за приступ листи корисника',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const roleId = req.query.roleId as string;
    const status = req.query.status as string;

    const skip = (page - 1) * limit;

    // Направи where клаузулу за филтере
    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (roleId) {
      where.roleId = roleId;
    }

    if (status) {
      where.isActive = status === 'active';
    }

    // Добиј укупан број корисника за пагинацију
    const total = await prisma.user.count({ where });

    // Добиј кориснике са улогама
    const users = await prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error: any) {
    console.error('Грешка при добијању корисника:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању корисника',
      error: error.message
    });
  }
});

// GET /api/users/roles - Листа свих улога
router.get('/roles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkAdminPermissions(req)) {
      return res.status(403).json({
        success: false,
        message: 'Немате дозволу за приступ листи улога',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        permissions: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: roles
    });
  } catch (error: any) {
    console.error('Грешка при добијању улога:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању улога',
      error: error.message
    });
  }
});

// GET /api/users/:id - Подаци о специфичном кориснику
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Недостаје ID корисника',
        code: 'MISSING_USER_ID'
      });
    }

    // Провери дозволе - само admin или сам корисник може приступити
    if (!checkAdminPermissions(req) && currentUser?.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Немате дозволу за приступ подацима о овом кориснику',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Корисник није пронађен',
        code: 'USER_NOT_FOUND'
      });
    }

    // Уклони лозинку из одговора
    const { password, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error: any) {
    console.error('Грешка при добијању корисника:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при добијању корисника',
      error: error.message
    });
  }
});

// POST /api/users - Креирај новог корисника
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!checkAdminPermissions(req)) {
      return res.status(403).json({
        success: false,
        message: 'Немате дозволу за креирање корисника',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Валидирај улазне податке
    const validationResult = createUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Неисправни подаци',
        errors: validationResult.error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    const { username, email, displayName, department, roleId, password, isActive } = validationResult.data;

    // Провери да ли корисничко име већ постоји
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.username === username 
          ? 'Корисничко име већ постоји' 
          : 'Е-мејл адреса већ је заузета',
        code: 'USER_ALREADY_EXISTS'
      });
    }

    // Провери да ли улога постоји
    const role = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Изабрана улога не постоји',
        code: 'INVALID_ROLE'
      });
    }

    // Хешуј лозинку
    const hashedPassword = await bcrypt.hash(password, 12);

    // Креирај корисника
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        displayName,
        department,
        roleId,
        password: hashedPassword,
        isActive
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: true
          }
        }
      }
    });

    // Уклони лозинку из одговора
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      success: true,
      message: 'Корисник је успешно креиран',
      data: userWithoutPassword
    });
  } catch (error: any) {
    console.error('Грешка при креирању корисника:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при креирању корисника',
      error: error.message
    });
  }
});

// PUT /api/users/:id - Ажурирај корисника
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Провери дозволе - само admin или сам корисник може ажурирати
    if (!checkAdminPermissions(req) && currentUser?.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Немате дозволу за ажурирање овог корисника',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Валидирај улазне податке
    const validationResult = updateUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Неисправни подаци',
        errors: validationResult.error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    const updateData = validationResult.data;

    // Провери да ли корисник постоји
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Корисник није пронађен',
        code: 'USER_NOT_FOUND'
      });
    }

    // Ако се мења е-мејл, провери да ли је већ заузет
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: updateData.email,
          id: { not: id }
        }
      });

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: 'Е-мејл адреса је већ заузета',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
    }

    // Ако се мења улога, провери да ли постоји (само за админе)
    if (updateData.roleId && checkAdminPermissions(req)) {
      const role = await prisma.role.findUnique({
        where: { id: updateData.roleId }
      });

      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Изабрана улога не постоји',
          code: 'INVALID_ROLE'
        });
      }
    } else if (updateData.roleId && !checkAdminPermissions(req)) {
      // Не дозволи мењање улоге корисницима који нису админи
      delete updateData.roleId;
    }

    // Хешуј нову лозинку ако је дата
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }

    // Ажурирај корисника
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: true
          }
        }
      }
    });

    // Уклони лозинку из одговора
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'Подаци о кориснику су успешно ажурирани',
      data: userWithoutPassword
    });
  } catch (error: any) {
    console.error('Грешка при ажурирању корисника:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при ажурирању корисника',
      error: error.message
    });
  }
});

// DELETE /api/users/:id - Обриши корисника
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!checkAdminPermissions(req)) {
      return res.status(403).json({
        success: false,
        message: 'Немате дозволу за брисање корисника',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Не дозволи брисање самог себе
    if (currentUser?.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Не можете обрисати сопствени налог',
        code: 'CANNOT_DELETE_SELF'
      });
    }

    // Провери да ли корисник постоји
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Корисник није пронађен',
        code: 'USER_NOT_FOUND'
      });
    }

    // Обриши корисника
    await prisma.user.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Корисник је успешно обрисан'
    });
  } catch (error: any) {
    console.error('Грешка при брисању корисника:', error);
    res.status(500).json({
      success: false,
      message: 'Грешка при брисању корисника',
      error: error.message
    });
  }
});

export default router; 