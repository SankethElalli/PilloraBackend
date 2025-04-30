const PDFDocument = require('pdfkit');

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
    doc.text(`Total Amount: ₹${order.totalAmount}`, { bold: true });
    
    // Finalize
    doc.end();
    
    writeStream.on('finish', () => resolve(path));
    writeStream.on('error', reject);
  });
}

module.exports = generateInvoice;
