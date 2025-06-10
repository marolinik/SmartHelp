import { Prisma } from '@prisma/client';
import encryptionService from '../services/encryptionService';

/**
 * Конфигурација поља која треба енкриптовати за сваки модел
 * Овде дефинишемо која поља у којим моделима треба да буду енкриптована
 */
const ENCRYPTION_CONFIG: Record<string, string[]> = {
  // User модел - осетљиви лични подаци
  User: ['email', 'firstName', 'lastName', 'phoneNumber'],
  
  // Ticket модел - потенцијално осетљив садржај
  Ticket: ['description', 'resolution'],
  
  // TicketComment модел - садржај коментара
  TicketComment: ['content'],
  
  // KbArticle модел - садржај чланака може бити поверљив
  KbArticle: ['content', 'summary'],
  
  // KbFeedback модел - коментари корисника
  KbFeedback: ['comment'],
  
  // Додај други модели према потреби...
};

/**
 * Middleware за енкрипцију поља при упису у базу
 * Аутоматски енкриптује дефинисана поља пре чувања
 */
export const encryptionMiddleware: Prisma.Middleware = async (params, next) => {
  const { model, action, args } = params;

  // Провери да ли модел има поља за енкрипцију
  if (!model || !ENCRYPTION_CONFIG[model]) {
    return next(params);
  }

  const fieldsToEncrypt = ENCRYPTION_CONFIG[model];

  try {
    // Енкриптуј поља при create операцији
    if (action === 'create' && args.data) {
      args.data = encryptDataFields(args.data, fieldsToEncrypt);
    }

    // Енкриптуј поља при update операцији
    if (action === 'update' && args.data) {
      args.data = encryptDataFields(args.data, fieldsToEncrypt);
    }

    // Енкриптуј поља при upsert операцији
    if (action === 'upsert') {
      if (args.create) {
        args.create = encryptDataFields(args.create, fieldsToEncrypt);
      }
      if (args.update) {
        args.update = encryptDataFields(args.update, fieldsToEncrypt);
      }
    }

    // Енкриптуј поља при updateMany операцији
    if (action === 'updateMany' && args.data) {
      args.data = encryptDataFields(args.data, fieldsToEncrypt);
    }

    // Енкриптуј поља при createMany операцији
    if (action === 'createMany' && args.data) {
      if (Array.isArray(args.data)) {
        args.data = args.data.map((item: any) => encryptDataFields(item, fieldsToEncrypt));
      } else {
        args.data = encryptDataFields(args.data, fieldsToEncrypt);
      }
    }

    // Изврши операцију
    const result = await next(params);

    // Декриптуј поља при читању података
    if (isReadOperation(action)) {
      return decryptResult(result, fieldsToEncrypt);
    }

    return result;

  } catch (error) {
    console.error(`Грешка у encryption middleware за модел ${model}:`, error);
    throw error;
  }
};

/**
 * Енкриптује специфична поља у објекту
 */
function encryptDataFields(data: any, fieldsToEncrypt: string[]): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const encryptedData = { ...data };

  fieldsToEncrypt.forEach(field => {
    if (encryptedData[field] && typeof encryptedData[field] === 'string') {
      // Провери да ли је већ енкриптовано (да избегнемо двоструку енкрипцију)
      if (!encryptionService.isEncrypted(encryptedData[field])) {
        try {
          encryptedData[field] = encryptionService.encrypt(encryptedData[field]);
        } catch (error) {
          console.error(`Грешка при енкрипцији поља ${field}:`, error);
          // Остави оригиналну вредност ако енкрипција није успешна
        }
      }
    }
  });

  return encryptedData;
}

/**
 * Декриптује специфична поља у резултату
 */
function decryptResult(result: any, fieldsToDecrypt: string[]): any {
  if (!result) {
    return result;
  }

  // Ако је резултат низ (нпр. findMany)
  if (Array.isArray(result)) {
    return result.map(item => decryptResultItem(item, fieldsToDecrypt));
  }

  // Ако је резултат појединачни објекат
  return decryptResultItem(result, fieldsToDecrypt);
}

/**
 * Декриптује поља у појединачном објекту
 */
function decryptResultItem(item: any, fieldsToDecrypt: string[]): any {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const decryptedItem = { ...item };

  fieldsToDecrypt.forEach(field => {
    if (decryptedItem[field] && typeof decryptedItem[field] === 'string') {
      // Провери да ли је енкриптовано
      if (encryptionService.isEncrypted(decryptedItem[field])) {
        try {
          decryptedItem[field] = encryptionService.decrypt(decryptedItem[field]);
        } catch (error) {
          console.warn(`Не могу да декриптујем поље ${field} у ${JSON.stringify(item)}:`, error);
          // Остави енкриптовану вредност ако декрипција није успешна
        }
      }
    }
  });

  return decryptedItem;
}

/**
 * Проверава да ли је операција читање података
 */
function isReadOperation(action: string): boolean {
  const readOperations = [
    'findUnique',
    'findUniqueOrThrow', 
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy'
  ];
  
  return readOperations.includes(action);
}

/**
 * Додаје поље за енкрипцију у конфигурацију
 * @param model - Име модела
 * @param fields - Поља за енкрипцију
 */
export function addEncryptionFields(model: string, fields: string[]): void {
  if (!ENCRYPTION_CONFIG[model]) {
    ENCRYPTION_CONFIG[model] = [];
  }
  
  fields.forEach(field => {
    if (!ENCRYPTION_CONFIG[model].includes(field)) {
      ENCRYPTION_CONFIG[model].push(field);
    }
  });
}

/**
 * Уклања поље из енкрипције
 * @param model - Име модела
 * @param field - Поље за уклањање
 */
export function removeEncryptionField(model: string, field: string): void {
  if (ENCRYPTION_CONFIG[model]) {
    const index = ENCRYPTION_CONFIG[model].indexOf(field);
    if (index > -1) {
      ENCRYPTION_CONFIG[model].splice(index, 1);
    }
  }
}

/**
 * Враћа листу енкриптованих поља за модел
 * @param model - Име модела
 * @returns Низ имена поља
 */
export function getEncryptedFields(model: string): string[] {
  return ENCRYPTION_CONFIG[model] || [];
}

/**
 * Проверава да ли је поље енкриптовано за модел
 * @param model - Име модела
 * @param field - Име поља
 * @returns true ако је поље енкриптовано
 */
export function isFieldEncrypted(model: string, field: string): boolean {
  const fields = ENCRYPTION_CONFIG[model];
  return fields ? fields.includes(field) : false;
} 