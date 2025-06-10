import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Avatar,
  useTheme,
  Paper,
  Divider,
  Stack
} from '@mui/material';
import {
  VpnKey as PasswordIcon,
  GetApp as SoftwareIcon,
  Computer as HardwareIcon,
  Wifi as NetworkIcon,
  Security as SecurityIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Print as PrinterIcon,
  Storage as BackupIcon,
  Help as HelpIcon,
  AccountCircle as AccountIcon,
  Assignment as RequestIcon,
  BugReport as IssueIcon,
  SystemUpdate as UpdateIcon,
  SettingsApplications as ConfigIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface QuickLink {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  priority: 'low' | 'medium' | 'high';
  estimatedTime: string;
  color: string;
  prefillData?: {
    category?: string;
    priority?: string;
    tags?: string[];
    subject?: string;
    description?: string;
  };
}

interface QuickLinksSectionProps {
  onCreateTicket?: (prefillData: any) => void;
}

const QuickLinksSection: React.FC<QuickLinksSectionProps> = ({ onCreateTicket }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const quickLinks: QuickLink[] = [
    {
      id: 'password-reset',
      title: t('selfService.quickLinks.passwordReset.title'),
      description: t('selfService.quickLinks.passwordReset.description'),
      icon: <PasswordIcon />,
      category: t('selfService.quickLinks.categories.security'),
      priority: 'high',
      estimatedTime: '15-30 мин',
      color: '#f44336',
      prefillData: {
        category: 'security',
        priority: 'high',
        tags: ['password', 'reset', 'account'],
        subject: 'Захтев за ресетовање лозинке',
        description: 'Молим вас да ми помогнете са ресетовањем лозинке за мој корисничи налог.'
      }
    },
    {
      id: 'software-request',
      title: t('selfService.quickLinks.softwareRequest.title'),
      description: t('selfService.quickLinks.softwareRequest.description'),
      icon: <SoftwareIcon />,
      category: t('selfService.quickLinks.categories.software'),
      priority: 'medium',
      estimatedTime: '1-3 дана',
      color: '#2196f3',
      prefillData: {
        category: 'software',
        priority: 'medium',
        tags: ['software', 'installation', 'license'],
        subject: 'Захтев за инсталацију софтвера',
        description: 'Потребна ми је инсталација новог софтвера за рад. Молим вас да наведете који софтвер вам је потребан и за које намене.'
      }
    },
    {
      id: 'hardware-issue',
      title: t('selfService.quickLinks.hardwareIssue.title'),
      description: t('selfService.quickLinks.hardwareIssue.description'),
      icon: <HardwareIcon />,
      category: t('selfService.quickLinks.categories.hardware'),
      priority: 'high',
      estimatedTime: '2-4 сата',
      color: '#ff9800',
      prefillData: {
        category: 'hardware',
        priority: 'high',
        tags: ['hardware', 'malfunction', 'repair'],
        subject: 'Проблем са хардвером',
        description: 'Имам проблем са хардвером који утиче на мој рад. Молим вас опишите проблем детаљније.'
      }
    },
    {
      id: 'network-access',
      title: t('selfService.quickLinks.networkAccess.title'),
      description: t('selfService.quickLinks.networkAccess.description'),
      icon: <NetworkIcon />,
      category: t('selfService.quickLinks.categories.network'),
      priority: 'high',
      estimatedTime: '30-60 мин',
      color: '#4caf50',
      prefillData: {
        category: 'network',
        priority: 'high',
        tags: ['network', 'access', 'connectivity'],
        subject: 'Проблем са приступом мрежи',
        description: 'Имам проблем са приступом интернету или интерној мрежи компаније.'
      }
    },
    {
      id: 'email-setup',
      title: t('selfService.quickLinks.emailSetup.title'),
      description: t('selfService.quickLinks.emailSetup.description'),
      icon: <EmailIcon />,
      category: t('selfService.quickLinks.categories.communication'),
      priority: 'medium',
      estimatedTime: '20-45 мин',
      color: '#9c27b0',
      prefillData: {
        category: 'email',
        priority: 'medium',
        tags: ['email', 'setup', 'configuration'],
        subject: 'Подешавање email налога',
        description: 'Потребна ми је помоћ око подешавања email налога на новом уређају или апликацији.'
      }
    },
    {
      id: 'printer-issue',
      title: t('selfService.quickLinks.printerIssue.title'),
      description: t('selfService.quickLinks.printerIssue.description'),
      icon: <PrinterIcon />,
      category: t('selfService.quickLinks.categories.office'),
      priority: 'medium',
      estimatedTime: '15-30 мин',
      color: '#607d8b',
      prefillData: {
        category: 'office',
        priority: 'medium',
        tags: ['printer', 'printing', 'paper'],
        subject: 'Проблем са штампачем',
        description: 'Имам проблем са штампањем докумената. Штампач не ради како треба.'
      }
    },
    {
      id: 'data-backup',
      title: t('selfService.quickLinks.dataBackup.title'),
      description: t('selfService.quickLinks.dataBackup.description'),
      icon: <BackupIcon />,
      category: t('selfService.quickLinks.categories.data'),
      priority: 'medium',
      estimatedTime: '1-2 сата',
      color: '#795548',
      prefillData: {
        category: 'data',
        priority: 'medium',
        tags: ['backup', 'data', 'recovery'],
        subject: 'Захтев за backup података',
        description: 'Потребан ми је backup важних података или помоћ око обнављања података из backup-а.'
      }
    },
    {
      id: 'account-access',
      title: t('selfService.quickLinks.accountAccess.title'),
      description: t('selfService.quickLinks.accountAccess.description'),
      icon: <AccountIcon />,
      category: t('selfService.quickLinks.categories.security'),
      priority: 'high',
      estimatedTime: '15-45 мин',
      color: '#3f51b5',
      prefillData: {
        category: 'security',
        priority: 'high',
        tags: ['account', 'access', 'permissions'],
        subject: 'Проблем са приступом налогу',
        description: 'Не могу да приступим свом корисничком налогу или немам одговарајуће дозволе.'
      }
    }
  ];

  const categories = Array.from(new Set(quickLinks.map(link => link.category)));

  const handleQuickLinkClick = (link: QuickLink) => {
    if (onCreateTicket && link.prefillData) {
      onCreateTicket(link.prefillData);
    } else {
      // Navigate to ticket creation with prefilled data
      const params = new URLSearchParams();
      if (link.prefillData) {
        Object.entries(link.prefillData).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            params.set(key, value.join(','));
          } else {
            params.set(key, String(value));
          }
        });
      }
      navigate(`/portal/ticket/new?${params.toString()}`);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        {t('selfService.quickLinks.title')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t('selfService.quickLinks.subtitle')}
      </Typography>

      {categories.map((category) => {
        const categoryLinks = quickLinks.filter(link => link.category === category);
        
        return (
          <Box key={category} sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 500 }}>
              {category}
            </Typography>
            <Grid container spacing={2}>
              {categoryLinks.map((link) => (
                <Grid item xs={12} sm={6} md={4} key={link.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: theme.shadows[4],
                      }
                    }}
                  >
                    <CardActionArea 
                      onClick={() => handleQuickLinkClick(link)}
                      sx={{ height: '100%', p: 0 }}
                    >
                      <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                          <Avatar 
                            sx={{ 
                              bgcolor: link.color, 
                              mr: 2,
                              width: 48,
                              height: 48
                            }}
                          >
                            {link.icon}
                          </Avatar>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {link.title}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                              <Chip 
                                label={link.priority === 'high' ? 'Висок' : link.priority === 'medium' ? 'Средњи' : 'Низак'}
                                size="small"
                                sx={{ 
                                  bgcolor: getPriorityColor(link.priority),
                                  color: 'white',
                                  fontWeight: 500,
                                  fontSize: '0.75rem'
                                }}
                              />
                              <Chip 
                                label={link.estimatedTime}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.75rem' }}
                              />
                            </Stack>
                          </Box>
                        </Box>
                        
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            flexGrow: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.4
                          }}
                        >
                          {link.description}
                        </Typography>

                        <Divider sx={{ my: 2 }} />
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            Кликните за брзо креирање тикета
                          </Typography>
                          <RequestIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}

      {/* Emergency Contact Section */}
      <Paper sx={{ p: 3, mt: 4, bgcolor: 'error.50', border: `1px solid ${theme.palette.error.light}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <PhoneIcon sx={{ color: 'error.main', mr: 1 }} />
          <Typography variant="h6" color="error.main" sx={{ fontWeight: 600 }}>
            {t('selfService.quickLinks.emergency.title')}
          </Typography>
        </Box>
        <Typography variant="body2" color="error.dark" sx={{ mb: 2 }}>
          {t('selfService.quickLinks.emergency.description')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Chip 
            label="📞 +381 11 123 4567"
            sx={{ bgcolor: 'error.main', color: 'white', fontWeight: 500 }}
          />
          <Chip 
            label="📧 hitna.podrska@pio.rs"
            sx={{ bgcolor: 'error.main', color: 'white', fontWeight: 500 }}
          />
        </Stack>
      </Paper>
    </Box>
  );
};

export default QuickLinksSection; 