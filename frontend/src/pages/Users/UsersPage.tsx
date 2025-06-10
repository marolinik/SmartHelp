import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Tooltip,
  CircularProgress,
  Alert,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormHelperText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Support as SupportIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

// Types
interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const UsersPage: React.FC = (): JSX.Element => {
  const { user } = useSelector((state: RootState) => state.auth);
  
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    displayName: '',
    department: '',
    roleId: '',
    isActive: true,
    password: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check if current user is admin
  const isAdmin = user?.role?.name === 'admin' || user?.role?.permissions.includes('manage_users');

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter) params.append('roleId', roleFilter);
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Грешка при учитавању корисника');
      }

      const data: { success: boolean; data: UsersResponse } = await response.json();
      
      if (data.success) {
        setUsers(data.data.users);
        setTotalCount(data.data.pagination.total);
      } else {
        throw new Error('Неуспешан одговор сервера');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Непозната грешка');
    } finally {
      setLoading(false);
    }
  };

  // Fetch roles
  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/roles', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRoles(data.data);
        }
      }
    } catch (err) {
      console.error('Грешка при учитавању улога:', err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchRoles();
    }
  }, [page, rowsPerPage, searchTerm, roleFilter, statusFilter, isAdmin]);

  // Handlers
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = () => {
    setPage(0);
    fetchUsers();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(0);
  };

  // Dialog handlers
  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        department: user.department || '',
        roleId: user.role.id,
        isActive: user.isActive,
        password: ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        displayName: '',
        department: '',
        roleId: '',
        isActive: true,
        password: ''
      });
    }
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      displayName: '',
      department: '',
      roleId: '',
      isActive: true,
      password: ''
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = 'Корисничко име је обавезно';
    }
    if (!formData.email.trim()) {
      errors.email = 'Е-мејл је обавезан';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Неисправан формат е-мејла';
    }
    if (!formData.displayName.trim()) {
      errors.displayName = 'Име за приказ је обавезно';
    }
    if (!formData.roleId) {
      errors.roleId = 'Улога је обавезна';
    }
    if (!editingUser && !formData.password.trim()) {
      errors.password = 'Лозинка је обавезна за нове кориснике';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setDialogLoading(true);
      const token = localStorage.getItem('token');
      
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      let payload: any;
      if (editingUser && !formData.password) {
        const { password, ...payloadWithoutPassword } = formData;
        payload = payloadWithoutPassword;
      } else {
        payload = { ...formData };
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Грешка при чувању корисника');
      }

      handleCloseDialog();
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при чувању корисника');
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Да ли сте сигурни да желите да обришете овог корисника?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Грешка при брисању корисника');
      }

      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при брисању корисника');
    }
  };

  // Helper functions
  const getRoleIcon = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'admin':
        return <AdminIcon />;
      case 'agent':
        return <SupportIcon />;
      case 'user':
        return <PersonIcon />;
      default:
        return <AssignmentIcon />;
    }
  };

  const getRoleChip = (role: User['role']) => {
    const roleColors = {
      admin: 'error' as const,
      agent: 'primary' as const,
      user: 'default' as const,
    };

    return (
      <Chip
        icon={getRoleIcon(role.name)}
        label={role.name}
        color={roleColors[role.name.toLowerCase() as keyof typeof roleColors] || 'default'}
        size="small"
      />
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sr-RS', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdmin) {
    return (
      <Alert severity="error">
        Немате дозволу за приступ управљању корисницима.
      </Alert>
    );
  }

  if (loading && users.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Управљање корисницима
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Нови корисник
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Филтери
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Претрага"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Име, е-мејл, одељење..."
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={handleSearch}>
                      <SearchIcon />
                    </IconButton>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Улога</InputLabel>
                <Select
                  value={roleFilter}
                  label="Улога"
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <MenuItem value="">Све</MenuItem>
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={statusFilter}
                  label="Статус"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="">Сви</MenuItem>
                  <MenuItem value="active">Активни</MenuItem>
                  <MenuItem value="inactive">Неактивни</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                onClick={clearFilters}
                sx={{ mr: 1 }}
              >
                Обриши филтере
              </Button>
              <Button
                variant="contained"
                onClick={handleSearch}
              >
                Примени
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Корисник</TableCell>
                <TableCell>Е-мејл</TableCell>
                <TableCell>Улога</TableCell>
                <TableCell>Одељење</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Креирано</TableCell>
                <TableCell>Акције</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((userData) => (
                <TableRow key={userData.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar>
                        {userData.displayName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {userData.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{userData.username}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {userData.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getRoleChip(userData.role)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {userData.department || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={userData.isActive ? 'Активан' : 'Неактиван'}
                      color={userData.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(userData.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Уреди">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(userData)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    {userData.id !== user?.id && (
                      <Tooltip title="Обриши">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteUser(userData.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="textSecondary">
                      Нема корисника за приказ
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 20, 50]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Редова по страници:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} од ${count !== -1 ? count : `више од ${to}`}`
          }
        />
      </Paper>

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Уреди корисника' : 'Додај новог корисника'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Корисничко име"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                error={!!formErrors.username}
                helperText={formErrors.username}
                disabled={!!editingUser} // Username cannot be changed
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Е-мејл"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={!!formErrors.email}
                helperText={formErrors.email}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Име за приказ"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                error={!!formErrors.displayName}
                helperText={formErrors.displayName}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Одељење"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth error={!!formErrors.roleId}>
                <InputLabel>Улога</InputLabel>
                <Select
                  value={formData.roleId}
                  label="Улога"
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.roleId && (
                  <FormHelperText>{formErrors.roleId}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={editingUser ? 'Нова лозинка (опционо)' : 'Лозинка'}
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={!!formErrors.password}
                helperText={formErrors.password || (editingUser ? 'Оставите празно ако не желите да мењате лозинку' : '')}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={formData.isActive ? 'active' : 'inactive'}
                  label="Статус"
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                >
                  <MenuItem value="active">Активан</MenuItem>
                  <MenuItem value="inactive">Неактиван</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Откажи
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={dialogLoading}
          >
            {dialogLoading ? <CircularProgress size={20} /> : (editingUser ? 'Сачувај' : 'Додај')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage; 