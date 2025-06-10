import express from 'express';

const app = express();
const PORT = 5000;

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PIO Help Desk Test Server је активан',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
}); 