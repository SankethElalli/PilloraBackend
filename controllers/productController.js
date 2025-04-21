const Product = require('../models/Product');

// Add new product
exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category, image } = req.body;
    
    // Validate required fields
    if (!name || !description || !price || !category || !stock || !image) {
      return res.status(400).json({ 
        message: 'All fields are required: name, description, price, category, stock, image' 
      });
    }

    // Create new product with validated data
    const product = new Product({
      name,
      description,
      price: Number(price),
      stock: Number(stock),
      category,
      image,
      vendorId: req.user.userId // <-- associate with vendor
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

// Get all products for the logged-in vendor
exports.getProducts = async (req, res) => {
  try {
    let query = {};
    // Only filter by vendor if the request is authenticated as a vendor
    if (req.user && req.user.type === 'vendor') {
      query.vendorId = req.user.userId;
    }
    // Populate vendor's businessName
    const products = await Product.find(query).populate('vendorId', 'businessName');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single product
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
