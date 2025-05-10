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
          <tr style="background:#EAFAEA;">
            <th style="text-align:left;padding:10px 8px;border-bottom:2px solid #0D7C66;color:#0D7C66;font-size:1rem;">Product</th>
            <th style="text-align:center;padding:10px 8px;border-bottom:2px solid #0D7C66;color:#0D7C66;font-size:1rem;">Qty</th>
            <th style="text-align:right;padding:10px 8px;border-bottom:2px solid #0D7C66;color:#0D7C66;font-size:1rem;">Unit Price</th>
            <th style="text-align:right;padding:10px 8px;border-bottom:2px solid #0D7C66;color:#0D7C66;font-size:1rem;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#334155;">${item.name}</td>
              <td style="text-align:center;padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#334155;">${item.quantity}</td>
              <td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#334155;">₹${item.price.toFixed(2)}</td>
              <td style="text-align:right;padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#0D7C66;font-weight:600;">₹${(item.price * item.quantity).toFixed(2)}</td>
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
        <div style="font-family:'Inter','Segoe UI',Arial,sans-serif;background:#f8fafc;padding:0;margin:0;">
          <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:18px;box-shadow:0 4px 24px #0D7C6612;padding:0;overflow:hidden;">
            <div style="background-color: #0D7C66;padding:32px 32px 18px 32px;text-align:center;">
              <h2 style="margin:0;color:#fff;font-weight:800;letter-spacing:1px;font-size:2rem;">Order Invoice</h2>
              <div style="color:#e0f2f1;font-size:1.1rem;margin-top:8px;">Thank you for shopping with Pillora!</div>
            </div>
            <div style="padding:32px;">
              <div style="margin-bottom:24px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="color:#64748b;font-size:1.08rem;font-weight:600;">Order Number:</span>
                  <span style="color:#0D7C66;font-weight:800;font-size:1.18rem;letter-spacing:0.5px;">${order.orderNumber}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="color:#64748b;font-size:1.08rem;font-weight:600;">Order Date:</span>
                  <span style="color:#334155;font-size:1.08rem;font-weight:600;">${new Date(order.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="color:#64748b;font-size:1.08rem;font-weight:600;">Payment Method:</span>
                  <span style="color:#334155;text-transform:capitalize;font-size:1.08rem;font-weight:600;">${order.paymentMethod}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                  <span style="color:#64748b;font-size:1.08rem;font-weight:600;">Shipping Address:</span>
                  <span style="color:#334155;text-align:right;max-width:340px;display:inline-block;font-size:1.08rem;font-weight:600;">${order.shippingAddress}</span>
                </div>
              </div>
              <div style="margin-bottom:18px;">
                <h3 style="color:#0D7C66;font-size:1.08rem;margin:0 0 10px 0;font-weight:700;">Products Ordered</h3>
                ${itemsHtml}
              </div>
              <div style="text-align:right;margin-bottom:24px;">
                <span style="font-size:1.1rem;color:#0D7C66;font-weight:700;display:block;">Total (incl. GST):</span>
                <span style="font-size:1.2rem;color:#0D7C66;font-weight:800;">₹${order.totalAmount.toFixed(2)}</span>
              </div>
              <div style="background:#EAFAEA;padding:18px 20px;border-radius:10px;color:#0D7C66;font-size:1rem;margin-bottom:18px;">
                <strong>Need help?</strong> Contact us at <a href="mailto:pillorasite@gmail.com" style="color:#2563eb;text-decoration:none;">pillorasite@gmail.com</a>
              </div>
              <p style="color:#64748b;font-size:0.98rem;margin-top:32px;text-align:center;">
                You will receive your invoice as an attachment.<br>
                Thank you for choosing <span style="color:#0D7C66;font-weight:700;">Pillora</span>!
              </p>
            </div>
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

// Example: Use this HTML for PDF generation (replace your current template)
function getInvoicePdfHtml(order) {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td class="item-name">${item.name}</td>
      <td class="item-qty">${item.quantity}</td>
      <td class="item-price">₹${item.price.toFixed(2)}</td>
      <td class="item-total">₹${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Pillora Invoice</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
      body {
        font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
        background: #f8fafc;
        margin: 0;
        padding: 0;
        color: #1e293b;
      }
      .invoice-container {
        max-width: 700px;
        margin: 32px auto;
        background: #fff;
        border-radius: 18px;
        box-shadow: 0 4px 24px #0D7C6612;
        overflow: hidden;
      }
      .invoice-header {
        background: linear-gradient(90deg, #0D7C66 60%, #2563eb 100%);
        padding: 32px 32px 18px 32px;
        text-align: left;
      }
      .invoice-header img {
        height: 48px;
        margin-bottom: 10px;
        display: block;
      }
      .invoice-header h1 {
        margin: 0 0 4px 0;
        color: #fff;
        font-weight: 800;
        font-size: 2.2rem;
        letter-spacing: 1px;
      }
      .invoice-header .subtitle {
        color: #e0f2f1;
        font-size: 1.1rem;
        margin-top: 8px;
        font-weight: 500;
      }
      .invoice-body {
        padding: 32px;
      }
      .order-info {
        margin-bottom: 28px;
      }
      .order-info-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 10px;
      }
      .order-info-label {
        color: #497D74;
        font-size: 1.08rem;
        font-weight: 600;
        min-width: 140px;
      }
      .order-info-value {
        color: #0D7C66;
        font-weight: 700;
        font-size: 1.08rem;
        text-align: right;
        word-break: break-word;
        max-width: 340px;
      }
      .order-info-value.secondary {
        color: #334155;
        font-weight: 500;
      }
      .products-title {
        color: #0D7C66;
        font-size: 1.12rem;
        margin: 0 0 12px 0;
        font-weight: 700;
        letter-spacing: 0.2px;
      }
      .products-table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0 0 0;
        font-size: 1rem;
      }
      .products-table th {
        background: #EAFAEA;
        text-align: left;
        padding: 12px 8px;
        border-bottom: 2px solid #0D7C66;
        color: #0D7C66;
        font-size: 1rem;
        font-weight: 700;
      }
      .products-table th.item-qty,
      .products-table td.item-qty {
        text-align: center;
        width: 60px;
      }
      .products-table th.item-price,
      .products-table th.item-total,
      .products-table td.item-price,
      .products-table td.item-total {
        text-align: right;
        width: 110px;
      }
      .products-table td {
        padding: 12px 8px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 1rem;
        color: #334155;
        vertical-align: top;
      }
      .products-table td.item-total {
        color: #0D7C66;
        font-weight: 700;
      }
      .products-table td.item-price {
        color: #497D74;
        font-weight: 600;
      }
      .total-row {
        text-align: right;
        margin-top: 24px;
        margin-bottom: 24px;
      }
      .total-label {
        font-size: 1.15rem;
        color: #0D7C66;
        font-weight: 800;
        margin-right: 18px;
      }
      .total-amount {
        font-size: 1.35rem;
        color: #2563eb;
        font-weight: 800;
        letter-spacing: 0.5px;
      }
      .help-box {
        background: #EAFAEA;
        padding: 18px 20px;
        border-radius: 10px;
        color: #0D7C66;
        font-size: 1rem;
        margin-bottom: 18px;
        margin-top: 24px;
      }
      .footer {
        color: #64748b;
        font-size: 0.98rem;
        margin-top: 32px;
        text-align: center;
      }
      .footer .brand {
        color: #0D7C66;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <div class="invoice-header">
        <h1>Pillora</h1>
        <div class="subtitle">Order Invoice</div>
      </div>
      <div class="invoice-body">
        <div class="order-info">
          <div class="order-info-row">
            <span class="order-info-label">Order Number:</span>
            <span class="order-info-value">${order.orderNumber}</span>
          </div>
          <div class="order-info-row">
            <span class="order-info-label">Order Date:</span>
            <span class="order-info-value secondary">${new Date(order.createdAt || Date.now()).toLocaleDateString()}</span>
          </div>
          <div class="order-info-row">
            <span class="order-info-label">Customer Name:</span>
            <span class="order-info-value secondary">${order.customerName}</span>
          </div>
          <div class="order-info-row">
            <span class="order-info-label">Email:</span>
            <span class="order-info-value secondary">${order.customerEmail}</span>
          </div>
          <div class="order-info-row">
            <span class="order-info-label">Shipping Address:</span>
            <span class="order-info-value secondary">${order.shippingAddress}</span>
          </div>
          <div class="order-info-row">
            <span class="order-info-label">Payment Method:</span>
            <span class="order-info-value secondary" style="text-transform:capitalize;">${order.paymentMethod}</span>
          </div>
        </div>
        <div>
          <div class="products-title">Products Ordered</div>
          <table class="products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th class="item-qty">Qty</th>
                <th class="item-price">Unit Price</th>
                <th class="item-total">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
        <div class="total-row">
          <span class="total-label">Total (incl. GST):</span>
          <span class="total-amount">₹${order.totalAmount.toFixed(2)}</span>
        </div>
        <div class="help-box">
          <strong>Need help?</strong> Contact us at <a href="mailto:support@pillora.in" style="color:#2563eb;text-decoration:none;">support@pillora.in</a>
        </div>
        <div class="footer">
          You will receive your invoice as an attachment.<br>
          Thank you for choosing <span class="brand">Pillora</span>!
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
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
