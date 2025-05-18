const Product = require('../models/Product');

exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category, image } = req.body;
    
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
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Only select necessary fields
    const selectFields = 'name price image category stock vendorId';

    // Optimize population: only get businessName
    const products = await Product.find(query)
      .select(selectFields)
      .populate('vendorId', 'businessName')
      .skip(skip)
      .limit(limit);

    // Optionally, return total count for frontend pagination
    const total = await Product.countDocuments(query);

    res.json({
      products,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
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
    const allowedFields = ['name', 'description', 'price', 'stock', 'category', 'image'];
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
