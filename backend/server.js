require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
require('dotenv').config(); // Fallback to local .env

const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');

// Import Route Handlers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const queueRoutes = require('./routes/queueRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

// Import Custom Middlewares
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Initialize MongoDB Atlas connection
connectDB();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 5001;

// Core Middleware
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/analytics', analyticsRoutes);

// Static Uploads Serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve Frontend Static Assets
const frontendPath = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API 404 & Centralized Error Handler
app.use('/api', notFound);
app.use(errorHandler);

// SPA / Frontend Fallback for browser navigation
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start Server
const server = app.listen(port, () => {
  console.log(`MedQueue MVC Server running on port ${port} [http://localhost:${port}]`);
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('Shutting down MedQueue server gracefully...');
  server.close(async () => {
    const mongoose = require('mongoose');
    await mongoose.connection.close(false);
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

module.exports = app;
