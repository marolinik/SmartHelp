/**
 * AI Model Service for Serbian Ticket Categorization
 * Handles TensorFlow.js model creation, training, and inference
 */

import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs/promises';
import path from 'path';
import { TrainingData, ProcessedTicket } from './dataPreprocessingService';
import { processSerbianText, calculateCategoryScores } from '../../utils/serbianNLP';

export interface ModelArchitecture {
  inputDim: number;
  hiddenLayers: number[];
  outputDim: number;
  dropoutRate: number;
  learningRate: number;
  batchSize: number;
  epochs: number;
}

export interface TrainingConfig {
  validationSplit: number;
  earlyStoppingPatience: number;
  modelCheckpointPath: string;
  logTraining: boolean;
}

export interface ModelMetrics {
  accuracy: number;
  precision: { [category: string]: number };
  recall: { [category: string]: number };
  f1Score: { [category: string]: number };
  overallF1: number;
  confusionMatrix: number[][];
  categoryMap: { [category: string]: number };
}

export interface PredictionResult {
  category: string;
  confidence: number;
  allPredictions: Array<{
    category: string;
    confidence: number;
  }>;
  processingTime: number;
  features: {
    textLength: number;
    keywordCount: number;
    detectedLanguage: 'cyrillic' | 'latin';
  };
}

export class AIModelService {
  private model: tf.LayersModel | null = null;
  private categoryMap: { [category: string]: number } = {};
  private reverseCategoryMap: { [index: number]: string } = {};
  private vocabulary: string[] = [];
  private modelPath: string;
  private isTraining: boolean = false;

  constructor() {
    this.modelPath = path.join(__dirname, '../../../..', 'models/serbian-categorization-model');
  }

