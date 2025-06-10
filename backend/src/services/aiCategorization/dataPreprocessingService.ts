/**
 * Data Preprocessing Service for AI Ticket Categorization
 * Processes Serbian ticket data and prepares it for model training
 */

import fs from 'fs/promises';
import path from 'path';
import {
  processSerbianText,
  calculateTFIDF,
  validateSerbianText,
  calculateCategoryScores,
  SerbianTextFeatures,
  CATEGORY_KEYWORDS
} from '../../utils/serbianNLP';

export interface TicketData {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  reporter: string;
  department: string;
  created_date: string;
  keywords: string[];
}

export interface ProcessedTicket {
  id: number;
  originalData: TicketData;
  titleFeatures: SerbianTextFeatures;
  descriptionFeatures: SerbianTextFeatures;
  combinedText: string;
  combinedFeatures: SerbianTextFeatures;
  categoryScores: { [category: string]: number };
  validationResults: {
    title: { isValid: boolean; issues: string[]; score: number };
    description: { isValid: boolean; issues: string[]; score: number };
    overall: { isValid: boolean; score: number };
  };
  numericFeatures: number[];
  category: string;
}

export interface DatasetStatistics {
  totalTickets: number;
  validTickets: number;
  invalidTickets: number;
  categoryDistribution: { [category: string]: number };
  averageTextLength: number;
  averageTokenCount: number;
  vocabularySize: number;
  qualityScore: number;
  scriptDistribution: {
    cyrillic: number;
    latin: number;
    mixed: number;
  };
}

export interface TrainingData {
  features: number[][];
  labels: string[];
  vocabulary: string[];
  categoryMap: { [category: string]: number };
  statistics: DatasetStatistics;
}

export class DataPreprocessingService {
  private datasetPath: string;
  private processedDataPath: string;

  constructor() {
    this.datasetPath = path.join(__dirname, '../../../..', 'data/training/serbian-tickets-dataset.json');
    this.processedDataPath = path.join(__dirname, '../../../..', 'data/training/processed-tickets.json');
  }

  /**
   * Load raw ticket dataset from JSON file
   */
  async loadRawDataset(): Promise<{ dataset_info: any; tickets: TicketData[] }> {
    try {
      const data = await fs.readFile(this.datasetPath, 'utf-8');
      const dataset = JSON.parse(data);
      
      console.log(`Loaded ${dataset.tickets.length} tickets from dataset`);
      return dataset;
    } catch (error) {
      console.error('Error loading dataset:', error);
      throw new Error('Failed to load ticket dataset');
    }
  }

  /**
   * Process a single ticket through Serbian NLP pipeline
   */
  processTicket(ticket: TicketData): ProcessedTicket {
    // Process title and description separately
    const titleFeatures = processSerbianText(ticket.title);
    const descriptionFeatures = processSerbianText(ticket.description);
    
    // Combine title and description for overall analysis
    const combinedText = `${ticket.title} ${ticket.description}`;
    const combinedFeatures = processSerbianText(combinedText);
    
    // Calculate category relevance scores
    const categoryScores = calculateCategoryScores(combinedFeatures.tokens);
    
    // Validate text quality
    const titleValidation = validateSerbianText(ticket.title);
    const descriptionValidation = validateSerbianText(ticket.description);
    const overallScore = (titleValidation.score + descriptionValidation.score) / 2;
    
    const validationResults = {
      title: titleValidation,
      description: descriptionValidation,
      overall: {
        isValid: overallScore >= 50,
        score: overallScore
      }
    };

    // Generate basic numeric features
    const numericFeatures = this.extractNumericFeatures(
      titleFeatures,
      descriptionFeatures,
      combinedFeatures,
      categoryScores
    );

    return {
      id: ticket.id,
      originalData: ticket,
      titleFeatures,
      descriptionFeatures,
      combinedText,
      combinedFeatures,
      categoryScores,
      validationResults,
      numericFeatures,
      category: ticket.category
    };
  }

