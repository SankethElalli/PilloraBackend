const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Personal Care',
      'Women Care',
      'Baby Care',
      'Diabetes Care',
      'Cardiac Care',
      'Stomach Care',
      'Pain Relief',
      'Liver Care',
      'Oral Care',
      'Respiratory',
      'Sexual Health',
      'Elderly Care',
      'Cold & Immunity',
      'Ayurveda',
      'Health Devices'
    ]
  },
  stock: {
    type: Number,
    required: true,
    min: 0
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: false
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  image: {
    type: String,
    required: true
  },
  reviews: {
    type: Array,
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
