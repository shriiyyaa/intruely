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
// Allow Desktop Electron app & Web clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '15mb' }));

// Health Check Endpoints (Exempt from Rate Limiting)
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

// Global Rate Limiter (300 requests per 15 min per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Rate limit exceeded. Please wait a moment.' }
});
app.use(globalLimiter);

// AI Endpoint Rate Limiter (300 requests per 15 min)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => req.ip,
  message: { error: 'AI limit reached for this IP. Please wait a few minutes.' }
});

// Route Mounting
app.use('/auth', authRoutes);
app.use('/ai', aiLimiter, aiRoutes);
app.use('/modes', modesRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// Global Error Middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Server Initialization — skip in test environment (Supertest binds its own port)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🚀 Intruely Server listening on port ${PORT}`);
    console.log(`💚 Health Check: http://localhost:${PORT}/health\n`);

    if (process.env.DATABASE_URL) {
      initDB().catch(err => console.warn('⚠️ Database connection warning:', err.message));
    } else {
      console.log('ℹ️ Operating in Stateless AI Proxy mode (DATABASE_URL not set)');
    }
  });
}

module.exports = app;

