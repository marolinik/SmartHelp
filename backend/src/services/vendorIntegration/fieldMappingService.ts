import prisma from '../../config/database';
import logger from '../../utils/logger';
import { format, parse } from 'date-fns';
import { sr } from 'date-fns/locale';

// Типови за мапирање поља
export interface FieldMapping {
  id: string;
  vendorSystemId: string;
  entityType: string;
  internalField: string;
  vendorField: string;
  fieldType: string;
  transformationType?: string;
  transformationConfig?: any;
  isRequired: boolean;
  defaultValue?: string;
  direction: string;
  isActive: boolean;
}

export interface TransformationResult {
  success: boolean;
  value: any;
  error?: string;
}

// Типови трансформација
export enum TransformationType {
  NONE = 'none',
  DATE_FORMAT = 'date_format',
  NUMBER_FORMAT = 'number_format',
  STRING_CASE = 'string_case',
  BOOLEAN_MAPPING = 'boolean_mapping',
  STATUS_MAPPING = 'status_mapping',
  PRIORITY_MAPPING = 'priority_mapping',
  CUSTOM = 'custom',
  ENCODING = 'encoding'
}

/**
 * Сервис за мапирање поља између интерног и vendor система
 */
export class FieldMappingService {
  /**
   * Преузима активна мапирања за vendor систем
   */
  async getActiveMappings(
    vendorSystemId: string,
    entityType: string,
    direction?: string
  ): Promise<FieldMapping[]> {
    try {
      const mappings = await prisma.vendorFieldMapping.findMany({
        where: {
          vendorSystemId,
          entityType,
          isActive: true,
          ...(direction ? { 
            OR: [
              { direction },
              { direction: 'bidirectional' }
            ]
          } : {})
        },
        orderBy: { internalField: 'asc' }
      });

      return mappings;
    } catch (error) {
      logger.error(`Грешка при преузимању мапирања за vendor ${vendorSystemId}:`, error);
      throw new Error('Није могуће преузети мапирања поља');
    }
  }

  /**
   * Мапира податке из интерног формата у vendor формат
   */
  async mapToVendor(
    data: Record<string, any>,
    vendorSystemId: string,
    entityType: string
  ): Promise<Record<string, any>> {
    try {
      const mappings = await this.getActiveMappings(vendorSystemId, entityType, 'outbound');
      const mappedData: Record<string, any> = {};

      for (const mapping of mappings) {
        const internalValue = this.getNestedValue(data, mapping.internalField);
        
        // Провери да ли је поље обавезно
        if (mapping.isRequired && !internalValue && !mapping.defaultValue) {
          throw new Error(`Обавезно поље '${mapping.internalField}' недостаје`);
        }

        // Користи default вредност ако је потребно
        const valueToTransform = internalValue ?? mapping.defaultValue;
        
        if (valueToTransform !== undefined) {
          const transformResult = await this.transformValue(
            valueToTransform,
            mapping.transformationType || TransformationType.NONE,
            mapping.transformationConfig,
            'outbound'
          );

          if (!transformResult.success) {
            logger.warn(`Трансформација није успела за поље ${mapping.internalField}: ${transformResult.error}`);
            continue;
          }

          this.setNestedValue(mappedData, mapping.vendorField, transformResult.value);
        }
      }

      // Додај статус и приоритет мапирања
      if (entityType === 'ticket') {
        mappedData.status = await this.mapStatus(data.status, vendorSystemId, 'outbound');
        mappedData.priority = await this.mapPriority(data.priority, vendorSystemId, 'outbound');
      }

      logger.debug(`Мапирани подаци за vendor ${vendorSystemId}:`, mappedData);
      return mappedData;
    } catch (error) {
      logger.error(`Грешка при мапирању података за vendor:`, error);
      throw error;
    }
  }

  /**
   * Мапира податке из vendor формата у интерни формат
   */
  async mapFromVendor(
    vendorData: Record<string, any>,
    vendorSystemId: string,
    entityType: string
  ): Promise<Record<string, any>> {
    try {
      const mappings = await this.getActiveMappings(vendorSystemId, entityType, 'inbound');
      const mappedData: Record<string, any> = {};

      for (const mapping of mappings) {
        const vendorValue = this.getNestedValue(vendorData, mapping.vendorField);
        
        if (vendorValue !== undefined) {
          const transformResult = await this.transformValue(
            vendorValue,
            mapping.transformationType || TransformationType.NONE,
            mapping.transformationConfig,
            'inbound'
          );

          if (!transformResult.success) {
            logger.warn(`Трансформација није успела за поље ${mapping.vendorField}: ${transformResult.error}`);
            continue;
          }

          this.setNestedValue(mappedData, mapping.internalField, transformResult.value);
        }
      }

      // Додај статус и приоритет мапирања
      if (entityType === 'ticket') {
        mappedData.status = await this.mapStatus(vendorData.status, vendorSystemId, 'inbound');
        mappedData.priority = await this.mapPriority(vendorData.priority, vendorSystemId, 'inbound');
      }

      logger.debug(`Мапирани подаци из vendor ${vendorSystemId}:`, mappedData);
      return mappedData;
    } catch (error) {
      logger.error(`Грешка при мапирању података из vendor:`, error);
      throw error;
    }
  }

