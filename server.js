const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const rankingsRoutes = require('./routes/rankings');
const serverRoutes = require('./routes/server');
const playersRoutes = require('./routes/players');
const newsRoutes = require('./routes/news');
const userRoutes = require('./routes/user');
const guildsRoutes = require('./routes/guilds');
const downloadsRoutes = require('./routes/downloads');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/server', serverRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/guilds', guildsRoutes);
app.use('/api/downloads', downloadsRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    const db = require('./config/database');
    const connection = await db.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
  }

  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: dbStatus,
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 MU Online API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 CORS Origin: ${process.env.CORS_ORIGIN}`);
});
