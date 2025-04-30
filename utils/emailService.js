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
    console.log('Preparing to send email:', {
      to,
      orderNumber: order.orderNumber,
      invoicePath
    });

    const info = await transporter.sendMail({
      from: `"Pillora Orders" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `Your Pillora Order Invoice - ${order.orderNumber}`,
      html: `
        <h1>Thank you for your order!</h1>
        <p>Your order (${order.orderNumber}) has been successfully processed.</p>
        <p>Please find your invoice attached.</p>
        <p>Order Details:</p>
        <ul>
          <li>Order Number: ${order.orderNumber}</li>
          <li>Total Amount: ₹${order.totalAmount.toFixed(2)}</li>
          <li>Payment Method: ${order.paymentMethod}</li>
        </ul>
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
