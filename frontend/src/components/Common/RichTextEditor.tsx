import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { 
  Box, 
  Alert, 
  CircularProgress, 
  IconButton, 
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Menu,
  MenuItem
} from '@mui/material';
import { 
  ImageOutlined as ImageIcon,
  CloudUpload as UploadIcon,
  Link as LinkIcon,
  FormatBoldOutlined as BoldIcon,
  FormatItalicOutlined as ItalicIcon,
  FormatUnderlinedOutlined as UnderlineIcon,
  Spellcheck as SpellCheckIcon,
  Add as AddIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import api from '../../services/api';
import imageUploadService from '../../services/imageUploadService';
import serbianSpellChecker, { SpellCheckError } from '../../services/serbianSpellChecker';

// Српске транслације за Quill toolbar
const SERBIAN_TOOLBAR_LABELS = {
  // Формати
  'bold': 'Подебљано (Ctrl+B)',
  'italic': 'Курзив (Ctrl+I)', 
  'underline': 'Подвучено (Ctrl+U)',
  'strike': 'Прецртано',
  'blockquote': 'Цитат',
  'code-block': 'Код блок',
  
  // Заглавља
  'header': 'Заглавље',
  'header 1': 'Заглавље 1',
  'header 2': 'Заглавље 2',
  'header 3': 'Заглавље 3',
  'header 4': 'Заглавље 4',
  'header 5': 'Заглавље 5',
  'header 6': 'Заглавље 6',
  
  // Листе
  'list ordered': 'Нумерисана листа',
  'list bullet': 'Ненумерисана листа',
  'indent +1': 'Увуци',
  'indent -1': 'Извуци',
  
  // Алајнмент
  'align': 'Поравнај',
  'align left': 'Лево',
  'align center': 'Центар',
  'align right': 'Десно',
  'align justify': 'Обострано',
  
  // Обојаност
  'color': 'Боја текста',
  'background': 'Боја позадине',
  
  // Остало
  'link': 'Линк',
  'image': 'Слика',
  'video': 'Видео',
  'clean': 'Уклоni форматирање',
  'size': 'Величина фонта',
  'font': 'Фонт'
};

// Konfiguracija toolbar-a sa srpskim labelima
const TOOLBAR_CONFIG = {
  toolbar: {
    container: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'align': [] }],
      ['link', 'image', 'video'],
      ['clean']
    ],
    handlers: {
      // Custom image handler ће бити додан касније
    }
  },
  clipboard: {
    matchVisual: false
  }
};

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  maxLength?: number;
  error?: string;
  helperText?: string;
  allowImageUpload?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
  height?: number;
  enableSpellCheck?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Почните писање...',
  readOnly = false,
  maxLength,
  error,
  helperText,
  allowImageUpload = true,
  onImageUpload = imageUploadService.uploadKnowledgeBaseImage,
  height = 300,
  enableSpellCheck = true
}) => {
  const quillRef = useRef<ReactQuill>(null);
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [spellErrors, setSpellErrors] = useState<SpellCheckError[]>([]);
  const [spellCheckDialogOpen, setSpellCheckDialogOpen] = useState(false);
  const [currentError, setCurrentError] = useState<SpellCheckError | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    error: SpellCheckError;
  } | null>(null);

  // Configuracija modula sa custom image handler-om
  const modules = useMemo(() => ({
    ...TOOLBAR_CONFIG,
    toolbar: {
      ...TOOLBAR_CONFIG.toolbar,
      handlers: {
        image: allowImageUpload ? handleImageUpload : undefined,
        link: handleLinkInsert
      }
    }
  }), [allowImageUpload]);

  // Формати које подржава editor
  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'blockquote', 'code-block',
    'list', 'bullet', 'indent',
    'direction', 'align',
    'link', 'image', 'video'
  ];

  // Apliciranje srpskih labela na toolbar
  useEffect(() => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const toolbar = quill.getModule('toolbar');
      
      if (toolbar && toolbar.container) {
        // Dodavanje srpskih tooltip-ova
        Object.entries(SERBIAN_TOOLBAR_LABELS).forEach(([key, label]) => {
          const buttons = toolbar.container.querySelectorAll(
            `button[class*="${key}"], .ql-${key.replace(' ', '-')}`
          );
          
          buttons.forEach((button: HTMLElement, index: number) => {
            button.setAttribute('title', label);
            button.setAttribute('aria-label', label);
          });
        });

        // Специјално за header dropdown
        const headerSelect = toolbar.container.querySelector('.ql-header');
        if (headerSelect) {
          headerSelect.setAttribute('title', 'Изабери заглавље');
          const options = headerSelect.querySelectorAll('option');
          options.forEach((option: HTMLOptionElement, index: number) => {
            if (index === 0) option.textContent = 'Нормални текст';
            else option.textContent = `Заглавље ${index}`;
          });
        }

        // Специјално за list dropdown
        const listSelect = toolbar.container.querySelector('.ql-list');
        if (listSelect) {
          listSelect.setAttribute('title', 'Изабери тип листе');
        }

        // Специјално за align dropdown
        const alignSelect = toolbar.container.querySelector('.ql-align');
        if (alignSelect) {
          alignSelect.setAttribute('title', 'Поравнај текст');
        }
      }
    }
  }, []);

  // Учитај кориснички речник при иницијализацији
  useEffect(() => {
    if (enableSpellCheck) {
      serbianSpellChecker.loadUserDictionary();
    }
  }, [enableSpellCheck]);

  // Провери правопис када се промени садржај
  useEffect(() => {
    if (enableSpellCheck && value) {
      const timeoutId = setTimeout(() => {
        checkSpelling();
      }, 1000); // Debounce од 1 секунде

      return () => clearTimeout(timeoutId);
    }
  }, [value, enableSpellCheck]);

  // Провери правопис
  const checkSpelling = useCallback(() => {
    if (!enableSpellCheck || !value) {
      setSpellErrors([]);
      return;
    }

    // Извуци чист текст из HTML-а
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = value;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    const errors = serbianSpellChecker.checkText(plainText);
    setSpellErrors(errors);

    // Подвуци грешке у едитору
    highlightSpellingErrors(errors);
  }, [value, enableSpellCheck]);

  // Подвуци грешке у едитору
  const highlightSpellingErrors = (errors: SpellCheckError[]) => {
    if (!quillRef.current) return;

    const quill = quillRef.current.getEditor();
    
    // Уклони претходне подвлаке
    quill.removeFormat(0, quill.getLength(), 'silent');

    // Додај нове подвлаке
    errors.forEach(error => {
      quill.formatText(error.start, error.end - error.start, {
        'background': '#ffebee',
        'border-bottom': '2px wavy #f44336'
      }, 'silent');
    });
  };

  // Обради клик на грешку
  const handleSpellErrorClick = (event: React.MouseEvent, error: SpellCheckError) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      error
    });
  };

  // Затвори контекстни мени
  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  // Примени предлог исправке
  const applySuggestion = (suggestion: string) => {
    if (!contextMenu) return;

    const { error } = contextMenu;
    const newValue = value.substring(0, error.start) + 
                    suggestion + 
                    value.substring(error.end);
    
    onChange(newValue);
    handleContextMenuClose();
  };

  // Додај реч у речник
  const addToUserDictionary = (word: string) => {
    serbianSpellChecker.addToUserDictionary(word);
    checkSpelling(); // Поново провери правопис
    handleContextMenuClose();
  };

  // Отвори дијалог за проверу правописа
  const openSpellCheckDialog = () => {
    checkSpelling();
    setSpellCheckDialogOpen(true);
  };

  // Затвори дијалог за проверу правописа
  const closeSpellCheckDialog = () => {
    setSpellCheckDialogOpen(false);
    setCurrentError(null);
  };

  // Handler za upload slike
  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          const imageUrl = await onImageUpload(file);
          
          if (quillRef.current) {
            const quill = quillRef.current.getEditor();
            const range = quill.getSelection();
            quill.insertEmbed(range?.index || 0, 'image', imageUrl);
          }
        } catch (error) {
          console.error('Грешка при upload-у слике:', error);
        }
      }
    };
  }, [onImageUpload]);

  // Handler za dodavanje linka
  const handleLinkInsert = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const selection = quill.getSelection();
    if (selection && selection.length > 0) {
      setLinkText(quill.getText(selection.index, selection.length));
    }
    setLinkDialogOpen(true);
  };

  // Потврђивање додавања линка
  const handleLinkConfirm = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill || !linkUrl.trim()) return;

    const selection = quill.getSelection();
    if (selection) {
      if (linkText.trim()) {
        // Ако има текста, заменити селекцију
        quill.deleteText(selection.index, selection.length);
        quill.insertText(selection.index, linkText, 'link', linkUrl);
      } else {
        // Ако нема текста, само додати линк
        quill.insertText(selection.index, linkUrl, 'link', linkUrl);
      }
    }

    // Ресетовање
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
  };

  // Handler za промену садржаја
  const handleChange = (content: string) => {
    // Провера максималне дужине
    if (maxLength) {
      const quill = quillRef.current?.getEditor();
      if (quill && quill.getLength() > maxLength) {
        return; // Не дозволи промену ако је превише карактера
      }
    }
    
    onChange(content);
  };

  return (
    <Box>
      {/* Upload progress indicator */}
      {uploading && (
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <CircularProgress size={20} />
          <span>Upload слике у току...</span>
        </Box>
      )}

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Toolbar за проверу правописа */}
      {enableSpellCheck && !readOnly && (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Провери правопис">
              <IconButton onClick={openSpellCheckDialog} size="small">
                <SpellCheckIcon />
              </IconButton>
            </Tooltip>
            
            {spellErrors.length > 0 && (
              <Chip 
                label={`${spellErrors.length} грешака`}
                color="warning"
                size="small"
                onClick={openSpellCheckDialog}
              />
            )}
          </Box>
        </Box>
      )}

      {/* Main editor */}
      <Box
        sx={{
          border: error ? '1px solid #f44336' : '1px solid #ccc',
          borderRadius: 1,
          '& .ql-toolbar': {
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: '1px solid #ccc'
          },
          '& .ql-container': {
            border: 'none',
            fontSize: '14px',
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
          },
          '& .ql-editor': {
            minHeight: `${height}px`,
            padding: '12px 15px'
          },
          '& .ql-editor.ql-blank::before': {
            color: '#aaa',
            fontStyle: 'normal'
          }
        }}
      >
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={handleChange}
          readOnly={readOnly}
          placeholder={placeholder}
          modules={modules}
          formats={formats}
        />
      </Box>

      {/* Helper text or character count */}
      {(helperText || maxLength) && (
        <Box mt={1} display="flex" justifyContent="space-between" alignItems="center">
          {helperText && (
            <span style={{ fontSize: '0.75rem', color: '#666' }}>
              {helperText}
            </span>
          )}
          {maxLength && (
            <span style={{ fontSize: '0.75rem', color: '#666' }}>
              {quillRef.current?.getEditor()?.getLength() || 0} / {maxLength}
            </span>
          )}
        </Box>
      )}

      {/* Link dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Додај линк</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="URL адреса"
            type="url"
            fullWidth
            variant="outlined"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Текст линка (опционо)"
            type="text"
            fullWidth
            variant="outlined"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Оставите празно да користите URL као текст"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>
            Откажи
          </Button>
          <Button onClick={handleLinkConfirm} disabled={!linkUrl.trim()}>
            Додај линк
          </Button>
        </DialogActions>
      </Dialog>

      {/* Контекстни мени за грешке правописа */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {contextMenu?.error.suggestions.map((suggestion: string, index: number) => (
          <MenuItem 
            key={index} 
            onClick={() => applySuggestion(suggestion)}
          >
            <Typography variant="body2">
              {suggestion}
            </Typography>
          </MenuItem>
        ))}
        
        {contextMenu?.error.suggestions.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              Нема предлога
            </Typography>
          </MenuItem>
        )}
        
        <MenuItem onClick={() => addToUserDictionary(contextMenu!.error.word)}>
          <AddIcon fontSize="small" sx={{ mr: 1 }} />
          <Typography variant="body2">
            Додај у речник
          </Typography>
        </MenuItem>
      </Menu>

      {/* Дијалог за проверу правописа */}
      <Dialog 
        open={spellCheckDialogOpen} 
        onClose={closeSpellCheckDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Провера правописа
            </Typography>
            <IconButton onClick={closeSpellCheckDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {spellErrors.length === 0 ? (
            <Alert severity="success">
              Није пронађена ниједна грешка у правопису! 🎉
            </Alert>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Пронађено је {spellErrors.length} грешака у правопису:
              </Typography>
              
              <List>
                {spellErrors.map((error, index) => (
                  <ListItem key={index} divider>
                    <Box width="100%">
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle2" color="error">
                          "{error.word}"
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => addToUserDictionary(error.word)}
                        >
                          Додај у речник
                        </Button>
                      </Box>
                      
                      {error.suggestions.length > 0 ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Предлози:
                          </Typography>
                          <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                            {error.suggestions.map((suggestion, suggIndex) => (
                              <Chip
                                key={suggIndex}
                                label={suggestion}
                                size="small"
                                clickable
                                onClick={() => applySuggestion(suggestion)}
                                color="primary"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Нема предлога за исправку
                        </Typography>
                      )}
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={closeSpellCheckDialog}>
            Затвори
          </Button>
          <Button 
            variant="contained" 
            onClick={checkSpelling}
            startIcon={<SpellCheckIcon />}
          >
            Провери поново
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RichTextEditor; 