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
  return productController.getProducts(req, res);
});

// Vendor: Add product (auth required)
router.post('/', auth, productController.addProduct);
router.get('/:id', productController.getProduct);
router.patch('/:id', auth, productController.updateProduct);

module.exports = router;
