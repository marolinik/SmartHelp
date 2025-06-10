import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import auditService, { AuditEventType, AuditSeverity } from './auditService';

/**
 * Типови података за анонимизацију
 */
export enum DataType {
  EMAIL = 'email',
  PHONE = 'phone',
  NAME = 'name',
  ADDRESS = 'address',
  IP_ADDRESS = 'ip_address',
  USER_AGENT = 'user_agent',
  TEXT_CONTENT = 'text_content',
  DATE = 'date',
  NUMBER = 'number'
}

/**
 * Стратегије анонимизације
 */
export enum AnonymizationStrategy {
  HASH = 'hash',           // Хеширање (необратимо)
  PSEUDONYMIZE = 'pseudonymize', // Псеудонимизација (обратимо са кључем)
  MASK = 'mask',           // Маскирање (део података скривен)
  RANDOMIZE = 'randomize', // Рандомизација (потпуно нови подаци)
  TRUNCATE = 'truncate',   // Скраћивање (уклањање дела података)
  NULLIFY = 'nullify'      // Постављање на null
}

/**
 * Конфигурација за анонимизацију поља
 */
export interface FieldAnonymizationConfig {
  fieldName: string;
  dataType: DataType;
  strategy: AnonymizationStrategy;
  preserveFormat?: boolean; // Да ли да се очува формат (нпр. за email: korisnik@domen.com)
  seedValue?: string;       // Seed вредност за конзистентну псеудонимизацију
}

/**
 * Резултат анонимизације
 */
export interface AnonymizationResult {
  id: string;
  timestamp: Date;
  fieldsProcessed: number;
  recordsProcessed: number;
  strategy: string;
  originalDataHash: string;
  anonymizedDataHash: string;
  verification: {
    noPersonalDataDetected: boolean;
    irreversible: boolean;
    formatPreserved: boolean;
  };
}

/**
 * Сервис за анонимизацију података у тест окружењима
 */
class DataAnonymizationService {
  private readonly saltKey = process.env.ANONYMIZATION_SALT || 'pio-help-desk-anonymization-2024';
  private readonly outputDir = path.join(process.cwd(), 'data', 'anonymized');

