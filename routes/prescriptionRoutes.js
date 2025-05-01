const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Prescription = require('../models/Prescription');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

// Add review to prescription
router.post('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid prescription ID format' });
    }

    const prescription = await Prescription.findById(id);
    
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    const { review } = req.body;
    prescription.review = review;
    prescription.status = 'reviewed';
    prescription.reviewedAt = new Date();

    const savedPrescription = await prescription.save();
    res.json(savedPrescription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/prescriptions/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only .png, .jpg, .jpeg and .pdf format allowed!'));
  }
});

// Get prescriptions (customer or vendor)
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user && req.user.type === 'vendor') {
      query.vendorId = req.user.userId;
    } else if (req.query.customerId) {
      query.userId = req.query.customerId;
    }
    const prescriptions = await Prescription.find(query).sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload prescription (customer only)
router.post('/upload', auth, multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/prescriptions/')
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname))
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only .png, .jpg, .jpeg and .pdf format allowed!'));
  }
}).single('prescription'), async (req, res) => {
  try {

    const defaultVendorId = process.env.DEFAULT_VENDOR_ID;
    if (!defaultVendorId) {
      return res.status(400).json({ message: 'No vendor assigned for prescription. Set DEFAULT_VENDOR_ID in env.' });
    }

    const prescription = new Prescription({
      userId: req.body.userId,
      customerName: req.body.customerName,
      customerEmail: req.body.customerEmail,
      vendorId: defaultVendorId,
      description: req.body.description,
      documentUrl: `/uploads/prescriptions/${req.file.filename}`,
      status: 'pending'
    });

    await prescription.save();
    res.status(201).json({ message: 'Prescription uploaded successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
