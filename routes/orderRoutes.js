const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const { sendInvoiceEmail } = require('../utils/emailService');

// Add invoice download route
router.get('/:orderNumber/invoice', auth, async (req, res) => {
  try {
    // Find order by orderNumber instead of _id
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    
    if (!order) {
      console.log('Order not found:', req.params.orderNumber);
      return res.status(404).json({ message: 'Order not found' });
    }

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const doc = new PDFDocument();
    const invoicePath = path.join(tempDir, `invoice-${order.orderNumber}.pdf`);

    // Pipe the PDF to a file
    const stream = fs.createWriteStream(invoicePath);
    doc.pipe(stream);

    // Add content to PDF
    doc.fontSize(20).text('Pillora Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Order Number: ${order.orderNumber}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.moveDown();
    doc.text(`Customer Name: ${order.customerName}`);
    doc.text(`Email: ${order.customerEmail}`);
    doc.text(`Address: ${order.shippingAddress}`);
    doc.moveDown();
    
    // Add items
    doc.text('Items:', { underline: true });
    order.items.forEach(item => {
      doc.text(`${item.name} x ${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}`);
    });
    
    doc.moveDown();
    doc.text(`Total Amount: ₹${order.totalAmount.toFixed(2)}`, { bold: true });
    
    // Finalize PDF
    doc.end();

    // When the stream is finished, send the file
    stream.on('finish', () => {
      res.download(invoicePath, `invoice-${order.orderNumber}.pdf`, (err) => {
        // Delete the file after sending
        fs.unlink(invoicePath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
        });
        
        if (err) {
          console.error('Error sending invoice:', err);
        }
      });
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ message: 'Error generating invoice', error: error.message });
  }
});

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

// Update the order creation response
router.post('/', auth, async (req, res) => {
  try {
    const order = await Order.create(req.body);

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../temp');
    if (!await fs.access(tempDir).catch(() => false)) {
      await fs.mkdir(tempDir, { recursive: true });
    }

    // Generate invoice
    const invoicePath = path.join(tempDir, `invoice-${order.orderNumber}.pdf`);
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(invoicePath);

    doc.pipe(writeStream);

    // Add content to PDF
    doc.fontSize(20).text('Pillora Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Order Number: ${order.orderNumber}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.text(`Customer Name: ${order.customerName}`);
    doc.text(`Email: ${order.customerEmail}`);
    doc.text(`Address: ${order.shippingAddress}`);
    doc.moveDown();
    
    doc.text('Items:', { underline: true });
    order.items.forEach(item => {
      doc.text(`${item.name} x ${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}`);
    });
    
    doc.moveDown();
    doc.text(`Total Amount: ₹${order.totalAmount.toFixed(2)}`, { bold: true });
    doc.end();

    // Wait for PDF to be created then send email
    writeStream.on('finish', async () => {
      try {
        console.log('Sending email to:', order.customerEmail);
        await sendInvoiceEmail(order.customerEmail, order, invoicePath);
        console.log('Email sent successfully');
      } catch (error) {
        console.error('Error sending invoice email:', error);
      } finally {
        // Clean up the file
        try {
          await fs.unlink(invoicePath);
        } catch (unlinkError) {
          console.error('Error deleting temp file:', unlinkError);
        }
      }
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({ error: error.message });
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
