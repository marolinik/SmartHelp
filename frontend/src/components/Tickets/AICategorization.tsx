/**
 * AI Categorization Component
 * Provides real-time AI-powered ticket categorization suggestions
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Alert,
  Button,
  Tooltip,
  Collapse,
  IconButton,
  Stack,
  Divider
} from '@mui/material';
import {
  SmartToy as AIIcon,
  CheckCircle as AcceptIcon,
  Cancel as RejectIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Psychology as BrainIcon,
  Language as LanguageIcon,
  Schedule as TimeIcon
} from '@mui/icons-material';
import aiCategorizationService, { 
  AIPrediction, 
  CategorizationResponse 
} from '../../services/aiCategorizationService';

interface AICategorizationProps {
  title: string;
  description: string;
  currentCategoryId?: string;
  onSuggestionAccept: (categoryKey: string) => void;
  onKeywordsAccept: (keywords: string[]) => void;
  disabled?: boolean;
  showDetailedView?: boolean;
  ticketId?: string; // For feedback tracking
  enableFeedback?: boolean; // Enable automatic feedback collection
}

const AICategorization: React.FC<AICategorizationProps> = ({
  title,
  description,
  currentCategoryId,
  onSuggestionAccept,
  onKeywordsAccept,
  disabled = false,
  showDetailedView = false,
  ticketId,
  enableFeedback = true
}) => {
  // State
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(showDetailedView);
  const [lastProcessed, setLastProcessed] = useState<string>('');

  // Clear prediction when inputs change significantly
  useEffect(() => {
    const currentInput = `${title}_${description}`;
    if (lastProcessed && currentInput !== lastProcessed) {
      setPrediction(null);
      setError(null);
    }
  }, [title, description, lastProcessed]);

  // Debounced prediction request
  useEffect(() => {
    if (!title.trim() || !description.trim() || disabled) {
      setPrediction(null);
      setError(null);
      return;
    }

    if (title.length < 3 || description.length < 10) {
      return; // Wait for more substantial input
    }

    setLoading(true);
    setError(null);

    aiCategorizationService.debouncedCategorization(
      title,
      description,
      (result: CategorizationResponse) => {
        setLoading(false);
        
        if (result.success && result.prediction) {
          setPrediction(result.prediction);
          setLastProcessed(`${title}_${description}`);
        } else {
          setError(result.error || 'Грешка при AI категоризацији');
          setPrediction(null);
        }
      },
      800 // 800ms debounce delay
    );

    // Cleanup function
    return () => {
      aiCategorizationService.cancelPendingRequests();
    };
  }, [title, description, disabled]);

  // Handle suggestion acceptance
  const handleAcceptSuggestion = async () => {
    if (prediction) {
      onSuggestionAccept(prediction.category);
      
      // Record feedback if enabled and ticketId is provided
      if (enableFeedback && ticketId) {
        try {
          await aiCategorizationService.recordFeedback(
            ticketId,
            { title, description },
            prediction,
            {
              selectedCategory: prediction.category,
              isManualOverride: false,
              feedbackType: 'accept'
            }
          );
        } catch (error) {
          console.warn('Failed to record AI feedback:', error);
        }
      }
    }
  };

  // Handle keywords acceptance
  const handleAcceptKeywords = () => {
    if (prediction?.features.suggestedKeywords) {
      onKeywordsAccept(prediction.features.suggestedKeywords);
    }
  };

  // Get confidence color and level
  const getConfidenceDisplay = () => {
    if (!prediction) return null;
    return aiCategorizationService.getConfidenceDisplay(prediction.confidenceLevel);
  };

  // Get language display
  const getLanguageDisplay = () => {
    if (!prediction) return null;
    return aiCategorizationService.getLanguageDisplay(prediction.features.detectedLanguage);
  };

  // Don't render if no meaningful input
  if (!title.trim() || !description.trim()) {
    return null;
  }

  return (
    <Card 
      sx={{ 
        mt: 2, 
        border: prediction ? '2px solid #2196F3' : '1px solid #E0E0E0',
        boxShadow: prediction ? 3 : 1
      }}
    >
      <CardContent>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <AIIcon sx={{ mr: 1, color: '#2196F3' }} />
            <Typography variant="h6" color="primary">
              AI Категоризација
            </Typography>
            {loading && (
              <Chip 
                size="small" 
                label="Анализира..." 
                color="info" 
                sx={{ ml: 1 }}
              />
            )}
          </Box>
          <IconButton 
            size="small" 
            onClick={() => setExpanded(!expanded)}
            disabled={!prediction && !error}
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </Box>

        {/* Loading Progress */}
        {loading && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress color="primary" />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              AI анализира садржај тикета...
            </Typography>
          </Box>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {error}
            </Typography>
          </Alert>
        )}

        {/* Main Prediction */}
        {prediction && (
          <Box>
            {/* Primary Suggestion */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Box display="flex" alignItems="center" flex={1}>
                <Typography variant="body1" sx={{ mr: 2 }}>
                  Предлог:
                </Typography>
                <Chip
                  label={prediction.categoryDisplayName}
                  color="primary"
                  variant="filled"
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                  }}
                />
                <Box ml={2}>
                  {(() => {
                    const confidenceDisplay = getConfidenceDisplay();
                    return confidenceDisplay ? (
                      <Tooltip title={confidenceDisplay.description}>
                        <Chip
                          size="small"
                          label={`${confidenceDisplay.label} (${(prediction.confidence * 100).toFixed(0)}%)`}
                          sx={{
                            backgroundColor: confidenceDisplay.color,
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </Tooltip>
                    ) : null;
                  })()}
                </Box>
              </Box>
              
              {/* Action Buttons */}
              <Box display="flex" gap={1}>
                <Tooltip title="Прихвати предлог">
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<AcceptIcon />}
                    onClick={handleAcceptSuggestion}
                    disabled={currentCategoryId === prediction.category}
                  >
                    {currentCategoryId === prediction.category ? 'Изабрано' : 'Прихвати'}
                  </Button>
                </Tooltip>
              </Box>
            </Box>

            {/* Suggested Keywords */}
            {prediction.features.suggestedKeywords.length > 0 && (
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Предложени тагови:
                </Typography>
                <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                  {prediction.features.suggestedKeywords.map((keyword, index) => (
                    <Chip
                      key={index}
                      label={keyword}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  ))}
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleAcceptKeywords}
                    sx={{ ml: 1 }}
                  >
                    Додај све
                  </Button>
                </Box>
              </Box>
            )}

            {/* Expanded Details */}
            <Collapse in={expanded}>
              <Divider sx={{ my: 2 }} />
              
              {/* Detection Info */}
              <Stack direction="row" spacing={3} mb={2}>
                <Box display="flex" alignItems="center">
                  <LanguageIcon sx={{ mr: 0.5, fontSize: '1rem', color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {getLanguageDisplay()?.label}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <TimeIcon sx={{ mr: 0.5, fontSize: '1rem', color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {prediction.processingTime}ms
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <BrainIcon sx={{ mr: 0.5, fontSize: '1rem', color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {prediction.features.keywordCount} кључних речи
                  </Typography>
                </Box>
              </Stack>

              {/* Alternative Predictions */}
              {prediction.allPredictions.length > 1 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Алтернативни предлози:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {prediction.allPredictions.slice(1, 4).map((alt, index) => (
                      <Tooltip 
                        key={index}
                        title={`Сигурност: ${(alt.confidence * 100).toFixed(1)}%`}
                      >
                        <Chip
                          label={`${alt.categoryDisplayName} (${(alt.confidence * 100).toFixed(0)}%)`}
                          size="small"
                          variant="outlined"
                          color="secondary"
                          onClick={() => onSuggestionAccept(alt.category)}
                          clickable
                        />
                      </Tooltip>
                    ))}
                  </Stack>
                </Box>
              )}
            </Collapse>
          </Box>
        )}

        {/* Help Text */}
        {!prediction && !loading && !error && (title.length >= 3 && description.length >= 10) && (
          <Alert severity="info" sx={{ mt: 1 }}>
            <Typography variant="body2">
              AI ће анализирати ваш тикет и предложити најподеснију категорију на основу наслова и описа.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AICategorization; 