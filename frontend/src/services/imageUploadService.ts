import api from './api';

export interface ImageUploadResponse {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export interface ImageUploadError {
  message: string;
  code?: string;
}

class ImageUploadService {
  /**
   * Upload слике за KB чланке
   */
  async uploadKnowledgeBaseImage(file: File): Promise<string> {
    try {
      // Валидација фајла пре upload-а
      this.validateImageFile(file);

      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post<{
        success: boolean;
        message: string;
        data: ImageUploadResponse;
      }>('/kb/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        // Progress callback би могао бити додан овде
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            console.log(`Upload напредак: ${percentCompleted}%`);
          }
        }
      });

      if (response.data.success && response.data.data) {
        // Враћа пуну URL адресу слике
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        return `${baseUrl}${response.data.data.url}`;
      } else {
        throw new Error(response.data.message || 'Грешка при upload-у слике');
      }
    } catch (error: any) {
      console.error('Грешка при upload-у KB слике:', error);
      
      // Обради различите типове грешака
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      if (error.code === 'NETWORK_ERROR') {
        throw new Error('Грешка мреже. Проверите интернет конекцију.');
      }
      
      if (error.name === 'ValidationError') {
        throw new Error(error.message);
      }
      
      throw new Error('Неочекивана грешка при upload-у слике');
    }
  }

  /**
   * Валидација image фајла пре upload-а
   */
  private validateImageFile(file: File): void {
    // Провера да ли је фајл заиста изабран
    if (!file) {
      throw new Error('Морате изабрати фајл');
    }

    // Провера типа фајла
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        'Неподржан тип фајла. Дозвољени су: JPEG, PNG, GIF, WebP, SVG'
      );
    }

    // Провера величине фајла (5MB лимит)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error(
        `Фајл је превелик. Максимална величина је ${this.formatFileSize(maxSize)}`
      );
    }

    // Провера минималне величине (1KB)
    const minSize = 1024; // 1KB
    if (file.size < minSize) {
      throw new Error('Фајл је премали. Минимална величина је 1KB');
    }
  }

  /**
   * Брише upload-овану слику
   */
  async deleteKnowledgeBaseImage(filename: string): Promise<void> {
    try {
      await api.delete(`/kb/images/${filename}`);
    } catch (error: any) {
      console.error('Грешка при брисању KB слике:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Слика није пронађена');
      }
      
      throw new Error('Грешка при брисању слике');
    }
  }

  /**
   * Валидација URL адресе слике
   */
  isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // Провери да ли URL завршава са image extension
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      return imageExtensions.some(ext => pathname.endsWith(ext));
    } catch {
      return false;
    }
  }

  /**
   * Извлачи име фајла из URL адресе
   */
  extractFilenameFromUrl(url: string): string | null {
    try {
      // За наше KB слике, URL је у формату: /uploads/kb-images/filename
      const match = url.match(/\/uploads\/kb-images\/([^/?]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Форматира величину фајла за приказ
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Генерише preview URL за слику
   */
  generatePreviewUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Не могу да генеришем preview'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Грешка при читању фајла'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Компресија слике пре upload-а (опционо)
   */
  async compressImage(file: File, quality = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Одреди нове димензије (максимално 1920x1080)
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Нацртај слику на canvas
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Конвертуј у Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Грешка при компресији слике'));
            }
          },
          file.type,
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Не могу да учитам слику'));
      img.src = URL.createObjectURL(file);
    });
  }
}

export default new ImageUploadService(); 