  /**
   * Create TensorFlow.js model architecture optimized for Serbian text classification
   */
  private createModel(architecture: ModelArchitecture): tf.LayersModel {
    console.log('Creating TensorFlow.js model architecture...');
    
    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
      inputShape: [architecture.inputDim],
      units: architecture.hiddenLayers[0],
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'dense_input'
    }));

    // Dropout for regularization
    model.add(tf.layers.dropout({
      rate: architecture.dropoutRate,
      name: 'dropout_input'
    }));

    // Hidden layers
    for (let i = 1; i < architecture.hiddenLayers.length; i++) {
      model.add(tf.layers.dense({
        units: architecture.hiddenLayers[i],
        activation: 'relu',
        kernelInitializer: 'heNormal',
        name: `dense_hidden_${i}`
      }));

      model.add(tf.layers.dropout({
        rate: architecture.dropoutRate,
        name: `dropout_hidden_${i}`
      }));
    }

    // Output layer for multi-class classification
    model.add(tf.layers.dense({
      units: architecture.outputDim,
      activation: 'softmax',
      name: 'dense_output'
    }));

    // Compile model
    model.compile({
      optimizer: tf.train.adam(architecture.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    console.log('Model architecture:');
    model.summary();

    return model;
  }

  /**
   * Prepare training data for TensorFlow.js
   */
  private prepareTrainingData(trainingData: TrainingData): {
    xTrain: tf.Tensor2D;
    yTrain: tf.Tensor2D;
    xValidation: tf.Tensor2D;
    yValidation: tf.Tensor2D;
  } {
    console.log('Preparing training data tensors...');

    // Convert features to tensor
    const features = tf.tensor2d(trainingData.features);

    // Convert labels to one-hot encoding
    const labelIndices = trainingData.labels.map(label => trainingData.categoryMap[label]);
    const labels = tf.oneHot(labelIndices, Object.keys(trainingData.categoryMap).length);

    // Split into training and validation sets
    const totalSamples = trainingData.features.length;
    const validationSize = Math.floor(totalSamples * 0.2); // 20% validation
    const trainSize = totalSamples - validationSize;

    // Shuffle indices
    const indices = Array.from({ length: totalSamples }, (_, i) => i);
    tf.util.shuffle(indices);

    const trainIndices = indices.slice(0, trainSize);
    const validationIndices = indices.slice(trainSize);

    // Create training and validation datasets
    const xTrain = tf.gather(features, trainIndices) as tf.Tensor2D;
    const yTrain = tf.gather(labels, trainIndices) as tf.Tensor2D;
    const xValidation = tf.gather(features, validationIndices) as tf.Tensor2D;
    const yValidation = tf.gather(labels, validationIndices) as tf.Tensor2D;

    // Clean up temporary tensors
    features.dispose();
    labels.dispose();

    console.log(`Training set: ${trainSize} samples`);
    console.log(`Validation set: ${validationSize} samples`);

    return { xTrain, yTrain, xValidation, yValidation };
  }

  /**
   * Train the model with Serbian ticket data
   */
  async trainModel(
    trainingData: TrainingData,
    architecture: ModelArchitecture,
    config: TrainingConfig
  ): Promise<ModelMetrics> {
    if (this.isTraining) {
      throw new Error('Model is already training');
    }

    this.isTraining = true;
    console.log('=== STARTING SERBIAN TICKET CATEGORIZATION MODEL TRAINING ===');

    try {
      // Store category mappings
      this.categoryMap = trainingData.categoryMap;
      this.reverseCategoryMap = Object.fromEntries(
        Object.entries(trainingData.categoryMap).map(([k, v]) => [v, k])
      );
      this.vocabulary = trainingData.vocabulary;

      // Create model
      this.model = this.createModel(architecture);

      // Prepare training data
      const { xTrain, yTrain, xValidation, yValidation } = this.prepareTrainingData(trainingData);

      // Setup callbacks
      const callbacks: tf.CustomCallback[] = [];

      // Early stopping callback
      callbacks.push({
        onEpochEnd: async (epoch: number, logs?: tf.Logs) => {
          if (config.logTraining && logs) {
            console.log(`Epoch ${epoch + 1}:`);
            console.log(`  Loss: ${(logs.loss as number).toFixed(4)}`);
            console.log(`  Accuracy: ${(logs.acc as number).toFixed(4)}`);
            console.log(`  Val Loss: ${(logs.val_loss as number).toFixed(4)}`);
            console.log(`  Val Accuracy: ${(logs.val_acc as number).toFixed(4)}`);
          }
        }
      });

      // Train model
      console.log('Starting training...');
      const history = await this.model.fit(xTrain, yTrain, {
        epochs: architecture.epochs,
        batchSize: architecture.batchSize,
        validationData: [xValidation, yValidation],
        callbacks,
        verbose: config.logTraining ? 1 : 0
      });

      // Evaluate model
      console.log('Evaluating model performance...');
      const metrics = await this.evaluateModel(xValidation, yValidation);

      // Save model
      await this.saveModel();

      // Clean up tensors
      xTrain.dispose();
      yTrain.dispose();
      xValidation.dispose();
      yValidation.dispose();

      console.log('=== TRAINING COMPLETE ===');
      console.log(`Final Accuracy: ${metrics.accuracy.toFixed(4)}`);
      console.log(`Overall F1 Score: ${metrics.overallF1.toFixed(4)}`);

      return metrics;
    } catch (error) {
      console.error('Training failed:', error);
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Evaluate model performance with detailed metrics
   */
  private async evaluateModel(xTest: tf.Tensor2D, yTest: tf.Tensor2D): Promise<ModelMetrics> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    // Get predictions
    const predictions = this.model.predict(xTest) as tf.Tensor2D;
    const predictedIndices = predictions.argMax(-1);
    const actualIndices = yTest.argMax(-1);

    // Convert to arrays for analysis
    const predictedArray = await predictedIndices.data();
    const actualArray = await actualIndices.data();

    // Calculate overall accuracy
    const correctPredictions = Array.from(predictedArray).reduce((acc: number, pred, i) => {
      return acc + (pred === actualArray[i] ? 1 : 0);
    }, 0);
    const accuracy = correctPredictions / predictedArray.length;

    // Calculate per-category metrics
    const categories = Object.keys(this.categoryMap);
    const numCategories = categories.length;
    const confusionMatrix = Array(numCategories).fill(0).map(() => Array(numCategories).fill(0));
    
    // Fill confusion matrix
    for (let i = 0; i < predictedArray.length; i++) {
      const predicted = predictedArray[i];
      const actual = actualArray[i];
      if (predicted !== undefined && actual !== undefined && 
          predicted < numCategories && actual < numCategories) {
        confusionMatrix[actual][predicted]++;
      }
    }

    // Calculate precision, recall, and F1 for each category
    const precision: { [category: string]: number } = {};
    const recall: { [category: string]: number } = {};
    const f1Score: { [category: string]: number } = {};

    let totalF1 = 0;
    for (let i = 0; i < numCategories; i++) {
      const category = this.reverseCategoryMap[i];
      
      // True positives, false positives, false negatives
      const tp = confusionMatrix[i][i];
      const fp = confusionMatrix.reduce((sum, row) => sum + row[i], 0) - tp;
      const fn = confusionMatrix[i].reduce((sum, val) => sum + val, 0) - tp;

      precision[category] = fp + tp > 0 ? tp / (tp + fp) : 0;
      recall[category] = fn + tp > 0 ? tp / (tp + fn) : 0;
      f1Score[category] = precision[category] + recall[category] > 0 
        ? 2 * (precision[category] * recall[category]) / (precision[category] + recall[category])
        : 0;

      totalF1 += f1Score[category];
    }

    const overallF1 = totalF1 / numCategories;

    // Clean up tensors
    predictions.dispose();
    predictedIndices.dispose();
    actualIndices.dispose();

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      overallF1,
      confusionMatrix,
      categoryMap: this.categoryMap
    };
  }

  /**
   * Save trained model to file system
   */
  async saveModel(): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }

    try {
      console.log('Saving model...');
      
      // Create models directory if it doesn't exist
      await fs.mkdir(path.dirname(this.modelPath), { recursive: true });

      // Save model
      await this.model.save(`file://${this.modelPath}`);

      // Save metadata
      const metadata = {
        categoryMap: this.categoryMap,
        vocabulary: this.vocabulary,
        modelVersion: '1.0',
        trainedAt: new Date().toISOString(),
        language: 'serbian'
      };

      const metadataPath = path.join(path.dirname(this.modelPath), 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      console.log(`Model saved to: ${this.modelPath}`);
    } catch (error) {
      console.error('Error saving model:', error);
      throw error;
    }
  }

  /**
   * Load trained model from file system
   */
  async loadModel(): Promise<void> {
    try {
      console.log('Loading model...');

      // Load model
      this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);

      // Load metadata
      const metadataPath = path.join(path.dirname(this.modelPath), 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      this.categoryMap = metadata.categoryMap;
      this.reverseCategoryMap = Object.fromEntries(
        Object.entries(this.categoryMap).map(([k, v]) => [v, k])
      );
      this.vocabulary = metadata.vocabulary;

      console.log('Model loaded successfully');
      console.log(`Categories: ${Object.keys(this.categoryMap).join(', ')}`);
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    }
  }

  /**
   * Predict category for a Serbian ticket
   */
  async predictTicketCategory(
    title: string,
    description: string
  ): Promise<PredictionResult> {
    if (!this.model) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const startTime = Date.now();

    try {
      // Process text through Serbian NLP pipeline
      const combinedText = `${title} ${description}`;
      const features = processSerbianText(combinedText);
      const categoryScores = calculateCategoryScores(features.tokens);

      // Extract numeric features (matching training pipeline)
      const numericFeatures = this.extractFeaturesForPrediction(
        title,
        description,
        features,
        categoryScores
      );

      // Create tensor and predict
      const inputTensor = tf.tensor2d([numericFeatures]);
      const prediction = this.model.predict(inputTensor) as tf.Tensor2D;
      const probabilities = await prediction.data();

      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();

      // Get all predictions sorted by confidence
      const allPredictions = Object.entries(this.categoryMap)
        .map(([category, index]) => ({
          category,
          confidence: probabilities[index]
        }))
        .sort((a, b) => b.confidence - a.confidence);

      const topPrediction = allPredictions[0];
      const processingTime = Date.now() - startTime;

      return {
        category: topPrediction.category,
        confidence: topPrediction.confidence,
        allPredictions,
        processingTime,
        features: {
          textLength: combinedText.length,
          keywordCount: features.keywords.length,
          detectedLanguage: features.language
        }
      };
    } catch (error) {
      console.error('Prediction failed:', error);
      throw error;
    }
  }

  /**
   * Extract features for prediction (matching training pipeline)
   */
  private extractFeaturesForPrediction(
    title: string,
    description: string,
    combinedFeatures: any,
    categoryScores: { [category: string]: number }
  ): number[] {
    const titleFeatures = processSerbianText(title);
    const descriptionFeatures = processSerbianText(description);

    const features: number[] = [];

    // Text length features
    features.push(titleFeatures.tokens.length);
    features.push(descriptionFeatures.tokens.length);
    features.push(combinedFeatures.tokens.length);

    // N-gram features
    features.push(combinedFeatures.nGrams.unigrams.length);
    features.push(combinedFeatures.nGrams.bigrams.length);
    features.push(combinedFeatures.nGrams.trigrams.length);

    // Keyword features
    features.push(titleFeatures.keywords.length);
    features.push(descriptionFeatures.keywords.length);
    features.push(combinedFeatures.keywords.length);

    // Script features
    features.push(titleFeatures.language === 'cyrillic' ? 1 : 0);
    features.push(descriptionFeatures.language === 'cyrillic' ? 1 : 0);

    // Category relevance scores
    const categories = Object.keys(this.categoryMap);
    for (const category of categories) {
      features.push(categoryScores[category] || 0);
    }

    // Pad with zeros for TF-IDF features (simplified for inference)
    const tfidfPadding = Array(this.vocabulary.length).fill(0);
    features.push(...tfidfPadding);

    return features;
  }

  /**
   * Get model information
   */
  getModelInfo(): {
    isLoaded: boolean;
    categories: string[];
    vocabularySize: number;
    isTraining: boolean;
  } {
    return {
      isLoaded: this.model !== null,
      categories: Object.keys(this.categoryMap),
      vocabularySize: this.vocabulary.length,
      isTraining: this.isTraining
    };
  }

  /**
   * Test model with example Serbian texts
   */
  async testModel(): Promise<void> {
    console.log('\n=== TESTING SERBIAN CATEGORIZATION MODEL ===');

    const testCases = [
      { title: 'Штампач не ради', description: 'Штампач у канцеларији не штампа документе', expected: 'HARDWARE' },
      { title: 'Заборавио лозинку', description: 'Не могу да се пријавим јер сам заборавио лозинку', expected: 'PASSWORDS' },
      { title: 'Интернет је спор', description: 'Веб страницама треба много времена да се учитају', expected: 'NETWORK' },
      { title: 'Excel се укида', description: 'Програм се стално затвара када отворим фајл', expected: 'SOFTWARE' },
      { title: 'Блокиран налог', description: 'Налог ми је блокиран због неуспешних пријављивања', expected: 'ACCOUNT_ACCESS' }
    ];

    let correctPredictions = 0;

    for (const testCase of testCases) {
      try {
        const prediction = await this.predictTicketCategory(testCase.title, testCase.description);
        const isCorrect = prediction.category === testCase.expected;
        
        console.log(`\nTest: "${testCase.title}"`);
        console.log(`Expected: ${testCase.expected}`);
        console.log(`Predicted: ${prediction.category} (${(prediction.confidence * 100).toFixed(1)}%)`);
        console.log(`Correct: ${isCorrect ? '✅' : '❌'}`);
        console.log(`Processing time: ${prediction.processingTime}ms`);

        if (isCorrect) correctPredictions++;
      } catch (error) {
        console.error(`Error testing "${testCase.title}":`, error);
      }
    }

    const accuracy = (correctPredictions / testCases.length) * 100;
    console.log(`\nTest Accuracy: ${accuracy.toFixed(1)}% (${correctPredictions}/${testCases.length})`);
  }
}

export default new AIModelService(); 