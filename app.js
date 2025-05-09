const express = require('express');
const cors = require('cors');
const orderRoutes = require('./routes/orderRoutes');
const phonepeRoutes = require('./routes/phonepeRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const fs = require('fs');
const path = require('path');

const app = express();

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

app.use(cors());
app.use(express.json());

// Register routes
app.use('/api/orders', orderRoutes);
app.use('/api/phonepe', phonepeRoutes);
app.use('/api/reviews', reviewRoutes);
