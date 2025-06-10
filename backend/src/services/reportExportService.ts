import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import fs from 'fs';
import path from 'path';

// Import types - would be installed via npm in production
// import * as XLSX from 'xlsx';
// import PDFDocument from 'pdfkit';

// Mock implementations for development until dependencies are installed
const XLSX = {
  utils: {
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    aoa_to_sheet: (data: any[][]) => ({ '!ref': 'A1:Z100', ...data }),
    book_append_sheet: (book: any, sheet: any, name: string) => {},
    decode_range: (ref: string) => ({ s: { r: 0, c: 0 }, e: { r: 10, c: 10 } }),
    encode_cell: (coord: { r: number, c: number }) => 'A1'
  },
  writeFile: (book: any, path: string, options?: any) => {}
};

const PDFDocument = class {
  constructor(options?: any) {}
  registerFont(name: string, path: string) {}
  font(name: string) { return this; }
  fontSize(size: number) { return this; }
  text(text: string, x?: number, y?: number, options?: any) { return this; }
  pipe(stream: any) { return this; }
  addPage() { return this; }
  end() {}
  moveTo(x: number, y: number) { return this; }
  lineTo(x: number, y: number) { return this; }
  stroke() { return this; }
  switchToPage(page: number) { return this; }
  bufferedPageRange() { return { count: 1 }; }
  heightOfString(text: string, options?: any) { return 20; }
  get page() { return { height: 800 }; }
};

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  filename?: string;
  includeCharts?: boolean;
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'a4' | 'letter';
  encoding?: 'utf8' | 'utf16le';
  delimiter?: ',' | ';' | '\t';
  dateFormat?: string;
  numberFormat?: 'sr' | 'en';
  headers?: Record<string, string>;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  generatedAt: Date;
  period?: { startDate: Date; endDate: Date };
  sections: ReportSection[];
  metadata?: Record<string, any>;
}

export interface ReportSection {
  type: 'table' | 'chart' | 'metric' | 'text';
  title: string;
  data?: any[][];
  headers?: string[];
  content?: string;
  chartData?: any;
  metrics?: Record<string, number | string>;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  filePath: string;
  fileSize: number;
  format: string;
  encoding: string;
  error?: string;
}

