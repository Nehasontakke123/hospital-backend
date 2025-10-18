const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const net = require('net');
const { startServerWithPortManagement, killPortProcesses } = require('./utils/portManager');
require('dotenv').config();

// Import all routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const doctorRoutes = require('./routes/doctors');
const emrRoutes = require('./routes/emr');
const billingRoutes = require('./routes/billing');
const pharmacyRoutes = require('./routes/pharmacy');
const labRoutes = require('./routes/lab');
const ipdRoutes = require('./routes/ipd');
const otRoutes = require('./routes/ot');
const inventoryRoutes = require('./routes/inventory');
const reportsRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
// const insuranceRoutes = require('./routes/insurance');
// const telemedicineRoutes = require('./routes/telemedicine');
// const helpdeskRoutes = require('./routes/helpdesk');

// Import middleware
const { errorHandler } = require('./middlewares/errorHandler');
const { notFound } = require('./middlewares/notFound');

const app = express();
const server = createServer(app);

// Socket.io setup for real-time features
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io available globally
app.set('io', io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Favicon handler
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'HMS Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_jwt_secret_for_development');
    const User = require('./models/User');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.userId = user._id;
    socket.userRole = user.role;
    socket.userName = `${user.firstName} ${user.lastName}`;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.io real-time event handlers
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.userName} (${socket.userRole})`);
  
  // Join user to role-based rooms
  socket.join(socket.userRole);
  socket.join(socket.userId.toString());
  
  // Join admin to all rooms for monitoring
  if (socket.userRole === 'admin') {
    socket.join('admin_monitoring');
  }
  
  // Patient monitoring events
  socket.on('join_patient_monitoring', (patientId) => {
    socket.join(`patient_${patientId}`);
    console.log(`${socket.userName} joined patient monitoring: ${patientId}`);
  });
  
  // Department monitoring
  socket.on('join_department', (department) => {
    socket.join(`department_${department}`);
    console.log(`${socket.userName} joined department: ${department}`);
  });
  
  // Emergency alerts
  socket.on('emergency_alert', (data) => {
    console.log(`🚨 Emergency Alert from ${socket.userName}:`, data);
    io.to('admin_monitoring').emit('emergency_alert', {
      ...data,
      from: socket.userName,
      timestamp: new Date()
    });
  });
  
  // Patient vitals update
  socket.on('patient_vitals_update', (data) => {
    console.log(`📊 Vitals update for patient ${data.patientId}`);
    io.to(`patient_${data.patientId}`).emit('vitals_updated', data);
    io.to('admin_monitoring').emit('vitals_alert', data);
  });
  
  // Appointment updates
  socket.on('appointment_update', (data) => {
    console.log(`📅 Appointment update:`, data);
    io.to(`department_${data.department}`).emit('appointment_changed', data);
  });
  
  // Lab results
  socket.on('lab_result_ready', (data) => {
    console.log(`🧪 Lab result ready for patient ${data.patientId}`);
    io.to(`patient_${data.patientId}`).emit('lab_result', data);
    io.to('admin_monitoring').emit('lab_result_notification', data);
  });
  
  // Billing updates
  socket.on('billing_update', (data) => {
    console.log(`💰 Billing update:`, data);
    io.to('admin_monitoring').emit('billing_notification', data);
  });
  
  // Inventory alerts
  socket.on('inventory_alert', (data) => {
    console.log(`📦 Inventory alert:`, data);
    io.to('admin_monitoring').emit('inventory_notification', data);
  });
  
  // Chat messages
  socket.on('send_message', (data) => {
    console.log(`💬 Message from ${socket.userName} to ${data.recipient}`);
    socket.to(data.recipient).emit('receive_message', {
      ...data,
      from: socket.userName,
      timestamp: new Date()
    });
  });
  
  // System notifications
  socket.on('system_notification', (data) => {
    console.log(`📢 System notification:`, data);
    io.emit('notification', {
      ...data,
      timestamp: new Date()
    });
  });
  
  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.userName}`);
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/emr', emrRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/ipd', ipdRoutes);
app.use('/api/ot', otRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
// app.use('/api/insurance', insuranceRoutes);
// app.use('/api/telemedicine', telemedicineRoutes);
// app.use('/api/helpdesk', helpdeskRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hms', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Function to start server on specific port
const startServerOnPort = async (port) => {
  return new Promise((resolve, reject) => {
    server.listen(port, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`🚀 HMS Server running on port ${port}`);
        console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
        console.log(`🏥 Health Check: http://localhost:${port}/api/health`);
        console.log(`🔌 Socket.io: http://localhost:${port}`);
        console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
        console.log(`✅ Server started successfully!`);
        resolve(port);
      }
    });
  });
};

// Start server with robust port management
const startServer = async () => {
  try {
    const preferredPort = parseInt(process.env.PORT) || 3008;
    console.log(`🔍 Starting server with port management...`);
    console.log(`🎯 Preferred port: ${preferredPort}`);
    
    const actualPort = await startServerWithPortManagement(startServerOnPort, preferredPort);
    
    // Update environment variable for consistency
    process.env.PORT = actualPort.toString();
    
    console.log(`🎉 Server successfully started on port ${actualPort}`);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('💡 Try running: npm run kill-ports');
    process.exit(1);
  }
};

startServer();

module.exports = app;