  constructor() {
    // Креирај директоријум за анонимизоване податке ако не постоји
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Анонимизује појединачну вредност на основу типа и стратегије
   */
  anonymizeValue(value: any, dataType: DataType, strategy: AnonymizationStrategy, options: {
    preserveFormat?: boolean;
    seedValue?: string;
  } = {}): any {
    if (value === null || value === undefined || value === '') {
      return value;
    }

    const strValue = String(value);
    const { preserveFormat = true, seedValue = '' } = options;

    switch (strategy) {
      case AnonymizationStrategy.HASH:
        return this.hashValue(strValue, seedValue);

      case AnonymizationStrategy.PSEUDONYMIZE:
        return this.pseudonymizeValue(strValue, dataType, preserveFormat, seedValue);

      case AnonymizationStrategy.MASK:
        return this.maskValue(strValue, dataType);

      case AnonymizationStrategy.RANDOMIZE:
        return this.randomizeValue(dataType, preserveFormat);

      case AnonymizationStrategy.TRUNCATE:
        return this.truncateValue(strValue, dataType);

      case AnonymizationStrategy.NULLIFY:
        return null;

      default:
        throw new Error(`Непознат стратегија анонимизације: ${strategy}`);
    }
  }

  /**
   * Анонимизује низ објеката на основу конфигурације
   */
  anonymizeDataset(data: any[], config: FieldAnonymizationConfig[]): {
    anonymizedData: any[];
    result: AnonymizationResult;
  } {
    const startTime = Date.now();
    const resultId = crypto.randomUUID();
    
    console.log(`🔒 Започиње анонимизација ${data.length} записа...`);

    // Израчунај хеш оригиналних података
    const originalDataHash = this.calculateDataHash(data);

    const anonymizedData = data.map(record => {
      const anonymizedRecord = { ...record };

      config.forEach(fieldConfig => {
        if (fieldConfig.fieldName in anonymizedRecord) {
          try {
            anonymizedRecord[fieldConfig.fieldName] = this.anonymizeValue(
              record[fieldConfig.fieldName],
              fieldConfig.dataType,
              fieldConfig.strategy,
              {
                preserveFormat: fieldConfig.preserveFormat ?? true,
                seedValue: fieldConfig.seedValue ?? ''
              }
            );
          } catch (error) {
            console.error(`❌ Грешка при анонимизацији поља ${fieldConfig.fieldName}:`, error);
            // У случају грешке, поставити на null за безбедност
            anonymizedRecord[fieldConfig.fieldName] = null;
          }
        }
      });

      return anonymizedRecord;
    });

    // Израчунај хеш анонимизованих података
    const anonymizedDataHash = this.calculateDataHash(anonymizedData);

    // Провери анонимизацију
    const verification = this.verifyAnonymization(data, anonymizedData, config);

    const result: AnonymizationResult = {
      id: resultId,
      timestamp: new Date(),
      fieldsProcessed: config.length,
      recordsProcessed: data.length,
      strategy: config.map(c => `${c.fieldName}:${c.strategy}`).join(', '),
      originalDataHash,
      anonymizedDataHash,
      verification
    };

    const duration = Date.now() - startTime;
    console.log(`✅ Анонимизација завршена за ${duration}ms`);

    // Логуј анонимизацију у audit систем
    auditService.log(
      AuditEventType.DATA_VIEW,
      AuditSeverity.MEDIUM,
      `Извршена анонимизација података: ${data.length} записа, ${config.length} поља`,
      {
        metadata: {
          anonymizationId: resultId,
          recordsProcessed: data.length,
          fieldsProcessed: config.length,
          duration,
          verification
        }
      }
    );

    return { anonymizedData, result };
  }

  /**
   * Хеширање вредности (необратимо)
   */
  private hashValue(value: string, seedValue: string = ''): string {
    const hash = crypto.createHash('sha256');
    hash.update(value + this.saltKey + seedValue);
    return hash.digest('hex').substring(0, 16); // Скрати на 16 карактера
  }

  /**
   * Псеудонимизација вредности (обратимо са кључем)
   */
  private pseudonymizeValue(value: string, dataType: DataType, preserveFormat: boolean, seedValue: string): string {
    const baseHash = this.hashValue(value, seedValue);
    
    switch (dataType) {
      case DataType.EMAIL:
        if (preserveFormat && value.includes('@')) {
          const parts = value.split('@');
          const domain = parts.length > 1 ? parts[1] : 'example.com';
          return `korisnik${baseHash.substring(0, 6)}@${domain}`;
        }
        return `korisnik${baseHash.substring(0, 8)}@example.com`;

      case DataType.PHONE:
        if (preserveFormat) {
          // Очувај формат српског телефона (+381...)
          return `+381${baseHash.substring(0, 8).replace(/[a-f]/g, '0')}`;
        }
        return baseHash.substring(0, 10).replace(/[a-f]/g, '0');

      case DataType.NAME:
        const names = ['Милош', 'Ана', 'Петар', 'Марија', 'Никола', 'Јована', 'Стефан', 'Тамара'];
        const index = parseInt(baseHash.substring(0, 2), 16) % names.length;
        return names[index] + baseHash.substring(0, 4);

      case DataType.ADDRESS:
        return `Улица ${baseHash.substring(0, 6)} ${parseInt(baseHash.substring(6, 8), 16) % 100 + 1}, Београд`;

      default:
        return baseHash.substring(0, 12);
    }
  }

  /**
   * Маскирање вредности (део података скривен)
   */
  private maskValue(value: string, dataType: DataType): string {
    if (value.length <= 2) return '***';

    switch (dataType) {
      case DataType.EMAIL:
        if (value.includes('@')) {
          const parts = value.split('@');
          const username = parts[0] || '';
          const domain = parts.length > 1 ? parts[1] : '';
          const maskedUsername = username.substring(0, 2) + '***';
          return `${maskedUsername}@${domain}`;
        }
        return value.substring(0, 2) + '***';

      case DataType.PHONE:
        if (value.length > 6) {
          return value.substring(0, 3) + '***' + value.substring(value.length - 2);
        }
        return value.substring(0, 2) + '***';

      case DataType.NAME:
        return value.substring(0, 2) + '***';

      default:
        const visibleLength = Math.min(3, Math.floor(value.length / 3));
        return value.substring(0, visibleLength) + '***';
    }
  }

  /**
   * Рандомизација вредности (потпуно нови подаци)
   */
  private randomizeValue(dataType: DataType, preserveFormat: boolean): string {
    const random = crypto.randomBytes(8).toString('hex');

    switch (dataType) {
      case DataType.EMAIL:
        return preserveFormat ? `test${random.substring(0, 6)}@example.com` : `${random}@example.com`;

      case DataType.PHONE:
        return preserveFormat ? `+381${random.substring(0, 8).replace(/[a-f]/g, '0')}` : random.substring(0, 10);

      case DataType.NAME:
        const names = ['Test', 'Demo', 'Sample', 'Example'];
        return names[Math.floor(Math.random() * names.length)] + random.substring(0, 4);

      case DataType.DATE:
        const randomDate = new Date(2020, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
        return randomDate.toISOString().split('T')[0];

      default:
        return random.substring(0, 12);
    }
  }

  /**
   * Скраћивање вредности
   */
  private truncateValue(value: string, dataType: DataType): string {
    switch (dataType) {
      case DataType.EMAIL:
        if (value.includes('@')) {
          const parts = value.split('@');
          return parts.length > 1 ? parts[1] : value.substring(0, 5);
        }
        return value.substring(0, 5);

      case DataType.ADDRESS:
        const parts = value.split(',');
        return parts.length > 0 ? (parts[0] || value.substring(0, 10)) : value.substring(0, 10);

      default:
        return value.substring(0, Math.floor(value.length / 2));
    }
  }

  /**
   * Израчунава хеш скупа података
   */
  private calculateDataHash(data: any[]): string {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    const hash = crypto.createHash('sha256');
    hash.update(dataString);
    return hash.digest('hex');
  }

  /**
   * Верификује да ли је анонимизација правилно извршена
   */
  private verifyAnonymization(originalData: any[], anonymizedData: any[], config: FieldAnonymizationConfig[]): {
    noPersonalDataDetected: boolean;
    irreversible: boolean;
    formatPreserved: boolean;
  } {
    let noPersonalDataDetected = true;
    let irreversible = true;
    let formatPreserved = true;

    // Провери да ли анонимизовани подаци садрже личне податке
    const personalDataPatterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
      /\+?\d{1,4}[- ]?\(?\d{1,3}\)?[- ]?\d{1,4}[- ]?\d{1,9}/, // Телефон
      /\b[А-ЯЁЂШЧЋЖРЛН][а-яёђшчћжрлн]+\s+[А-ЯЁЂШЧЋЖРЛН][а-яёђшчћжрлн]+\b/ // Српска имена
    ];

    anonymizedData.forEach((record, index) => {
      config.forEach(fieldConfig => {
        const anonymizedValue = String(record[fieldConfig.fieldName] || '');
        const originalValue = String(originalData[index][fieldConfig.fieldName] || '');

        // Провери да ли постоји директна веза између оригинала и анонимизације
        if (originalValue && anonymizedValue === originalValue) {
          irreversible = false;
        }

        // Провери да ли анонимизовани подаци садрже образце личних података
        personalDataPatterns.forEach(pattern => {
          if (pattern.test(anonymizedValue)) {
            noPersonalDataDetected = false;
          }
        });

        // Провери очување формата (за email, телефон)
        if (fieldConfig.preserveFormat) {
          if (fieldConfig.dataType === DataType.EMAIL) {
            if (originalValue.includes('@') && !anonymizedValue.includes('@')) {
              formatPreserved = false;
            }
          }
        }
      });
    });

    return {
      noPersonalDataDetected,
      irreversible,
      formatPreserved
    };
  }

  /**
   * Сачувај анонимизоване податке у фајл
   */
  async saveAnonymizedData(data: any[], result: AnonymizationResult, filename: string): Promise<string> {
    const outputPath = path.join(this.outputDir, filename);
    
    const outputData = {
      metadata: {
        anonymizationId: result.id,
        timestamp: result.timestamp,
        fieldsProcessed: result.fieldsProcessed,
        recordsProcessed: result.recordsProcessed,
        verification: result.verification,
        warning: 'ОВИ ПОДАЦИ СУ АНОНИМИЗОВАНИ ЗА ТЕСТ СВРХЕ - НЕ КОРИСТИТИ У ПРОДУКЦИЈИ'
      },
      data
    };

    await fs.promises.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
    
    console.log(`💾 Анонимизовани подаци сачувани: ${outputPath}`);
    return outputPath;
  }

  /**
   * Добија статистике анонимизације
   */
  getAnonymizationStatistics(): {
    totalProcessed: number;
    lastAnonymization: Date | null;
    anonymizedFiles: string[];
  } {
    const files = fs.readdirSync(this.outputDir).filter(f => f.endsWith('.json'));
    
    return {
      totalProcessed: files.length,
      lastAnonymization: files.length > 0 ? new Date() : null,
      anonymizedFiles: files
    };
  }
}

// Експортуј singleton инстанцу
export const dataAnonymizationService = new DataAnonymizationService();
export default dataAnonymizationService; 