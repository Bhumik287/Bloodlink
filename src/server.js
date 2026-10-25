/**
 * BloodLink - Server Entry Point
 * Course Reference:
 * - Unit-1: 3-Tier Web Architecture
 * - Unit-3: Express Routing, Static Middleware, Request/Response handling
 * - Unit-4: MongoDB Native Driver Integration
 * - Unit-5: Session & Security Management
 */

const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const { connectDB, getDB, closeDB } = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route Modules (Unit 3)
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const donorRoutes = require('./routes/donorRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Support for Local Development & Live Server
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 1. Request Body Parsing Middleware (Unit 3)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Session Middleware (Unit 5)
// Enable proxy trust for cloud platforms (Render, Railway)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'bloodlink_default_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Local HTTP development
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  })
);

// 3. Static File Serving (Unit 3)
app.use(express.static(path.join(__dirname, '../public')));

// 4. API Health Check Endpoint
app.get('/api/health', async (req, res) => {
  try {
    const db = getDB();
    await db.command({ ping: 1 });
    res.json({
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
      database: 'connected (MongoDB)',
      course: 'Full Stack Development (3CS524CC26)'
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'degraded',
      database: 'disconnected',
      error: err.message
    });
  }
});

// 5. Mount API Routes (Unit 3)
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/admin', adminRoutes);

// 6. Centralized 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// 7. Server Initialization with Database Connection
async function startServer() {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`[BloodLink Server] Running on http://localhost:${PORT}`);
      console.log(`[BloodLink Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful Shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await closeDB();
        console.log('[Server] Closed all pending connections. Exiting.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error('[Startup Error] Could not start server due to database failure:', error.message);
    process.exit(1);
  }
}

// Start if run directly
if (require.main === module) {
  startServer();
}

module.exports = app;
