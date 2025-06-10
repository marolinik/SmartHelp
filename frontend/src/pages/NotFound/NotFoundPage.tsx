import React from 'react';
import { Typography, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ textAlign: 'center', mt: 8 }}>
      <Typography variant="h1" gutterBottom>
        404
      </Typography>
      <Typography variant="h4" gutterBottom>
        Страница није пронађена
      </Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard')}>
        Назад на почетну
      </Button>
    </Box>
  );
};

export default NotFoundPage; 