  /**
   * Extract numeric features for machine learning
   */
  private extractNumericFeatures(
    titleFeatures: SerbianTextFeatures,
    descriptionFeatures: SerbianTextFeatures,
    combinedFeatures: SerbianTextFeatures,
    categoryScores: { [category: string]: number }
  ): number[] {
    const features: number[] = [];
    
    // Text length features
    features.push(titleFeatures.tokens.length);           // Title token count
    features.push(descriptionFeatures.tokens.length);     // Description token count
    features.push(combinedFeatures.tokens.length);        // Total token count
    
    // N-gram features
    features.push(combinedFeatures.nGrams.unigrams.length);  // Unigram count
    features.push(combinedFeatures.nGrams.bigrams.length);   // Bigram count
    features.push(combinedFeatures.nGrams.trigrams.length);  // Trigram count
    
    // Keyword features
    features.push(titleFeatures.keywords.length);         // Title keywords
    features.push(descriptionFeatures.keywords.length);   // Description keywords
    features.push(combinedFeatures.keywords.length);      // Total keywords
    
    // Script features (1 for cyrillic, 0 for latin)
    features.push(titleFeatures.language === 'cyrillic' ? 1 : 0);
    features.push(descriptionFeatures.language === 'cyrillic' ? 1 : 0);
    
    // Category relevance scores
    const categories = Object.keys(CATEGORY_KEYWORDS);
    for (const category of categories) {
      features.push(categoryScores[category] || 0);
    }
    
    return features;
  }

  /**
   * Process entire dataset through preprocessing pipeline
   */
  async processEntireDataset(): Promise<ProcessedTicket[]> {
    console.log('Starting dataset preprocessing...');
    
    const { tickets } = await this.loadRawDataset();
    const processedTickets: ProcessedTicket[] = [];
    
    let validCount = 0;
    let invalidCount = 0;
    
    for (const ticket of tickets) {
      try {
        const processed = this.processTicket(ticket);
        processedTickets.push(processed);
        
        if (processed.validationResults.overall.isValid) {
          validCount++;
        } else {
          invalidCount++;
          console.warn(`Low quality ticket ${ticket.id}: Score ${processed.validationResults.overall.score}`);
        }
        
        // Log progress every 10 tickets
        if (processed.id % 10 === 0) {
          console.log(`Processed ${processed.id} tickets...`);
        }
        
      } catch (error) {
        console.error(`Error processing ticket ${ticket.id}:`, error);
        invalidCount++;
      }
    }
    
    console.log(`Dataset preprocessing complete:`);
    console.log(`- Total tickets: ${tickets.length}`);
    console.log(`- Valid tickets: ${validCount}`);
    console.log(`- Invalid tickets: ${invalidCount}`);
    console.log(`- Quality rate: ${((validCount / tickets.length) * 100).toFixed(1)}%`);
    
    return processedTickets;
  }

  /**
   * Calculate dataset statistics
   */
  calculateStatistics(processedTickets: ProcessedTicket[]): DatasetStatistics {
    const totalTickets = processedTickets.length;
    const validTickets = processedTickets.filter(t => t.validationResults.overall.isValid).length;
    const invalidTickets = totalTickets - validTickets;
    
    // Category distribution
    const categoryDistribution: { [category: string]: number } = {};
    processedTickets.forEach(ticket => {
      categoryDistribution[ticket.category] = (categoryDistribution[ticket.category] || 0) + 1;
    });
    
    // Text length statistics
    const totalTextLengths = processedTickets.map(t => t.combinedText.length);
    const averageTextLength = totalTextLengths.reduce((a, b) => a + b, 0) / totalTickets;
    
    // Token count statistics  
    const totalTokenCounts = processedTickets.map(t => t.combinedFeatures.tokens.length);
    const averageTokenCount = totalTokenCounts.reduce((a, b) => a + b, 0) / totalTickets;
    
    // Vocabulary size
    const allTokens = new Set<string>();
    processedTickets.forEach(ticket => {
      ticket.combinedFeatures.tokens.forEach(token => allTokens.add(token));
    });
    const vocabularySize = allTokens.size;
    
    // Overall quality score
    const qualityScores = processedTickets.map(t => t.validationResults.overall.score);
    const qualityScore = qualityScores.reduce((a, b) => a + b, 0) / totalTickets;
    
    // Script distribution
    let cyrillicCount = 0;
    let latinCount = 0;
    let mixedCount = 0;
    
    processedTickets.forEach(ticket => {
      const titleScript = ticket.titleFeatures.language;
      const descScript = ticket.descriptionFeatures.language;
      
      if (titleScript === 'cyrillic' && descScript === 'cyrillic') {
        cyrillicCount++;
      } else if (titleScript === 'latin' && descScript === 'latin') {
        latinCount++;
      } else {
        mixedCount++;
      }
    });
    
    return {
      totalTickets,
      validTickets,
      invalidTickets,
      categoryDistribution,
      averageTextLength,
      averageTokenCount,
      vocabularySize,
      qualityScore,
      scriptDistribution: {
        cyrillic: cyrillicCount,
        latin: latinCount,
        mixed: mixedCount
      }
    };
  }

