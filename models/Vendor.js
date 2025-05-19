const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  phone: String,
  address: String,
  licenseNumber: {
    type: String,
    unique: true
  },
  gstin: {
    type: String,
    unique: true
  },
  isApproved: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Vendor', vendorSchema);