  /**
   * Трансформише вредност према типу трансформације
   */
  async transformValue(
    value: any,
    transformationType: string,
    config: any,
    direction: 'inbound' | 'outbound'
  ): Promise<TransformationResult> {
    try {
      switch (transformationType) {
        case TransformationType.NONE:
          return { success: true, value };

        case TransformationType.DATE_FORMAT:
          return this.transformDate(value, config, direction);

        case TransformationType.NUMBER_FORMAT:
          return this.transformNumber(value, config, direction);

        case TransformationType.STRING_CASE:
          return this.transformStringCase(value, config);

        case TransformationType.BOOLEAN_MAPPING:
          return this.transformBoolean(value, config, direction);

        case TransformationType.ENCODING:
          return this.ensureProperEncoding(value);

        case TransformationType.CUSTOM:
          return await this.customTransform(value, config, direction);

        default:
          return { success: true, value };
      }
    } catch (error) {
      return {
        success: false,
        value: null,
        error: error instanceof Error ? error.message : 'Непозната грешка трансформације'
      };
    }
  }

  /**
   * Трансформише датум према конфигурацији
   */
  private transformDate(
    value: any,
    config: any,
    direction: 'inbound' | 'outbound'
  ): TransformationResult {
    try {
      const sourceFormat = direction === 'inbound' ? 
        config?.vendorFormat || 'yyyy-MM-dd' : 
        config?.internalFormat || 'yyyy-MM-dd';
      
      const targetFormat = direction === 'outbound' ? 
        config?.vendorFormat || 'yyyy-MM-dd' : 
        config?.internalFormat || 'yyyy-MM-dd';

      // Парсирај датум
      const date = value instanceof Date ? value : 
        typeof value === 'string' ? parse(value, sourceFormat, new Date()) :
        new Date(value);

      if (isNaN(date.getTime())) {
        throw new Error('Неважећи датум');
      }

      // Форматирај у циљни формат
      const formatted = format(date, targetFormat, { locale: sr });
      
      return { success: true, value: formatted };
    } catch (error) {
      return {
        success: false,
        value: null,
        error: `Грешка при трансформацији датума: ${error}`
      };
    }
  }

  /**
   * Трансформише број према српском формату
   */
  private transformNumber(
    value: any,
    config: any,
    direction: 'inbound' | 'outbound'
  ): TransformationResult {
    try {
      const num = typeof value === 'number' ? value : parseFloat(value);
      
      if (isNaN(num)) {
        throw new Error('Неважећи број');
      }

      if (direction === 'outbound' && config?.serbianFormat) {
        // Форматирај број по српским стандардима
        const formatted = num.toLocaleString('sr-RS', {
          minimumFractionDigits: config.decimals || 0,
          maximumFractionDigits: config.decimals || 2
        });
        return { success: true, value: formatted };
      }

      if (direction === 'inbound' && config?.serbianFormat) {
        // Парсирај српски форматиран број
        const normalized = value.toString()
          .replace(/\./g, '') // Уклони сепараторе хиљада
          .replace(',', '.'); // Замени децимални зарез тачком
        
        return { success: true, value: parseFloat(normalized) };
      }

      return { success: true, value: num };
    } catch (error) {
      return {
        success: false,
        value: null,
        error: `Грешка при трансформацији броја: ${error}`
      };
    }
  }

  /**
   * Трансформише case стринга
   */
  private transformStringCase(value: any, config: any): TransformationResult {
    try {
      const str = value.toString();
      
      switch (config?.targetCase) {
        case 'upper':
          return { success: true, value: str.toUpperCase() };
        case 'lower':
          return { success: true, value: str.toLowerCase() };
        case 'title':
          return { 
            success: true, 
            value: str.replace(/\w\S*/g, txt => 
              txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            )
          };
        default:
          return { success: true, value: str };
      }
    } catch (error) {
      return {
        success: false,
        value: null,
        error: `Грешка при трансформацији стринга: ${error}`
      };
    }
  }

  /**
   * Трансформише boolean вредности
   */
  private transformBoolean(
    value: any,
    config: any,
    direction: 'inbound' | 'outbound'
  ): TransformationResult {
    try {
      const mapping = config?.mapping || {
        true: ['true', '1', 'да', 'yes'],
        false: ['false', '0', 'не', 'no']
      };

      if (direction === 'inbound') {
        const strValue = value.toString().toLowerCase();
        if (mapping.true.includes(strValue)) return { success: true, value: true };
        if (mapping.false.includes(strValue)) return { success: true, value: false };
      } else {
        // Outbound
        if (value === true) return { success: true, value: config?.trueValue || 'да' };
        if (value === false) return { success: true, value: config?.falseValue || 'не' };
      }

      return { success: true, value };
    } catch (error) {
      return {
        success: false,
        value: null,
        error: `Грешка при трансформацији boolean вредности: ${error}`
      };
    }
  }