  /**
   * Create TF-IDF features for the entire dataset
   */
  async createTFIDFFeatures(processedTickets: ProcessedTicket[]): Promise<{
    tfidf: { [term: string]: number[] };
    vocabulary: string[];
  }> {
    console.log('Calculating TF-IDF features...');
    
    // Extract all documents (combined title + description)
    const documents = processedTickets.map(ticket => ticket.combinedText);
    
    // Calculate TF-IDF
    const tfidf = calculateTFIDF(documents);
    const vocabulary = Object.keys(tfidf);
    
    console.log(`Generated TF-IDF features for ${vocabulary.length} terms`);
    
    return { tfidf, vocabulary };
  }

  /**
   * Prepare final training data for machine learning
   */
  async prepareTrainingData(processedTickets: ProcessedTicket[]): Promise<TrainingData> {
    console.log('Preparing training data...');
    
    // Filter valid tickets only
    const validTickets = processedTickets.filter(t => t.validationResults.overall.isValid);
    
    if (validTickets.length === 0) {
      throw new Error('No valid tickets found for training');
    }
    
    // Create TF-IDF features
    const { tfidf, vocabulary } = await this.createTFIDFFeatures(validTickets);
    
    // Combine basic numeric features with TF-IDF features
    const features: number[][] = [];
    const labels: string[] = [];
    
    validTickets.forEach((ticket, index) => {
      // Get basic numeric features
      const basicFeatures = ticket.numericFeatures;
      
             // Get TF-IDF features for this document
       const tfidfFeatures: number[] = [];
       vocabulary.forEach(term => {
         const termScores = tfidf[term];
         tfidfFeatures.push(termScores?.[index] || 0);
       });
      
      // Combine features
      const combinedFeatures = [...basicFeatures, ...tfidfFeatures];
      features.push(combinedFeatures);
      labels.push(ticket.category);
    });
    
    // Create category mapping
    const uniqueCategories = [...new Set(labels)];
    const categoryMap: { [category: string]: number } = {};
    uniqueCategories.forEach((category, index) => {
      categoryMap[category] = index;
    });
    
    // Calculate statistics
    const statistics = this.calculateStatistics(processedTickets);
    
    console.log(`Training data prepared:`);
    console.log(`- Features: ${validTickets.length} samples x ${features[0]?.length || 0} dimensions`);
    console.log(`- Categories: ${uniqueCategories.length}`);
    console.log(`- Vocabulary: ${vocabulary.length} terms`);
    
    return {
      features,
      labels,
      vocabulary,
      categoryMap,
      statistics
    };
  }

