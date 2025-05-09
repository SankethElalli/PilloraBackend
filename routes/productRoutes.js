const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');

// Public: Get all products (no auth)
router.get('/', (req, res, next) => {
  // If there's an Authorization header, use auth middleware
  if (req.header('Authorization')) {
    return auth(req, res, () => productController.getProducts(req, res));
  }
  // Otherwise, public fetch (all products)
  return productController.getProducts(req, res);
});

// Vendor: Add product (auth required)
router.post('/', auth, productController.addProduct);
router.get('/:id', productController.getProduct);

// Add this PATCH route for updating a product by ID
router.patch('/:id', auth, productController.updateProduct);

// Add review to product
router.post('/:id/reviews', auth, async (req, res) => {
  try {
    const Product = require('../models/Product');
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    // Create review object
    const review = {
      _id: new Date().getTime().toString(),
      rating: req.body.rating,
      comment: req.body.comment,
      createdAt: new Date(),
      userId: req.user && req.user.name
        ? { name: req.user.name }
        : { name: 'Anonymous' }
    };
    // Add to reviews array (create if not exists)
    if (!product.reviews) product.reviews = [];
    product.reviews.unshift(review);
    await product.save();
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
