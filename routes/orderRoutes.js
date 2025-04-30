const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs'); // For createWriteStream
const fsPromises = require('fs').promises; // For async/await file ops
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
    // Header
    doc.rect(0, 0, doc.page.width, 70).fill('#2563eb');
    doc
      .fillColor('#fff')
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('Pillora', 40, 25, { align: 'left', continued: false });
    doc.moveDown(2);

    // White background for body
    doc.rect(0, 70, doc.page.width, doc.page.height - 70).fill('#fff');
    doc.fillColor('#0f172a');

    // Order Info
    doc.fontSize(16).font('Helvetica-Bold').text('Invoice', 40, 90);
    doc.fontSize(11).font('Helvetica').moveDown(0.5);
    doc.text(`Order Number: ${order.orderNumber}`, 40);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`, 40);
    doc.text(`Customer Name: ${order.customerName}`, 40);
    doc.text(`Email: ${order.customerEmail}`, 40);
    doc.text(`Shipping Address: ${order.shippingAddress}`, 40);
    doc.moveDown(1);

    // Table Header
    const tableTop = doc.y + 10;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Product', 40, tableTop);
    doc.text('Qty', 250, tableTop, { width: 40, align: 'center' });
    doc.text('Unit Price', 320, tableTop, { width: 80, align: 'right' });
    doc.text('Total', 420, tableTop, { width: 80, align: 'right' });
    doc.moveTo(40, tableTop + 16).lineTo(500, tableTop + 16).strokeColor('#e2e8f0').stroke();

    // Table Rows
    let y = tableTop + 22;
    doc.font('Helvetica').fontSize(11);
    order.items.forEach(item => {
      doc.text(item.name, 40, y, { width: 200 });
      doc.text(item.quantity.toString(), 250, y, { width: 40, align: 'center' });
      doc.text(`₹${item.price.toFixed(2)}`, 320, y, { width: 80, align: 'right' });
      doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, 420, y, { width: 80, align: 'right' });
      y += 20;
    });

    // Total
    doc.moveTo(40, y + 4).lineTo(500, y + 4).strokeColor('#e2e8f0').stroke();
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text('Total', 320, y + 10, { width: 80, align: 'right' });
    doc.text(`₹${order.totalAmount.toFixed(2)}`, 420, y + 10, { width: 80, align: 'right' });

    // Footer
    doc.font('Helvetica').fontSize(10).fillColor('#64748b');
    doc.text('Thank you for shopping with Pillora!', 40, y + 40, { align: 'left' });
    doc.text('For support: support@pillora.in', 40, y + 55, { align: 'left' });

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
    if (!await fsPromises.access(tempDir).then(() => true).catch(() => false)) {
      await fsPromises.mkdir(tempDir, { recursive: true });
    }

    // Generate invoice
    const invoicePath = path.join(tempDir, `invoice-${order.orderNumber}.pdf`);
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(invoicePath);

    doc.pipe(writeStream);

    // Add content to PDF
    // Header
    doc.rect(0, 0, doc.page.width, 70).fill('#2563eb');
    doc
      .fillColor('#fff')
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('Pillora', 40, 25, { align: 'left', continued: false });
    doc.moveDown(2);

    // White background for body
    doc.rect(0, 70, doc.page.width, doc.page.height - 70).fill('#fff');
    doc.fillColor('#0f172a');

    // Order Info
    doc.fontSize(16).font('Helvetica-Bold').text('Invoice', 40, 90);
    doc.fontSize(11).font('Helvetica').moveDown(0.5);
    doc.text(`Order Number: ${order.orderNumber}`, 40);
    doc.text(`Order Date: ${new Date().toLocaleDateString()}`, 40);
    doc.text(`Customer Name: ${order.customerName}`, 40);
    doc.text(`Email: ${order.customerEmail}`, 40);
    doc.text(`Shipping Address: ${order.shippingAddress}`, 40);
    doc.moveDown(1);
    
    // Table Header
    const tableTop = doc.y + 10;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Product', 40, tableTop);
    doc.text('Qty', 250, tableTop, { width: 40, align: 'center' });
    doc.text('Unit Price', 320, tableTop, { width: 80, align: 'right' });
    doc.text('Total', 420, tableTop, { width: 80, align: 'right' });
    doc.moveTo(40, tableTop + 16).lineTo(500, tableTop + 16).strokeColor('#e2e8f0').stroke();

    // Table Rows
    let y = tableTop + 22;
    doc.font('Helvetica').fontSize(11);
    order.items.forEach(item => {
      doc.text(item.name, 40, y, { width: 200 });
      doc.text(item.quantity.toString(), 250, y, { width: 40, align: 'center' });
      doc.text(`₹${item.price.toFixed(2)}`, 320, y, { width: 80, align: 'right' });
      doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, 420, y, { width: 80, align: 'right' });
      y += 20;
    });

    // Total
    doc.moveTo(40, y + 4).lineTo(500, y + 4).strokeColor('#e2e8f0').stroke();
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text('Total', 320, y + 10, { width: 80, align: 'right' });
    doc.text(`₹${order.totalAmount.toFixed(2)}`, 420, y + 10, { width: 80, align: 'right' });

    // Footer
    doc.font('Helvetica').fontSize(10).fillColor('#64748b');
    doc.text('Thank you for shopping with Pillora!', 40, y + 40, { align: 'left' });
    doc.text('For support: support@pillora.in', 40, y + 55, { align: 'left' });

    doc.end();

    writeStream.on('finish', async () => {
      try {
        await sendInvoiceEmail(order.customerEmail, order, invoicePath);
      } catch (error) {
        console.error('Error sending invoice email:', error);
      } finally {
        try {
          await fsPromises.unlink(invoicePath);
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
