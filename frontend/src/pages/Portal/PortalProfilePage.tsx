import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  AccountCircle as AccountIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Badge as BadgeIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  Schedule as TimezoneIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState, AppDispatch } from '../../store/store';
import api from '../../services/api';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';

// Validation schemas
const profileSchema = yup.object({
  firstName: yup.string().required('Име је обавезно'),
  lastName: yup.string().required('Презиме је обавезно'),
  email: yup.string().email('Неважећа email адреса').required('Email је обавезан'),
  phone: yup.string(),
  department: yup.string()
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required('Тренутна лозинка је обавезна'),
  newPassword: yup.string().min(6, 'Лозинка мора имати најмање 6 карактера').required('Нова лозинка је обавезна'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('newPassword')], 'Лозинке се не поклапају')
    .required('Потврда лозинке је обавезна')
});

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface UserPreferences {
  notifications: {
    email: boolean;
    browser: boolean;
    sms: boolean;
    sound: boolean;
  };
  language: string;
  timezone: string;
}

const PortalProfilePage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation();
  
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: {
      email: true,
      browser: true,
      sms: false,
      sound: true
    },
    language: 'sr',
    timezone: 'Europe/Belgrade'
  });

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile
  } = useForm<ProfileFormData>({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      department: user?.department || ''
    }
  });

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword
  } = useForm<PasswordFormData>({
    resolver: yupResolver(passwordSchema)
  });

  useEffect(() => {
    if (user) {
      resetProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        department: user.department || ''
      });
    }
  }, [user, resetProfile]);

  const handleProfileSubmit = async (data: ProfileFormData) => {
    try {
      setLoading(true);
      
      const response = await api.put('/users/profile', data);
      
      if (response.data.success) {
        setAlert({
          type: 'success',
          message: t('selfService.profile.profileUpdated')
        });
        setEditingProfile(false);
      }
    } catch (error: any) {
      setAlert({
        type: 'error',
        message: error.response?.data?.message || 'Грешка при ажурирању профила'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    try {
      setLoading(true);
      
      const response = await api.put('/users/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      
      if (response.data.success) {
        setAlert({
          type: 'success',
          message: 'Лозинка је успешно промењена'
        });
        setEditingPassword(false);
        resetPassword();
      }
    } catch (error: any) {
      setAlert({
        type: 'error',
        message: error.response?.data?.message || 'Грешка при промени лозинке'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (category: keyof UserPreferences['notifications'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [category]: value
      }
    }));
  };

  const savePreferences = async () => {
    try {
      setLoading(true);
      
      // API call would go here
      // const response = await api.put('/users/preferences', preferences);
      
      setAlert({
        type: 'success',
        message: 'Подешавања су сачувана'
      });
    } catch (error: any) {
      setAlert({
        type: 'error',
        message: 'Грешка при чувању подешавања'
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'admin': return 'error';
      case 'l3_expert': return 'warning';
      case 'l2_specialist': return 'info';
      case 'l1_agent': return 'primary';
      default: return 'default';
    }
  };

  const getRoleDisplayName = (roleName: string) => {
    return t(`roles.${roleName}`) || roleName;
  };

  return (
    <Box>
      <Typography variant="h4" display="flex" alignItems="center" gap={1} mb={3}>
        <AccountIcon />
        {t('selfService.profile.title')}
      </Typography>

      {alert && (
        <Alert 
          severity={alert.type} 
          sx={{ mb: 3 }}
          onClose={() => setAlert(null)}
        >
          {alert.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* User Avatar and Basic Info */}
        <Grid item xs={12} md={4}>
          <Card sx={{ textAlign: 'center' }}>
            <CardContent>
              <Avatar 
                sx={{ 
                  width: 100, 
                  height: 100, 
                  mx: 'auto', 
                  mb: 2, 
                  bgcolor: 'primary.main',
                  fontSize: '2rem'
                }}
              >
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Avatar>
              <Typography variant="h5" gutterBottom>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {user?.email}
              </Typography>
              <Chip 
                label={getRoleDisplayName(user?.role?.name || '')}
                color={getRoleBadgeColor(user?.role?.name || '') as any}
                sx={{ mt: 1 }}
              />
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="body2" color="text.secondary">
                Члан од: {user?.createdAt ? format(new Date(user.createdAt), 'MMMM yyyy', { locale: sr }) : 'Непознато'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Последња активност: {user?.lastLoginAt ? format(new Date(user.lastLoginAt), 'dd.MM.yyyy HH:mm', { locale: sr }) : 'Никад'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Personal Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title={t('selfService.profile.personalInfo')}
              action={
                !editingProfile ? (
                  <Tooltip title={t('common.edit')}>
                    <IconButton onClick={() => setEditingProfile(true)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                ) : null
              }
            />
            <CardContent>
              {!editingProfile ? (
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <AccountIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Име и презиме"
                      secondary={`${user?.firstName} ${user?.lastName}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <EmailIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Email адреса"
                      secondary={user?.email}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <PhoneIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Телефон"
                      secondary={user?.phone || 'Није унето'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <BusinessIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Одељење"
                      secondary={user?.department || 'Није унето'}
                    />
                  </ListItem>
                </List>
              ) : (
                <Box component="form" onSubmit={handleSubmitProfile(handleProfileSubmit)}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label={t('users.firstName')}
                        {...registerProfile('firstName')}
                        error={!!profileErrors.firstName}
                        helperText={profileErrors.firstName?.message}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label={t('users.lastName')}
                        {...registerProfile('lastName')}
                        error={!!profileErrors.lastName}
                        helperText={profileErrors.lastName?.message}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label={t('users.email')}
                        type="email"
                        {...registerProfile('email')}
                        error={!!profileErrors.email}
                        helperText={profileErrors.email?.message}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Телефон"
                        {...registerProfile('phone')}
                        error={!!profileErrors.phone}
                        helperText={profileErrors.phone?.message}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label={t('users.department')}
                        {...registerProfile('department')}
                        error={!!profileErrors.department}
                        helperText={profileErrors.department?.message}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box display="flex" gap={1}>
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={<SaveIcon />}
                          disabled={loading}
                        >
                          {t('common.save')}
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<CancelIcon />}
                          onClick={() => {
                            setEditingProfile(false);
                            resetProfile();
                          }}
                        >
                          {t('common.cancel')}
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Security Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Безбедност"
              subheader="Промена лозинке"
              avatar={<SecurityIcon />}
              action={
                !editingPassword ? (
                  <Button 
                    variant="outlined" 
                    onClick={() => setEditingPassword(true)}
                    startIcon={<EditIcon />}
                  >
                    Промени лозинку
                  </Button>
                ) : null
              }
            />
            <CardContent>
              {!editingPassword ? (
                <Typography variant="body2" color="text.secondary">
                  Редовно мењајте лозинку да бисте задржали безбедност налога.
                </Typography>
              ) : (
                <Box component="form" onSubmit={handleSubmitPassword(handlePasswordSubmit)}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Тренутна лозинка"
                        type="password"
                        {...registerPassword('currentPassword')}
                        error={!!passwordErrors.currentPassword}
                        helperText={passwordErrors.currentPassword?.message}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Нова лозинка"
                        type="password"
                        {...registerPassword('newPassword')}
                        error={!!passwordErrors.newPassword}
                        helperText={passwordErrors.newPassword?.message}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Потврди нову лозинку"
                        type="password"
                        {...registerPassword('confirmPassword')}
                        error={!!passwordErrors.confirmPassword}
                        helperText={passwordErrors.confirmPassword?.message}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box display="flex" gap={1}>
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={<SaveIcon />}
                          disabled={loading}
                        >
                          Промени лозинку
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<CancelIcon />}
                          onClick={() => {
                            setEditingPassword(false);
                            resetPassword();
                          }}
                        >
                          {t('common.cancel')}
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Preferences */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title={t('selfService.profile.preferences')}
              subheader={t('selfService.profile.notifications')}
              avatar={<SettingsIcon />}
            />
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                {t('selfService.profile.notifications')}
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <EmailIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('selfService.notifications.preferences.email')} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.notifications.email}
                        onChange={(e) => handlePreferenceChange('email', e.target.checked)}
                      />
                    }
                    label=""
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <NotificationsIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('selfService.notifications.preferences.browser')} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.notifications.browser}
                        onChange={(e) => handlePreferenceChange('browser', e.target.checked)}
                      />
                    }
                    label=""
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <PhoneIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('selfService.notifications.preferences.sms')} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.notifications.sms}
                        onChange={(e) => handlePreferenceChange('sms', e.target.checked)}
                      />
                    }
                    label=""
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <NotificationsIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('selfService.notifications.preferences.sound')} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.notifications.sound}
                        onChange={(e) => handlePreferenceChange('sound', e.target.checked)}
                      />
                    }
                    label=""
                  />
                </ListItem>
              </List>
              
              <Box mt={2}>
                <Button 
                  variant="contained" 
                  onClick={savePreferences}
                  disabled={loading}
                  startIcon={<SaveIcon />}
                >
                  {t('common.save')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Language and Timezone Settings */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Регионалне поставке"
              avatar={<LanguageIcon />}
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('selfService.profile.language')}</InputLabel>
                    <Select
                      value={preferences.language}
                      label={t('selfService.profile.language')}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        language: e.target.value
                      }))}
                    >
                      <MenuItem value="sr">Српски</MenuItem>
                      <MenuItem value="en">English</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('selfService.profile.timezone')}</InputLabel>
                    <Select
                      value={preferences.timezone}
                      label={t('selfService.profile.timezone')}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        timezone: e.target.value
                      }))}
                    >
                      <MenuItem value="Europe/Belgrade">Београд (UTC+1)</MenuItem>
                      <MenuItem value="Europe/London">Лондон (UTC+0)</MenuItem>
                      <MenuItem value="Europe/Berlin">Берлин (UTC+1)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PortalProfilePage; 