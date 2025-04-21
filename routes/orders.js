const router = require('express').Router();
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const Customer = require('../models/Customer');

router.post('/', auth, async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress, paymentMethod } = req.body;
    
    // Get full user details from auth middleware
    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const orderNumber = 'ORD' + Date.now();

    const newOrder = new Order({
      orderNumber,
      customerId: customer._id,
      customerEmail: customer.email,
      customerName: customer.name,
      items,
      totalAmount,
      shippingAddress,
      paymentMethod,
      status: 'pending'
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ message: 'Error creating order' });
  }
});

// Add this new route
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ customerEmail: req.user.email })
      .populate('items.productId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

module.exports = router;
