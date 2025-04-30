const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendInvoiceEmail(to, order, invoicePath) {
  try {
    // Build product list HTML
    const itemsHtml = order.items.map(item =>
      `<li>${item.name} × ${item.quantity} @ ₹${item.price.toFixed(2)} each = <strong>₹${(item.price * item.quantity).toFixed(2)}</strong></li>`
    ).join('');

    const info = await transporter.sendMail({
      from: `"Pillora Orders" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `Your Pillora Order Invoice - ${order.orderNumber}`,
      html: `
        <h1>Thank you for your order!</h1>
        <p>Your order (<strong>${order.orderNumber}</strong>) has been successfully processed.</p>
        <p>Please find your invoice attached.</p>
        <p><strong>Order Details:</strong></p>
        <ul>
          <li><strong>Order Number:</strong> ${order.orderNumber}</li>
          <li><strong>Payment Method:</strong> ${order.paymentMethod}</li>
        </ul>
        <p><strong>Products Ordered:</strong></p>
        <ul>
          ${itemsHtml}
        </ul>
        <p><strong>Total Amount:</strong> ₹${order.totalAmount.toFixed(2)}</p>
      `,
      attachments: [
        {
          filename: `invoice-${order.orderNumber}.pdf`,
          path: invoicePath
        }
      ]
    });

    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

// Verify email configuration on startup
transporter.verify(function (error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

module.exports = { sendInvoiceEmail };