  /**
   * Осигурава правилно енкодирање за српски текст
   */
  private ensureProperEncoding(value: any): TransformationResult {
    try {
      if (typeof value !== 'string') {
        return { success: true, value };
      }

      // Провери и поправи common encoding проблеме
      let encoded = value;
      
      // Замени common mojibake patterns за српска слова
      const replacements = [
        { from: 'Ä', to: 'č' },
        { from: 'Ä‡', to: 'ć' },
        { from: 'Å¾', to: 'ž' },
        { from: 'Å¡', to: 'š' },
        { from: 'Ä'', to: 'đ' },
        { from: 'ÄŒ', to: 'Č' },
        { from: 'Ä†', to: 'Ć' },
        { from: 'Å½', to: 'Ž' },
        { from: 'Å ', to: 'Š' },
        { from: 'Ä', to: 'Đ' }
      ];

      replacements.forEach(({ from, to }) => {
        encoded = encoded.replace(new RegExp(from, 'g'), to);
      });

      return { success: true, value: encoded };
    } catch (error) {
      return {
        success: false,
        value: null,
        error: `Грешка при енкодирању: ${error}`
      };
    }
  }

  /**
   * Custom трансформација према конфигурацији
   */
  private async customTransform(
    value: any,
    config: any,
    direction: 'inbound' | 'outbound'
  ): Promise<TransformationResult> {
    try {
      // Ако је дефинисана функција у конфигурацији
      if (config?.function) {
        const fn = new Function('value', 'config', 'direction', config.function);
        const result = await fn(value, config, direction);
        return { success: true, value: result };
      }

      // Ако је дефинисан regex pattern
      if (config?.regex && config?.replacement) {
        const regex = new RegExp(config.regex, config.flags || 'g');
        const result = value.toString().replace(regex, config.replacement);
        return { success: true, value: result };
      }

      return { success: true, value };
    } catch (error) {
      return {
        success: false,
        value: null,
        error: `Грешка при custom трансформацији: ${error}`
      };
    }
  }

  /**
   * Мапира статус између система
   */
  async mapStatus(
    status: string,
    vendorSystemId: string,
    direction: 'inbound' | 'outbound'
  ): Promise<string> {
    try {
      const mapping = await prisma.vendorStatusMapping.findFirst({
        where: {
          vendorSystemId,
          isActive: true,
          ...(direction === 'inbound' ? 
            { vendorStatus: status } : 
            { internalStatus: status })
        }
      });

      if (!mapping) {
        logger.warn(`Мапирање статуса није пронађено за ${status} (${direction})`);
        return status; // Врати оригинални статус
      }

      return direction === 'inbound' ? 
        mapping.internalStatus : 
        mapping.vendorStatus;
    } catch (error) {
      logger.error(`Грешка при мапирању статуса:`, error);
      return status;
    }
  }

  /**
   * Мапира приоритет између система
   */
  async mapPriority(
    priority: string,
    vendorSystemId: string,
    direction: 'inbound' | 'outbound'
  ): Promise<string> {
    try {
      const mapping = await prisma.vendorPriorityMapping.findFirst({
        where: {
          vendorSystemId,
          isActive: true,
          ...(direction === 'inbound' ? 
            { vendorPriority: priority } : 
            { internalPriority: priority })
        }
      });

      if (!mapping) {
        logger.warn(`Мапирање приоритета није пронађено за ${priority} (${direction})`);
        return priority;
      }

      return direction === 'inbound' ? 
        mapping.internalPriority : 
        mapping.vendorPriority;
    } catch (error) {
      logger.error(`Грешка при мапирању приоритета:`, error);
      return priority;
    }
  }

  /**
   * Добија вредност из nested објекта
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  /**
   * Поставља вредност у nested објекат
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const lastPart = parts.pop()!;
    
    const target = parts.reduce((acc, part) => {
      if (!acc[part]) acc[part] = {};
      return acc[part];
    }, obj);
    
    target[lastPart] = value;
  }

  /**
   * Валидира мапирану вредност
   */
  async validateMappedData(
    data: Record<string, any>,
    vendorSystemId: string,
    entityType: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const mappings = await this.getActiveMappings(vendorSystemId, entityType);
      
      for (const mapping of mappings) {
        if (mapping.isRequired) {
          const value = this.getNestedValue(data, mapping.vendorField);
          
          if (!value && !mapping.defaultValue) {
            errors.push(`Обавезно поље '${mapping.vendorField}' недостаје`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error(`Грешка при валидацији мапираних података:`, error);
      return {
        valid: false,
        errors: ['Грешка при валидацији података']
      };
    }
  }
}

// Експортуј singleton инстанцу
export const fieldMappingService = new FieldMappingService();
export default fieldMappingService; 