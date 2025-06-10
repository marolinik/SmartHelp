import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Link,
  Fade,
  Grid,
  Card,
  CardContent,
  Alert,
  Button
} from '@mui/material';
import {
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  Lightbulb as TipIcon,
  ContactSupport as SupportIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import QuickLinksSection from '../../components/Portal/QuickLinksSection';

const PortalQuickLinksPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showTip, setShowTip] = useState(true);

  const handleCreateTicket = (prefillData: any) => {
    // Navigate to ticket creation with prefilled data
    const params = new URLSearchParams();
    Object.entries(prefillData).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        params.set(key, value.join(','));
      } else {
        params.set(key, String(value));
      }
    });
    navigate(`/portal/ticket/new?${params.toString()}`);
  };

  const tips = [
    "Пре креирања тикета, проверите базу знања - можда већ постоји решење за ваш проблем.",
    "Што детаљније опишете проблем, то ће решење бити брже и ефикасније.",
    "За хитне проблеме који блокирају рад, користите контакт телефон директно.",
    "Редовно проверавајте статус ваших тикета да будете у току са напретком."
  ];

  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs
        aria-label="breadcrumb"
        separator={<NavigateNextIcon fontSize="small" />}
        sx={{ mb: 3 }}
      >
        <Link
          color="inherit"
          href="/portal"
          onClick={(e) => {
            e.preventDefault();
            navigate('/portal');
          }}
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          {t('selfService.nav.portal')}
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          {t('selfService.quickLinks.title')}
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          {t('selfService.quickLinks.title')}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3, maxWidth: '800px' }}>
          {t('selfService.quickLinks.subtitle')}
        </Typography>

        {/* Helpful Tip */}
        {showTip && (
          <Fade in timeout={1000}>
            <Alert
              severity="info"
              icon={<TipIcon />}
              onClose={() => setShowTip(false)}
              sx={{ mb: 3 }}
            >
              <strong>Савет дана:</strong> {randomTip}
            </Alert>
          </Fade>
        )}
      </Box>

      {/* Quick Links Section */}
      <QuickLinksSection onCreateTicket={handleCreateTicket} />

      {/* Additional Help Section */}
      <Box sx={{ mt: 6 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SupportIcon sx={{ color: 'primary.main', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Додатна помоћ
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Не можете да пронађете оно што тражите? Ове опције могу да вам помогну:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate('/portal/knowledge-base')}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    🔍 Претражи базу знања
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate('/portal/tickets')}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    📋 Провери постојеће тикете
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate('/portal/ticket/new')}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    ➕ Креирај обичан тикет
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Радно време ИТ подршке
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Наш тим је доступан у следећим терминима:
                </Typography>
                <Box sx={{ '& > div': { mb: 1 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Понедељак - Петак:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>08:00 - 17:00</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Субота:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>09:00 - 13:00</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Недеља:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Затворено</Typography>
                  </Box>
                </Box>
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    Ван радног времена, тикети се обрађују следећег радног дана
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default PortalQuickLinksPage; 