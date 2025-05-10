const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs'); // For createWriteStream
const fsPromises = require('fs').promises; // For async/await file ops
const path = require('path');
const { sendInvoiceEmail } = require('../utils/emailService');
const Product = require('../models/Product'); // <-- Add this line

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

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Pillora Invoice - ${order.orderNumber}`,
        Author: 'Pillora',
      }
    });

    // Header with theme colors
    doc.rect(0, 0, doc.page.width, 160).fill('#0D7C66');
    
    // Company name and logo
    doc.font('Helvetica-Bold')
       .fontSize(35)
       .fillColor('#FFFFFF')
       .text('PILLORA', 50, 60);
    
    doc.font('Helvetica')
       .fontSize(14)
       .fillColor('#E0F2F1')
       .text('Invoice', 50, 100);

    // Order details box
    doc.rect(50, 180, doc.page.width - 100, 120)
       .lineWidth(1)
       .stroke('#E2E8F0');

    // Order info in two columns
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#334155');

    // Left column
    doc.text('BILLED TO:', 70, 200)
       .font('Helvetica-Bold')
       .text(order.customerName, 70, 220)
       .font('Helvetica')
       .text(order.shippingAddress, 70, 240, { width: 200 });

    // Right column
    doc.text('Invoice Number:', 350, 200)
       .font('Helvetica-Bold')
       .text(order.orderNumber, 350, 220)
       .font('Helvetica')
       .text('Date:', 350, 240)
       .text(new Date(order.createdAt).toLocaleDateString('en-IN'), 350, 260);

    // Items table header
    const tableTop = 340;
    doc.font('Helvetica-Bold')
       .fillColor('#0D7C66')
       .fontSize(12);

    // Table headers
    [
      { text: 'Item', x: 50, width: 250 },
      { text: 'Qty', x: 300, width: 50, align: 'center' },
      { text: 'Price', x: 350, width: 100, align: 'right' },
      { text: 'Total', x: 450, width: 100, align: 'right' }
    ].forEach(header => {
      doc.text(header.text, header.x, tableTop, { width: header.width, align: header.align || 'left' });
    });

    // Underline headers
    doc.moveTo(50, tableTop + 20)
       .lineTo(550, tableTop + 20)
       .lineWidth(1)
       .stroke('#0D7C66');

    // Table rows
    let y = tableTop + 40;
    doc.font('Helvetica')
       .fontSize(11)
       .fillColor('#334155');

    order.items.forEach(item => {
      doc.text(item.name, 50, y, { width: 250 })
         .text(item.quantity.toString(), 300, y, { width: 50, align: 'center' })
         .text(`₹${item.price.toFixed(2)}`, 350, y, { width: 100, align: 'right' })
         .text(`₹${(item.price * item.quantity).toFixed(2)}`, 450, y, { width: 100, align: 'right' });
      
      y += 25;
    });

    // Totals section
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const gst = subtotal * 0.12; // 12% GST
    const total = subtotal + gst;

    y += 20;
    doc.moveTo(350, y).lineTo(550, y).stroke('#E2E8F0');
    y += 10;

    // Subtotal, GST, and Total
    doc.font('Helvetica')
       .text('Subtotal:', 350, y, { width: 100, align: 'right' })
       .text(`₹${subtotal.toFixed(2)}`, 450, y, { width: 100, align: 'right' });
    
    y += 25;
    doc.text('GST (12%):', 350, y, { width: 100, align: 'right' })
       .text(`₹${gst.toFixed(2)}`, 450, y, { width: 100, align: 'right' });
    
    y += 25;
    doc.font('Helvetica-Bold')
       .fontSize(13)
       .fillColor('#0D7C66')
       .text('Total:', 350, y, { width: 100, align: 'right' })
       .text(`₹${total.toFixed(2)}`, 450, y, { width: 100, align: 'right' });

    // Footer
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#64748B')
       .text('Thank you for shopping with Pillora!', 50, doc.page.height - 100)
       .text('For support, contact us at: support@pillora.in', 50, doc.page.height - 80);

    doc.end();

    // Pipe the PDF to a file
    const stream = fs.createWriteStream(invoicePath);
    doc.pipe(stream);

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
      const Product = require('../models/Product');
      const vendorProducts = await Product.find({ vendorId: req.user.userId }, '_id');
      const vendorProductIds = vendorProducts.map(p => p._id);

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
    // Set paymentStatus based on paymentMethod or PayPal result
    let paymentStatus = 'pending';
    if (req.body.paymentMethod === 'paypal' && (req.body.paymentStatus === 'completed' || req.body.paymentStatus === 'paid')) {
      paymentStatus = 'paid';
    } else if (req.body.paymentMethod === 'paypal' && req.body.paymentStatus) {
      paymentStatus = req.body.paymentStatus; // fallback for other PayPal statuses
    } else if (req.body.paymentMethod === 'cod') {
      paymentStatus = 'pending';
    }
    // Merge paymentStatus into order data
    const orderData = { ...req.body, paymentStatus };

    const order = await Order.create(orderData);

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../temp');
    if (!await fsPromises.access(tempDir).then(() => true).catch(() => false)) {
      await fsPromises.mkdir(tempDir, { recursive: true });
    }

    // Generate invoice
    const invoicePath = path.join(tempDir, `invoice-${order.orderNumber}.pdf`);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Pillora Invoice - ${order.orderNumber}`,
        Author: 'Pillora',
      }
    });

    // Header with theme colors
    doc.rect(0, 0, doc.page.width, 160).fill('#0D7C66');
    
    // Company name and logo
    doc.font('Helvetica-Bold')
       .fontSize(35)
       .fillColor('#FFFFFF')
       .text('PILLORA', 50, 60);
    
    doc.font('Helvetica')
       .fontSize(14)
       .fillColor('#E0F2F1')
       .text('Invoice', 50, 100);

    // Order details box
    doc.rect(50, 180, doc.page.width - 100, 120)
       .lineWidth(1)
       .stroke('#E2E8F0');

    // Order info in two columns
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#334155');

    // Left column
    doc.text('BILLED TO:', 70, 200)
       .font('Helvetica-Bold')
       .text(order.customerName, 70, 220)
       .font('Helvetica')
       .text(order.shippingAddress, 70, 240, { width: 200 });

    // Right column
    doc.text('Invoice Number:', 350, 200)
       .font('Helvetica-Bold')
       .text(order.orderNumber, 350, 220)
       .font('Helvetica')
       .text('Date:', 350, 240)
       .text(new Date().toLocaleDateString('en-IN'), 350, 260);

    // Items table header
    const tableTop = 340;
    doc.font('Helvetica-Bold')
       .fillColor('#0D7C66')
       .fontSize(12);

    // Table headers
    [
      { text: 'Item', x: 50, width: 250 },
      { text: 'Qty', x: 300, width: 50, align: 'center' },
      { text: 'Price', x: 350, width: 100, align: 'right' },
      { text: 'Total', x: 450, width: 100, align: 'right' }
    ].forEach(header => {
      doc.text(header.text, header.x, tableTop, { width: header.width, align: header.align || 'left' });
    });

    // Underline headers
    doc.moveTo(50, tableTop + 20)
       .lineTo(550, tableTop + 20)
       .lineWidth(1)
       .stroke('#0D7C66');

    // Table rows
    let y = tableTop + 40;
    doc.font('Helvetica')
       .fontSize(11)
       .fillColor('#334155');

    order.items.forEach(item => {
      doc.text(item.name, 50, y, { width: 250 })
         .text(item.quantity.toString(), 300, y, { width: 50, align: 'center' })
         .text(`₹${item.price.toFixed(2)}`, 350, y, { width: 100, align: 'right' })
         .text(`₹${(item.price * item.quantity).toFixed(2)}`, 450, y, { width: 100, align: 'right' });
      
      y += 25;
    });

    // Totals section
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const gst = subtotal * 0.12; // 12% GST
    const total = subtotal + gst;

    y += 20;
    doc.moveTo(350, y).lineTo(550, y).stroke('#E2E8F0');
    y += 10;

    // Subtotal, GST, and Total
    doc.font('Helvetica')
       .text('Subtotal:', 350, y, { width: 100, align: 'right' })
       .text(`₹${subtotal.toFixed(2)}`, 450, y, { width: 100, align: 'right' });
    
    y += 25;
    doc.text('GST (12%):', 350, y, { width: 100, align: 'right' })
       .text(`₹${gst.toFixed(2)}`, 450, y, { width: 100, align: 'right' });
    
    y += 25;
    doc.font('Helvetica-Bold')
       .fontSize(13)
       .fillColor('#0D7C66')
       .text('Total:', 350, y, { width: 100, align: 'right' })
       .text(`₹${total.toFixed(2)}`, 450, y, { width: 100, align: 'right' });

    // Footer
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#64748B')
       .text('Thank you for shopping with Pillora!', 50, doc.page.height - 100)
       .text('For support, contact us at: support@pillora.in', 50, doc.page.height - 80);

    doc.end();

    const writeStream = fs.createWriteStream(invoicePath);

    doc.pipe(writeStream);

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

// PATCH endpoint to update payment status (optional, for extensibility)
router.patch('/:orderId/payment-status', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Optionally, add vendor/customer/admin checks here

    order.paymentStatus = paymentStatus;
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment status' });
  }
});

module.exports = router;
