require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const modesRoutes = require('./routes/modes');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Security & Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://shriiyyaa.github.io', 'http://localhost:3000', 'app://.' , 'null'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // large for base64 screenshots

// Global rate limiter - 300 reqs per 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests. Please wait a moment.' }
});
app.use(globalLimiter);

// Stricter AI limiter - 100 AI calls per 24h per user (generous for free)
const aiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Daily AI limit reached. Upgrade or try again tomorrow.' }
});

// Health Check
app.get('/', (req, res) => {
  res.json({
    service: 'Intruely Backend API',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/ai', aiLimiter, aiRoutes);
app.use('/modes', modesRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Init DB then Start Server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Intruely Backend running on port ${PORT}`);
    console.log(`🌐 Endpoints: /auth | /ai | /modes`);
    console.log(`💚 Health: http://localhost:${PORT}/health\n`);
  });
}).catch(err => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});

module.exports = app;
