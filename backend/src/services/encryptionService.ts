import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';

/**
 * Сервис за AES-256 енкрипцију и декрипцију осетљивих података
 * Користи се за заштиту PII података, поверљивих информација и других осетљивих садржаја
 */
class EncryptionService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'AES';

  constructor() {
    this.encryptionKey = this.getEncryptionKey();
    if (!this.encryptionKey) {
      throw new Error('Није дефинисан кључ за енкрипцију. Проверите ENV варијаблу ENCRYPTION_KEY.');
    }
  }

  /**
   * Добија кључ за енкрипцију из environment варијабли
   */
  private getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      // У development окружењу, користи default кључ (НИКАД у production!)
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  УПОЗОРЕЊЕ: Користи се default encryption кључ. НИЈЕ БЕЗБЕДНО за production!');
        return 'default-development-key-32-chars-long'; // 32 карактера за AES-256
      }
      throw new Error('ENCRYPTION_KEY мора бити дефинисан у production окружењу');
    }
    return key;
  }

  /**
   * Енкриптује текст користећи AES-256
   * @param plainText - Текст који треба енкриптовати
   * @returns Енкриптовани текст као string
   */
  encrypt(plainText: string): string {
    try {
      if (!plainText || typeof plainText !== 'string') {
        throw new Error('Текст за енкрипцију мора бити валидан string');
      }

      const encrypted = CryptoJS.AES.encrypt(plainText, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      console.error('Грешка при енкрипцији:', error);
      throw new Error('Неуспешна енкрипција података');
    }
  }

  /**
   * Декриптује енкриптовани текст
   * @param encryptedText - Енкриптовани текст
   * @returns Оригинални plain текст
   */
  decrypt(encryptedText: string): string {
    try {
      if (!encryptedText || typeof encryptedText !== 'string') {
        throw new Error('Енкриптовани текст мора бити валидан string');
      }

      const decrypted = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
      const plainText = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!plainText) {
        throw new Error('Декрипција није успешна - могуће је да је кључ неисправан');
      }

      return plainText;
    } catch (error) {
      console.error('Грешка при декрипцији:', error);
      throw new Error('Неуспешна декрипција података');
    }
  }

  /**
   * Енкриптује објекат (конвертује у JSON па енкриптује)
   * @param data - Објекат за енкрипцију
   * @returns Енкриптовани JSON као string
   */
  encryptObject(data: any): string {
    try {
      const jsonString = JSON.stringify(data);
      return this.encrypt(jsonString);
    } catch (error) {
      console.error('Грешка при енкрипцији објекта:', error);
      throw new Error('Неуспешна енкрипција објекта');
    }
  }

  /**
   * Декриптује објекат (декриптује па парсира JSON)
   * @param encryptedData - Енкриптовани JSON string
   * @returns Оригинални објекат
   */
  decryptObject<T = any>(encryptedData: string): T {
    try {
      const decryptedJson = this.decrypt(encryptedData);
      return JSON.parse(decryptedJson) as T;
    } catch (error) {
      console.error('Грешка при декрипцији објекта:', error);
      throw new Error('Неуспешна декрипција објекта');
    }
  }

  /**
   * Хеширање лозинке користећи bcrypt
   * @param password - Plain text лозинка
   * @param saltRounds - Број rounds за salt (default: 12)
   * @returns Hash лозинке
   */
  async hashPassword(password: string, saltRounds: number = 12): Promise<string> {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Лозинка мора бити валидан string');
      }

      const hash = await bcrypt.hash(password, saltRounds);
      return hash;
    } catch (error) {
      console.error('Грешка при хешовању лозинке:', error);
      throw new Error('Неуспешно хешовање лозинке');
    }
  }

  /**
   * Верификује лозинку против хеша
   * @param password - Plain text лозинка
   * @param hash - Hash лозинке из базе
   * @returns true ако се лозинке поклапају
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!password || !hash) {
        return false;
      }

      const isValid = await bcrypt.compare(password, hash);
      return isValid;
    } catch (error) {
      console.error('Грешка при верификацији лозинке:', error);
      return false;
    }
  }

  /**
   * Генерише random кључ за енкрипцију (за употребу при иницијализацији)
   * @param length - Дужина кључа у карактерима (default: 32 за AES-256)
   * @returns Random генерисани кључ
   */
  static generateEncryptionKey(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return result;
  }

  /**
   * Проверава да ли је текст енкриптован (једноставна провера)
   * @param text - Текст за проверу
   * @returns true ако изгледа као енкриптован текст
   */
  isEncrypted(text: string): boolean {
    try {
      // Енкриптовани текст обично има специфичан format и карактере
      const regex = /^[A-Za-z0-9+/=]+$/;
      return Boolean(text && text.length > 20 && regex.test(text));
    } catch {
      return false;
    }
  }

  /**
   * Енкриптује поља у објекту која треба да буду заштићена
   * @param data - Објекат са подацима
   * @param fieldsToEncrypt - Низ имена поља за енкрипцију
   * @returns Објекат са енкриптованим пољима
   */
  encryptFields(data: Record<string, any>, fieldsToEncrypt: string[]): Record<string, any> {
    const result = { ...data };
    
    fieldsToEncrypt.forEach(field => {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field]);
      }
    });
    
    return result;
  }

  /**
   * Декриптује поља у објекту која су енкриптована
   * @param data - Објекат са енкриптованим подацима
   * @param fieldsToDecrypt - Низ имена поља за декрипцију
   * @returns Објекат са декриптованим пољима
   */
  decryptFields(data: Record<string, any>, fieldsToDecrypt: string[]): Record<string, any> {
    const result = { ...data };
    
    fieldsToDecrypt.forEach(field => {
      if (result[field] && typeof result[field] === 'string' && this.isEncrypted(result[field])) {
        try {
          result[field] = this.decrypt(result[field]);
        } catch (error) {
          console.warn(`Не могу да декриптујем поље ${field}:`, error);
          // Остави оригиналну вредност ако декрипција није успешна
        }
      }
    });
    
    return result;
  }
}

// Експортуј singleton инстанцу
export const encryptionService = new EncryptionService();
export default encryptionService;

// Помоћне функције за брже коришћење
export const encrypt = (text: string) => encryptionService.encrypt(text);
export const decrypt = (text: string) => encryptionService.decrypt(text);
export const hashPassword = (password: string) => encryptionService.hashPassword(password);
export const verifyPassword = (password: string, hash: string) => encryptionService.verifyPassword(password, hash); 