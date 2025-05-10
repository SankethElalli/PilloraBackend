const PDFDocument = require('pdfkit');
const fs = require('fs'); // Add missing import

function generateInvoice(order, path) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(path);

    doc.pipe(writeStream);

    // Add company logo/header
    doc.fontSize(20).text('Pillora', { align: 'center' });
    doc.moveDown();

    // Add invoice details
    doc.fontSize(14);
    doc.text(`Invoice Number: INV-${order.orderNumber}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Customer details
    doc.text(`Customer Name: ${order.customerName}`);
    doc.text(`Email: ${order.customerEmail}`);
    doc.text(`Address: ${order.shippingAddress}`);
    doc.moveDown();

    // Items table
    doc.text('Items:', { underline: true });
    order.items.forEach(item => {
      doc.text(`${item.name} x ${item.quantity} - ₹${item.price * item.quantity}`);
    });

    doc.moveDown();

    // GST calculation (18%)
    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const gst = subtotal * 0.18;
    const totalWithGST = subtotal + gst;

    doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`);
    doc.text(`GST (18%): ₹${gst.toFixed(2)}`);
    doc.text(`Total Amount: ₹${totalWithGST.toFixed(2)}`, { bold: true });

    // Finalize
    doc.end();

    writeStream.on('finish', () => resolve(path));
    writeStream.on('error', reject);
  });
}

module.exports = generateInvoice;
