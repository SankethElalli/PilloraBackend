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
    // Build product list HTML table
    const itemsHtml = `
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 6px;border-bottom:1px solid #e2e8f0;">Product</th>
            <th style="text-align:center;padding:8px 6px;border-bottom:1px solid #e2e8f0;">Qty</th>
            <th style="text-align:right;padding:8px 6px;border-bottom:1px solid #e2e8f0;">Unit Price</th>
            <th style="text-align:right;padding:8px 6px;border-bottom:1px solid #e2e8f0;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td style="padding:8px 6px;border-bottom:1px solid #f1f5f9;">${item.name}</td>
              <td style="text-align:center;padding:8px 6px;border-bottom:1px solid #f1f5f9;">${item.quantity}</td>
              <td style="text-align:right;padding:8px 6px;border-bottom:1px solid #f1f5f9;">₹${item.price.toFixed(2)}</td>
              <td style="text-align:right;padding:8px 6px;border-bottom:1px solid #f1f5f9;"><strong>₹${(item.price * item.quantity).toFixed(2)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const info = await transporter.sendMail({
      from: `"Pillora Orders" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `Your Pillora Order Invoice - ${order.orderNumber}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;background:#ffffff00;padding:32px;">
          <div style="max-width:600px;margin:auto;background:#d4ffdc;border-radius:40px;box-shadow:0 2px 12px #e2e8f0;padding:32px;">
            <div style="text-align:center;margin-bottom:24px;">
              <h2 style="margin:0;color:#000;font-weight:700;">Thank you for your order!</h2>
              <p style="color:#64748b;font-size:1.1rem;margin:8px 0 0 0;">Your order has been placed successfully.</p>
            </div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <div style="margin-bottom:18px;">
              <h3 style="color:#0f172a;font-size:1.15rem;margin:0 0 8px 0;">Order Summary</h3>
              <table style="width:100%;font-size:1rem;">
                <tr>
                  <td style="color:#64748b;">Order Number:</td>
                  <td style="color:#0f172a;font-weight:600;">${order.orderNumber}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;">Order Date:</td>
                  <td style="color:#0f172a;">${new Date(order.createdAt || Date.now()).toLocaleDateString()}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;">Payment Method:</td>
                  <td style="color:#0f172a;text-transform:capitalize;">${order.paymentMethod}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;">Shipping Address:</td>
                  <td style="color:#0f172a;">${order.shippingAddress}</td>
                </tr>
              </table>
            </div>
            <div style="margin-bottom:18px;">
              <h3 style="color:#0f172a;font-size:1.08rem;margin:0 0 8px 0;">Products Ordered</h3>
              ${itemsHtml}
            </div>
            <div style="text-align:right;margin-bottom:24px;">
              <span style="font-size:1.15rem;color:#0f172a;font-weight:700;">Total: ₹${order.totalAmount.toFixed(2)}</span>
            </div>
            <div style="background:#f1f5f9;padding:16px 18px;border-radius:8px;color:#497d74;font-size:1rem;">
              <strong>Need help?</strong> Contact us at <a href="mailto:support@pillora.in" style="color:#2563eb;text-decoration:none;">support@pillora.in</a>
            </div>
            <p style="color:#64748b;font-size:0.98rem;margin-top:32px;text-align:center;">
              You will receive your invoice as an attachment.<br>
              Thank you for choosing Pillora!
            </p>
          </div>
        </div>
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
