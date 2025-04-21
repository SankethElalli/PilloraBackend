require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const path = require('path');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const orderRoutes = require('./routes/orderRoutes');

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads/prescriptions');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();

// Connect to MongoDB
connectDB();

// Helper: Allow localhost and LAN IPs for dev
const allowedOrigins = [
  'http://localhost:3000',
  'https://pillorapharmacy.vercel.app',
];
if (process.env.HOST_IP) {
  allowedOrigins.push(`http://${process.env.HOST_IP}:3000`);
}
// Allow all 192.168.*.*:3000 for dev mobile access
for (let i = 0; i < 256; i++) {
  for (let j = 0; j < 256; j++) {
    allowedOrigins.push(`http://192.168.${i}.${j}:3000`);
  }
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global request logger middleware
app.use((req, res, next) => {
  const body = req.body || {};
  const query = req.query || {};
  const params = req.params || {};
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  if (Object.keys(body).length) {
    console.log('Body:', body);
  }
  if (Object.keys(query).length) {
    console.log('Query:', query);
  }
  if (Object.keys(params).length) {
    console.log('Params:', params);
  }
  next();
});

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, {
    body: req.body,
    query: req.query,
    params: req.params
  });
  next();
});

// Routes
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/orders', orderRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: err.message });
});

// Basic route
app.get('/', (req, res) => {
  res.send('Pillora API is running...');
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Available routes:');
  console.log('- POST /api/vendors/login');
  console.log('- POST /api/vendors/register');
  console.log('- GET /api/vendors/orders');
  console.log('- GET /api/vendors/orders/:orderId');
  console.log('- PATCH /api/vendors/orders/:orderId/status');
  console.log('- GET /api/products');
  console.log('- POST /api/products');
  console.log('- GET /api/orders');
  console.log('- POST /api/orders');
  console.log('- GET /api/prescriptions');
  console.log('- POST /api/prescriptions/upload');
});
