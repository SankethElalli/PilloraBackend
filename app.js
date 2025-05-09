const express = require('express');
const cors = require('cors');
const orderRoutes = require('./routes/orderRoutes');
const phonepeRoutes = require('./routes/phonepeRoutes');
const fs = require('fs');
const path = require('path');

const app = express();

const tempDir = path.join(__dirname, 'temp');
try {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
} catch (error) {
  console.error('Error creating temp directory:', error);
}

app.use(cors());
app.use(express.json());
app.use('/api/orders', orderRoutes);