  /**
   * Save processed data to file
   */
  async saveProcessedData(processedTickets: ProcessedTicket[]): Promise<void> {
    try {
      const data = {
        processed_at: new Date().toISOString(),
        total_tickets: processedTickets.length,
        statistics: this.calculateStatistics(processedTickets),
        tickets: processedTickets
      };
      
      await fs.writeFile(this.processedDataPath, JSON.stringify(data, null, 2));
      console.log(`Processed data saved to: ${this.processedDataPath}`);
    } catch (error) {
      console.error('Error saving processed data:', error);
      throw error;
    }
  }

  /**
   * Save training data to file
   */
  async saveTrainingData(trainingData: TrainingData): Promise<void> {
    try {
      const trainingDataPath = path.join(__dirname, '../../../..', 'data/training/training-data.json');
      
      const data = {
        created_at: new Date().toISOString(),
        format_version: '1.0',
        ...trainingData
      };
      
      await fs.writeFile(trainingDataPath, JSON.stringify(data, null, 2));
      console.log(`Training data saved to: ${trainingDataPath}`);
    } catch (error) {
      console.error('Error saving training data:', error);
      throw error;
    }
  }

  /**
   * Main preprocessing pipeline
   */
  async runPreprocessingPipeline(): Promise<TrainingData> {
    try {
      console.log('=== AI CATEGORIZATION DATA PREPROCESSING PIPELINE ===');
      console.log('Phase 1: Loading raw dataset...');
      
      // Load and process dataset
      const processedTickets = await this.processEntireDataset();
      
      console.log('\nPhase 2: Saving processed tickets...');
      await this.saveProcessedData(processedTickets);
      
      console.log('\nPhase 3: Preparing training data...');
      const trainingData = await this.prepareTrainingData(processedTickets);
      
      console.log('\nPhase 4: Saving training data...');
      await this.saveTrainingData(trainingData);
      
      console.log('\n=== PREPROCESSING PIPELINE COMPLETE ===');
      console.log('Statistics:');
      console.log(`- Total tickets: ${trainingData.statistics.totalTickets}`);
      console.log(`- Valid for training: ${trainingData.statistics.validTickets}`);
      console.log(`- Quality score: ${trainingData.statistics.qualityScore.toFixed(1)}%`);
      console.log(`- Feature dimensions: ${trainingData.features.length > 0 ? trainingData.features[0].length : 0}`);
      console.log(`- Categories: ${Object.keys(trainingData.categoryMap).length}`);
      
      return trainingData;
    } catch (error) {
      console.error('Preprocessing pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Test preprocessing with a single ticket
   */
  async testPreprocessing(ticketText: string, expectedCategory?: string): Promise<void> {
    console.log('\n=== TESTING PREPROCESSING ===');
    console.log(`Input: "${ticketText}"`);
    
    const mockTicket: TicketData = {
      id: 999,
      title: ticketText.split(' ').slice(0, 5).join(' '),
      description: ticketText,
      category: expectedCategory || 'UNKNOWN',
      priority: 'medium',
      reporter: 'Test User',
      department: 'Test Department',
      created_date: new Date().toISOString(),
      keywords: []
    };
    
    const processed = this.processTicket(mockTicket);
    
    console.log('\nProcessing Results:');
    console.log(`- Language: ${processed.combinedFeatures.language}`);
    console.log(`- Tokens: ${processed.combinedFeatures.tokens.length}`);
    console.log(`- Keywords: ${processed.combinedFeatures.keywords.join(', ')}`);
    console.log(`- Quality Score: ${processed.validationResults.overall.score}`);
    console.log(`- Is Valid: ${processed.validationResults.overall.isValid}`);
    
    console.log('\nCategory Scores:');
    const sortedScores = Object.entries(processed.categoryScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    sortedScores.forEach(([category, score]) => {
      console.log(`  ${category}: ${score}`);
    });
    
    if (expectedCategory) {
      const predictedCategory = sortedScores[0][0];
      const isCorrect = predictedCategory === expectedCategory;
      console.log(`\nPrediction: ${predictedCategory}`);
      console.log(`Expected: ${expectedCategory}`);
      console.log(`Correct: ${isCorrect ? '✅' : '❌'}`);
    }
  }
}

export default new DataPreprocessingService(); 