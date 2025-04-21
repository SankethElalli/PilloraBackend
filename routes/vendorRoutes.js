const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');

router.post('/register', async (req, res) => {
  try {
    let { email, businessName, password, phone, address, licenseNumber, gstin } = req.body;

    // Normalize email to lowercase before saving
    email = email.toLowerCase();

    const existingVendor = await Vendor.findOne({ 
      $or: [
        { email },
        { licenseNumber },
        { gstin }
      ]
    });

    if (existingVendor) {
      return res.status(400).json({ 
        message: 'A vendor with this email, license number, or GSTIN already exists' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const vendor = new Vendor({
      businessName,
      email, // already lowercased
      password: hashedPassword,
      phone,
      address,
      licenseNumber,
      gstin
    });

    await vendor.save();
    res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/vendors/login
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    console.log('Vendor login attempt:', email);

    // Normalize email to lowercase for consistent login
    email = email.toLowerCase();

    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      console.log('Vendor not found:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) {
      console.log('Invalid password for vendor:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: vendor._id, type: 'vendor' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Vendor login successful:', email);
    res.json({
      token,
      user: {
        _id: vendor._id,
        businessName: vendor.businessName,
        email: vendor.email,
        isVendor: true
      }
    });
  } catch (error) {
    console.error('Vendor login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Get all orders for a vendor
router.get('/orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ vendorId: req.user.userId })
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

// Update order status
router.patch('/orders/:orderId/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.orderId, vendorId: req.user.userId },
      { status },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status' });
  }
});

// Get order details
router.get('/orders/:orderId', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      vendorId: req.user.userId
    }).populate('customerId', 'name email phone');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order details' });
  }
});

module.exports = router;
