const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// Get orders (filtered by vendor or customer)
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user && req.user.type === 'vendor') {
      // Find all product IDs for this vendor
      const vendorProducts = await Product.find({ vendorId: req.user.userId }, '_id');
      const vendorProductIds = vendorProducts.map(p => p._id.toString());
      // Only show orders containing at least one product from this vendor
      query['items.productId'] = { $in: vendorProductIds };
    } else if (req.user && req.user.type === 'customer') {
      query.customerEmail = req.user.email;
    }
    const orders = await Order.find(query)
      .populate('items.productId')
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 });

    // Attach customer info for frontend
    const ordersWithCustomerInfo = orders.map(order => {
      const customerInfo = order.customerId;
      return {
        ...order.toObject(),
        customerName: customerInfo?.name || 'Unknown Customer',
        customerEmail: customerInfo?.email || 'No Email'
      };
    });

    res.json(ordersWithCustomerInfo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create order
router.post('/', async (req, res) => {
  try {
    // Find the vendorId from the first product in the order (assuming all items are from the same vendor)
    let vendorId = null;
    if (req.body.items && req.body.items.length > 0) {
      const firstProduct = await Product.findById(req.body.items[0].productId);
      if (firstProduct && firstProduct.vendorId) {
        vendorId = firstProduct.vendorId;
      }
    }

    const order = new Order({
      orderNumber: req.body.orderNumber,
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      customerEmail: req.body.customerEmail,
      items: req.body.items,
      totalAmount: req.body.totalAmount,
      shippingAddress: req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
      status: 'pending',
      vendorId // associate order with vendor
    });

    const savedOrder = await order.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update order status (vendor can only update their own orders)
router.patch('/:orderId/status', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Find the order and check if the vendor owns at least one product in the order
    const order = await Order.findById(orderId).populate('items.productId');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user && req.user.type === 'vendor') {
      // Get all product IDs for this vendor
      const vendorProducts = await Product.find({ vendorId: req.user.userId }, '_id');
      const vendorProductIds = vendorProducts.map(p => p._id.toString());
      // Check if any product in the order belongs to this vendor
      const orderProductIds = order.items.map(item => item.productId?._id?.toString());
      const hasVendorProduct = orderProductIds.some(pid => vendorProductIds.includes(pid));
      if (!hasVendorProduct) {
        return res.status(403).json({ message: 'Not authorized to update this order' });
      }
    }

    order.status = status;
    await order.save();

    // Populate customer info for response
    await order.populate('customerId', 'name email');
    const customerInfo = order.customerId;
    const orderWithCustomerInfo = {
      ...order.toObject(),
      customerName: customerInfo?.name || 'Unknown Customer',
      customerEmail: customerInfo?.email || 'No Email'
    };

    res.json(orderWithCustomerInfo);
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status' });
  }
});

module.exports = router;
