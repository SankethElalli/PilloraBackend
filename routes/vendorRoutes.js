const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

router.post('/register', async (req, res) => {
  try {
    let { email, businessName, password, phone, address, licenseNumber, gstin } = req.body;

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
      email,
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

// --- Vendor Ads Management ---

// Get all ads for the logged-in vendor
router.get('/ads', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.userId);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json(vendor.ads || []);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching ads' });
  }
});

// Add a new ad (imageUrl/link)
router.post('/ads', auth, async (req, res) => {
  try {
    const { imageUrl, link } = req.body;
    if (!imageUrl) return res.status(400).json({ message: 'Image URL required' });
    const vendor = await Vendor.findById(req.user.userId);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    vendor.ads.push({ imageUrl, link });
    await vendor.save();
    res.status(201).json({ message: 'Ad added' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding ad' });
  }
});

// Upload ad image
const adStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/vendor-ads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, ''));
  }
});
const adUpload = multer({ storage: adStorage });

router.post('/ads/upload', auth, adUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `/uploads/vendor-ads/${req.file.filename}`;
  res.json({ url });
});

// Delete ad
router.delete('/ads/:adId', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.userId);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    vendor.ads = vendor.ads.filter(ad => ad._id.toString() !== req.params.adId);
    await vendor.save();
    res.json({ message: 'Ad removed' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing ad' });
  }
});

module.exports = router;
