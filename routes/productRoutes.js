const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');

router.get('/', (req, res, next) => {

  if (req.header('Authorization')) {
    return auth(req, res, () => productController.getProducts(req, res));
  }

  return productController.getProducts(req, res);
});

router.post('/', auth, productController.addProduct);
router.get('/:id', productController.getProduct);

router.patch('/:id', auth, productController.updateProduct);

router.post('/:id/reviews', async (req, res) => {
  try {
    const Product = require('../models/Product');
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const review = {
      _id: new Date().getTime().toString(),
      rating: req.body.rating,
      comment: req.body.comment,
      createdAt: new Date(),
      userId: req.user ? { name: req.user.name || 'Anonymous' } : { name: 'Anonymous' }
    };

    if (!product.reviews) product.reviews = [];
    product.reviews.unshift(review);
    await product.save();
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
