const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Startup logging
const startupLog = {
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  nodeVersion: process.version,
  mongoUri: process.env.MONGODB_URI ? 'Set (value hidden)' : 'Not set',
  port: PORT
};

console.log('Application starting with config:', startupLog);

// Import routes
let routes;
try {
  routes = require('./routes');
  console.log('Routes loaded successfully');
} catch (err) {
  console.error('Error loading routes:', err);
  routes = express.Router(); // Fallback empty router
}

// Import models with error handling
let models = {};
try {
  models = require('./models');
  console.log('Models loaded successfully');
} catch (err) {
  console.error('Error loading models:', err);
}

// -------------------- MIDDLEWARE --------------------
// Logger middleware (placed at the top)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Add request timeout
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(503).json({ error: 'Request timeout' });
  });
  next();
});

// CORS
app.use(cors({
  origin: '*', // Consider restricting in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -------------------- ROUTES --------------------
app.use('/api', routes);

// -------------------- FILE UPLOAD HANDLING --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (err) {
      console.error('Error creating upload directory:', err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    } catch (err) {
      console.error('Error generating filename:', err);
      cb(err);
    }
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload endpoint with error handling
app.post('/api/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ fileUrl });
  });
});

// -------------------- DATABASE CONNECTION --------------------
const connectDB = async () => {
  const connectionString = process.env.MONGODB_URI || 'mongodb+srv://quibotechoffical:quibotech@cluster3.lgfjmv1.mongodb.net/Rmj';
  const retries = 5;
  const delay = 5000;
  
  console.log('Attempting to connect to MongoDB...');
  
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of default 30s
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      });
      
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      
      // Set up connection event listeners
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
      });
      
      return;
    } catch (err) {
      console.error(`MongoDB Connection Error (attempt ${i + 1}/${retries}):`, err);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // On last attempt, don't crash the server, just log the error
        console.error('All MongoDB connection attempts failed');
        if (process.env.NODE_ENV !== 'production') {
          throw err; // Only throw in non-production environments
        }
      }
    }
  }
};

// Attempt database connection without crashing server
connectDB().catch(err => {
  console.error('Failed to establish MongoDB connection:', err);
  // Don't exit process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// -------------------- HEALTH CHECK --------------------
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    status: 'ok',
    timestamp: new Date(),
    database: dbStatusMap[dbStatus] || 'unknown',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// -------------------- ERROR HANDLERS --------------------
// 404 middleware - must come before error handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// General error middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack || err);
  
  // Log specific error details
  if (err.name === 'MongoError' || err.name === 'MongoNetworkError') {
    console.error('Database error:', err.message);
  }
  
  // Don't send stack traces to client in production
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : {
      message: err.message,
      name: err.name
    }
  });
});

// -------------------- START SERVER --------------------
let server;
try {
  server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err);
  });
} catch (err) {
  console.error('Failed to start server:', err);
}

// -------------------- GRACEFUL SHUTDOWN --------------------
const gracefulShutdown = (signal) => {
  console.log(`${signal} signal received. Shutting down gracefully.`);
  
  // Set a timeout for forceful shutdown if grace period exceeds
  const forceExit = setTimeout(() => {
    console.error('Forceful shutdown due to timeout');
    process.exit(1);
  }, 30000);
  
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      
      if (mongoose.connection.readyState !== 0) {
        mongoose.connection.close(false)
          .then(() => {
            console.log('MongoDB connection closed.');
            clearTimeout(forceExit);
            process.exit(0);
          })
          .catch(err => {
            console.error('Error closing MongoDB connection:', err);
            clearTimeout(forceExit);
            process.exit(1);
          });
      } else {
        console.log('No MongoDB connection to close');
        clearTimeout(forceExit);
        process.exit(0);
      }
    });
  } else {
    console.log('Server was not started, no need to close');
    clearTimeout(forceExit);
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, we don't want to crash the server
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Export app for testing
module.exports = app;
