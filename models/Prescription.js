const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  description: String,
  documentUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed'],
    default: 'pending'
  },
  review: String,
  reviewedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
