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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
  Paper
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
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
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
    sla: boolean;
    assignments: boolean;
  };
  language: string;
  theme: string;
  timezone: string;
}

const ProfilePage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: {
      email: true,
      browser: true,
      sla: true,
      assignments: true
    },
    language: 'sr',
    theme: 'light',
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
          message: 'Профил је успешно ажуриран'
        });
        setEditingProfile(false);
        // Update user in Redux store
        // dispatch(updateUserProfile(response.data.data));
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
    const roles: { [key: string]: string } = {
      'admin': 'Администратор',
      'l3_expert': 'L3 Експерт',
      'l2_specialist': 'L2 Специјалиста', 
      'l1_agent': 'L1 Агент',
      'user': 'Корисник'
    };
    return roles[roleName] || roleName;
  };

  return (
    <Box>
      <Typography variant="h4" display="flex" alignItems="center" gap={1} mb={3}>
        <AccountIcon />
        Мој профил
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
        {/* Основни подаци */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="Основни подаци"
              action={
                !editingProfile ? (
                  <Tooltip title="Уреди профил">
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
                  <ListItem>
                    <ListItemIcon>
                      <BadgeIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Улога"
                      secondary={
                        <Chip 
                          label={getRoleDisplayName(user?.role?.name || '')}
                          color={getRoleBadgeColor(user?.role?.name || '') as any}
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                </List>
              ) : (
                <Box component="form" onSubmit={handleSubmitProfile(handleProfileSubmit)}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Име"
                        {...registerProfile('firstName')}
                        error={!!profileErrors.firstName}
                        helperText={profileErrors.firstName?.message}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Презиме"
                        {...registerProfile('lastName')}
                        error={!!profileErrors.lastName}
                        helperText={profileErrors.lastName?.message}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Email адреса"
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
                        label="Одељење"
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
                          Сачувај
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<CancelIcon />}
                          onClick={() => {
                            setEditingProfile(false);
                            resetProfile();
                          }}
                        >
                          Откажи
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Информације о кориснику */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Avatar>
              <Typography variant="h6">
                {user?.displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.username}
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

        {/* Промена лозинке */}
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
                          Откажи
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Подешавања нотификација */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Подешавања"
              subheader="Нотификације и преференце"
              avatar={<SettingsIcon />}
            />
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Нотификације
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <EmailIcon />
                  </ListItemIcon>
                  <ListItemText primary="Email нотификације" />
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
                  <ListItemText primary="Browser нотификације" />
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
                    <SecurityIcon />
                  </ListItemIcon>
                  <ListItemText primary="SLA упозорења" />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.notifications.sla}
                        onChange={(e) => handlePreferenceChange('sla', e.target.checked)}
                      />
                    }
                    label=""
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AccountIcon />
                  </ListItemIcon>
                  <ListItemText primary="Додељивање тикета" />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.notifications.assignments}
                        onChange={(e) => handlePreferenceChange('assignments', e.target.checked)}
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
                  Сачувај подешавања
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage; 