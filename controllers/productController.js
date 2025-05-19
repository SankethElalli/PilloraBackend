const Product = require('../models/Product');

exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category, image, adImageUrl } = req.body;
    
    if (!name || !description || !price || !category || !stock || !image) {
      return res.status(400).json({ 
        message: 'All fields are required: name, description, price, category, stock, image' 
      });
    }

    const product = new Product({
      name,
      description,
      price: Number(price),
      stock: Number(stock),
      category,
      image,
      adImageUrl, // Save adImageUrl if provided
      vendorId: req.user.userId
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(400).json({ 
      message: error.message,
      details: error.errors 
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    let query = {};
    if (req.user && req.user.type === 'vendor') {
      query.vendorId = req.user.userId;
    }
    const products = await Product.find(query).populate('vendorId', 'businessName');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findOne({ _id: productId, vendorId: req.user.userId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const allowedFields = ['name', 'description', 'price', 'stock', 'category', 'image', 'adImageUrl'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