class ReportExportService {
  private outputDir: string;
  private fontPath: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'exports');
    this.fontPath = path.join(process.cwd(), 'assets', 'fonts');
    this.ensureDirectories();
  }

  /**
   * Export report to specified format with Serbian encoding
   */
  async exportReport(reportData: ReportData, options: ExportOptions): Promise<ExportResult> {
    try {
      console.log(`Покретање export-а извештаја "${reportData.title}" у ${options.format} формату...`);

      // Generate filename if not provided
      const filename = options.filename || this.generateFilename(reportData.title, options.format);
      const filePath = path.join(this.outputDir, filename);

      let result: ExportResult;

      switch (options.format) {
        case 'pdf':
          result = await this.exportToPdf(reportData, filePath, options);
          break;
        case 'excel':
          result = await this.exportToExcel(reportData, filePath, options);
          break;
        case 'csv':
          result = await this.exportToCsv(reportData, filePath, options);
          break;
        default:
          throw new Error(`Неподржан format: ${options.format}`);
      }

      console.log(`Успешно експортован извештај: ${result.filename} (${result.fileSize} bytes)`);
      return result;
    } catch (error) {
      console.error('Грешка при export-у извештаја:', error);
      throw new Error(`Грешка при export-у: ${error}`);
    }
  }

  /**
   * Export to PDF with Serbian fonts and formatting
   */
  private async exportToPdf(reportData: ReportData, filePath: string, options: ExportOptions): Promise<ExportResult> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: options.paperSize?.toUpperCase() || 'A4',
          layout: options.orientation || 'portrait',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: reportData.title,
            Author: 'PIO Help Desk',
            Subject: 'Аутоматски генерисан извештај',
            Creator: 'PIO Help Desk Report System',
            CreationDate: new Date()
          }
        });

        // Setup UTF-8 font for Serbian characters
        this.setupSerbianFont(doc);

        // Stream to file
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        this.addPdfHeader(doc, reportData);

        // Content sections
        let yPosition = 150;
        for (const section of reportData.sections) {
          yPosition = this.addPdfSection(doc, section, yPosition);
          
          // Add new page if needed
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }
        }

        // Footer
        this.addPdfFooter(doc, reportData);

        doc.end();

        stream.on('finish', () => {
          const stats = fs.statSync(filePath);
          resolve({
            success: true,
            filename: path.basename(filePath),
            filePath,
            fileSize: stats.size,
            format: 'pdf',
            encoding: 'utf8'
          });
        });

        stream.on('error', (error) => {
          reject(new Error(`Грешка при писању PDF фајла: ${error.message}`));
        });

      } catch (error) {
        reject(new Error(`Грешка при креирању PDF-а: ${error}`));
      }
    });
  }

  /**
   * Export to Excel with Serbian encoding
   */
  private async exportToExcel(reportData: ReportData, filePath: string, options: ExportOptions): Promise<ExportResult> {
    try {
      const workbook = XLSX.utils.book_new();

      // Main report sheet
      const mainSheetData = this.prepareExcelMainSheet(reportData);
      const mainSheet = XLSX.utils.aoa_to_sheet(mainSheetData);
      
      // Apply Serbian formatting
      this.formatExcelSheet(mainSheet, options);
      XLSX.utils.book_append_sheet(workbook, mainSheet, 'Извештај');

      // Add data sheets for each table section
      reportData.sections.forEach((section, index) => {
        if (section.type === 'table' && section.data && section.headers) {
          const sheetData = [section.headers, ...section.data];
          const sheet = XLSX.utils.aoa_to_sheet(sheetData);
          this.formatExcelSheet(sheet, options);
          
          // Ensure sheet name is valid for Excel
          const sheetName = this.sanitizeSheetName(section.title, index);
          XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
        }
      });

      // Write file with UTF-8 encoding
      XLSX.writeFile(workbook, filePath, { 
        bookType: 'xlsx',
        compression: true,
        Props: {
          Title: reportData.title,
          Subject: 'PIO Help Desk Извештај',
          Author: 'PIO Help Desk Систем',
          CreatedDate: new Date()
        }
      });

      const stats = fs.statSync(filePath);
      return {
        success: true,
        filename: path.basename(filePath),
        filePath,
        fileSize: stats.size,
        format: 'excel',
        encoding: 'utf8'
      };
    } catch (error) {
      throw new Error(`Грешка при креирању Excel фајла: ${error}`);
    }
  }

  /**
   * Export to CSV with Serbian encoding
   */
  private async exportToCsv(reportData: ReportData, filePath: string, options: ExportOptions): Promise<ExportResult> {
    try {
      const delimiter = options.delimiter || ';'; // Serbian standard uses semicolon
      const encoding = options.encoding || 'utf8';
      let csvContent = '';

      // Add BOM for proper UTF-8 encoding in Excel
      if (encoding === 'utf8') {
        csvContent = '\uFEFF'; // UTF-8 BOM
      }

      // Header information
      csvContent += `"${reportData.title}"\n`;
      csvContent += `"Генерисан: ${format(reportData.generatedAt, 'dd.MM.yyyy у HH:mm', { locale: sr })}"\n`;
      
      if (reportData.period) {
        const period = `${format(reportData.period.startDate, 'dd.MM.yyyy', { locale: sr })} - ${format(reportData.period.endDate, 'dd.MM.yyyy', { locale: sr })}`;
        csvContent += `"Период: ${period}"\n`;
      }
      
      csvContent += '\n';

      // Process each section
      for (const section of reportData.sections) {
        csvContent += `"${section.title}"\n`;
        
        if (section.type === 'table' && section.data && section.headers) {
          // Headers
          csvContent += section.headers.map(h => `"${this.escapeCsv(h)}"`).join(delimiter) + '\n';
          
          // Data rows
          for (const row of section.data) {
            const formattedRow = row.map(cell => {
              let value = cell;
              
              // Format numbers according to Serbian standards
              if (typeof value === 'number') {
                value = this.formatSerbianNumber(value, options.numberFormat || 'sr');
              }
              
              // Format dates
              if (value instanceof Date) {
                value = format(value, options.dateFormat || 'dd.MM.yyyy', { locale: sr });
              }
              
              return `"${this.escapeCsv(String(value))}"`;
            });
            
            csvContent += formattedRow.join(delimiter) + '\n';
          }
        } else if (section.type === 'metric' && section.metrics) {
          // Metrics as key-value pairs
          for (const [key, value] of Object.entries(section.metrics)) {
            let formattedValue = value;
            if (typeof value === 'number') {
              formattedValue = this.formatSerbianNumber(value, options.numberFormat || 'sr');
            }
            csvContent += `"${this.escapeCsv(key)}"${delimiter}"${this.escapeCsv(String(formattedValue))}"\n`;
          }
        } else if (section.type === 'text' && section.content) {
          csvContent += `"${this.escapeCsv(section.content)}"\n`;
        }
        
        csvContent += '\n';
      }

      // Write file
      fs.writeFileSync(filePath, csvContent, { encoding });

      const stats = fs.statSync(filePath);
      return {
        success: true,
        filename: path.basename(filePath),
        filePath,
        fileSize: stats.size,
        format: 'csv',
        encoding
      };
    } catch (error) {
      throw new Error(`Грешка при креирању CSV фајла: ${error}`);
    }
  }

  /**
   * Setup Serbian font for PDF
   */
  private setupSerbianFont(doc: any): void {
    try {
      // Register default fonts that support Serbian characters
      doc.registerFont('DejaVu', path.join(this.fontPath, 'DejaVuSans.ttf'));
      doc.registerFont('DejaVu-Bold', path.join(this.fontPath, 'DejaVuSans-Bold.ttf'));
      doc.font('DejaVu');
    } catch (error) {
      console.warn('Не могу да учитам српски фонт, користим default:', error);
      // Fallback to default font
      doc.font('Helvetica');
    }
  }

  /**
   * Add PDF header with Serbian formatting
   */
  private addPdfHeader(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    // Title
    doc.fontSize(20)
       .font('DejaVu-Bold')
       .text(reportData.title, 50, 50, { align: 'center' });

    // Subtitle
    if (reportData.subtitle) {
      doc.fontSize(14)
         .font('DejaVu')
         .text(reportData.subtitle, 50, 80, { align: 'center' });
    }

    // Generation info
    const generatedText = `Генерисан: ${format(reportData.generatedAt, 'dd.MM.yyyy у HH:mm', { locale: sr })}`;
    doc.fontSize(10)
       .text(generatedText, 50, 110, { align: 'right' });

    // Period info
    if (reportData.period) {
      const periodText = `Период: ${format(reportData.period.startDate, 'dd.MM.yyyy', { locale: sr })} - ${format(reportData.period.endDate, 'dd.MM.yyyy', { locale: sr })}`;
      doc.text(periodText, 50, 125, { align: 'right' });
    }

    // Divider line
    doc.moveTo(50, 140)
       .lineTo(550, 140)
       .stroke();
  }

  /**
   * Add PDF section content
   */
  private addPdfSection(doc: PDFKit.PDFDocument, section: ReportSection, yPosition: number): number {
    let currentY = yPosition;

    // Section title
    doc.fontSize(14)
       .font('DejaVu-Bold')
       .text(section.title, 50, currentY);
    currentY += 25;

    switch (section.type) {
      case 'table':
        if (section.data && section.headers) {
          currentY = this.addPdfTable(doc, section.headers, section.data, currentY);
        }
        break;
      
      case 'metric':
        if (section.metrics) {
          currentY = this.addPdfMetrics(doc, section.metrics, currentY);
        }
        break;
      
      case 'text':
        if (section.content) {
          doc.fontSize(10)
             .font('DejaVu')
             .text(section.content, 50, currentY, { width: 500 });
          currentY += doc.heightOfString(section.content, { width: 500 }) + 10;
        }
        break;
    }

    return currentY + 20;
  }

  /**
   * Add table to PDF
   */
  private addPdfTable(doc: PDFKit.PDFDocument, headers: string[], data: any[][], yPosition: number): number {
    let currentY = yPosition;
    const columnWidth = 100;
    const startX = 50;

    // Headers
    doc.fontSize(9)
       .font('DejaVu-Bold');
    
    headers.forEach((header, index) => {
      doc.text(header, startX + (index * columnWidth), currentY, { width: columnWidth - 5 });
    });
    currentY += 20;

    // Data rows
    doc.font('DejaVu');
    data.forEach(row => {
      row.forEach((cell, index) => {
        let value = cell;
        
        // Format numbers and dates for Serbian locale
        if (typeof value === 'number') {
          value = this.formatSerbianNumber(value, 'sr');
        } else if (value instanceof Date) {
          value = format(value, 'dd.MM.yyyy', { locale: sr });
        }
        
        doc.text(String(value), startX + (index * columnWidth), currentY, { width: columnWidth - 5 });
      });
      currentY += 15;
    });

    return currentY;
  }

  /**
   * Add metrics to PDF
   */
  private addPdfMetrics(doc: PDFKit.PDFDocument, metrics: Record<string, number | string>, yPosition: number): number {
    let currentY = yPosition;

    doc.fontSize(10)
       .font('DejaVu');

    for (const [key, value] of Object.entries(metrics)) {
      let formattedValue = value;
      if (typeof value === 'number') {
        formattedValue = this.formatSerbianNumber(value, 'sr');
      }
      
      doc.text(`${key}: ${formattedValue}`, 50, currentY);
      currentY += 15;
    }

    return currentY;
  }

  /**
   * Add PDF footer
   */
  private addPdfFooter(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      doc.fontSize(8)
         .font('DejaVu')
         .text(
           'PIO Help Desk - Аутоматски генерисан извештај',
           50,
           doc.page.height - 50,
           { align: 'center' }
         );
      
      doc.text(
         `Страна ${i + 1} од ${pageCount}`,
         50,
         doc.page.height - 30,
         { align: 'center' }
       );
    }
  }

  /**
   * Prepare Excel main sheet data
   */
  private prepareExcelMainSheet(reportData: ReportData): any[][] {
    const data: any[][] = [];
    
    // Title and info
    data.push([reportData.title]);
    data.push([`Генерисан: ${format(reportData.generatedAt, 'dd.MM.yyyy у HH:mm', { locale: sr })}`]);
    
    if (reportData.period) {
      const period = `${format(reportData.period.startDate, 'dd.MM.yyyy', { locale: sr })} - ${format(reportData.period.endDate, 'dd.MM.yyyy', { locale: sr })}`;
      data.push([`Период: ${period}`]);
    }
    
    data.push([]); // Empty row

    // Summary of sections
    data.push(['Садржај извештаја:']);
    reportData.sections.forEach((section, index) => {
      data.push([`${index + 1}. ${section.title}`]);
    });

    return data;
  }

  /**
   * Format Excel sheet with Serbian conventions
   */
  private formatExcelSheet(sheet: XLSX.WorkSheet, options: ExportOptions): void {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    
    // Apply Serbian number formatting
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[cellAddress];
        
        if (cell && typeof cell.v === 'number') {
          cell.z = '#.##0,00'; // Serbian number format
        }
      }
    }

    // Set column widths
    sheet['!cols'] = [];
    for (let i = 0; i <= range.e.c; i++) {
      sheet['!cols'].push({ wch: 20 });
    }
  }

  /**
   * Generate filename with Serbian characters support
   */
  private generateFilename(title: string, format: string): string {
    const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
    const sanitizedTitle = title
      .replace(/[^\w\s-ћђчћžšđčć]/gi, '') // Keep Serbian characters
      .replace(/\s+/g, '_')
      .toLowerCase();
    
    const extension = format === 'excel' ? 'xlsx' : format;
    return `izvesaj_${sanitizedTitle}_${timestamp}.${extension}`;
  }

  /**
   * Sanitize sheet name for Excel
   */
  private sanitizeSheetName(name: string, index: number): string {
    // Excel sheet name restrictions
    const sanitized = name
      .replace(/[\\\/\?\*\[\]]/g, '') // Remove invalid characters
      .substring(0, 31); // Max 31 characters
    
    return sanitized || `Лист${index + 1}`;
  }

  /**
   * Format number according to Serbian standards
   */
  private formatSerbianNumber(value: number, format: 'sr' | 'en'): string {
    if (format === 'sr') {
      return value.toLocaleString('sr-RS', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }
    return value.toLocaleString('en-US');
  }

  /**
   * Escape CSV content
   */
  private escapeCsv(text: string): string {
    return text.replace(/"/g, '""');
  }

  /**
   * Ensure export directories exist
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.fontPath)) {
      fs.mkdirSync(this.fontPath, { recursive: true });
    }
  }

  /**
   * Get available export formats
   */
  getAvailableFormats(): string[] {
    return ['pdf', 'excel', 'csv'];
  }

  /**
   * Validate export options
   */
  validateExportOptions(options: ExportOptions): void {
    if (!this.getAvailableFormats().includes(options.format)) {
      throw new Error(`Неподржан формат: ${options.format}`);
    }

    if (options.orientation && !['portrait', 'landscape'].includes(options.orientation)) {
      throw new Error(`Неподржана оријентација: ${options.orientation}`);
    }

    if (options.paperSize && !['a4', 'letter'].includes(options.paperSize)) {
      throw new Error(`Неподржана величина папира: ${options.paperSize}`);
    }
  }

  /**
   * Get export statistics
   */
  async getExportStats(): Promise<{
    totalExports: number;
    formatCounts: Record<string, number>;
    averageFileSize: number;
    lastExportTime: Date | null;
  }> {
    try {
      const files = fs.readdirSync(this.outputDir);
      const formatCounts: Record<string, number> = { pdf: 0, excel: 0, csv: 0 };
      let totalSize = 0;
      let lastExportTime: Date | null = null;

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);
        
        totalSize += stats.size;
        
        if (!lastExportTime || stats.mtime > lastExportTime) {
          lastExportTime = stats.mtime;
        }

        const ext = path.extname(file).substring(1);
        if (ext === 'pdf') formatCounts.pdf++;
        else if (ext === 'xlsx') formatCounts.excel++;
        else if (ext === 'csv') formatCounts.csv++;
      }

      return {
        totalExports: files.length,
        formatCounts,
        averageFileSize: files.length > 0 ? Math.round(totalSize / files.length) : 0,
        lastExportTime
      };
    } catch (error) {
      console.error('Грешка при добијању статистика export-а:', error);
      return {
        totalExports: 0,
        formatCounts: { pdf: 0, excel: 0, csv: 0 },
        averageFileSize: 0,
        lastExportTime: null
      };
    }
  }
}

export const reportExportService = new ReportExportService(); 