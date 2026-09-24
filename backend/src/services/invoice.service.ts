import PDFDocument from 'pdfkit';
import { IOrder } from '../types';
import { env } from '../config/env';

const price = (value: number) => `INR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Contains personal address data: generate behind the order ownership guard,
 * stream with no-store, and never publish to a public media CDN or static path. */
export async function generateInvoiceBuffer(order: IOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const ink = '#163E64';
    const header = () => {
      doc.font('Helvetica-Bold').fontSize(23).fillColor(ink).text('NexMart', 48, 44);
      doc.font('Helvetica').fontSize(10).fillColor('#526779').text('ORDER RECEIPT', 48, 76);
      doc.moveTo(48, 98).lineTo(547, 98).strokeColor('#D5DDE5').stroke();
    };
    header();
    let y = 118;
    const line = (text: string, options: { bold?: boolean; color?: string } = {}) => {
      doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(options.color || '#243746');
      const height = doc.heightOfString(text, { width: 499 });
      if (y + height > 735) { doc.addPage(); header(); y = 118; }
      doc.text(text, 48, y, { width: 499 }); y += height + 7;
    };
    line(`Order ${order.orderId}`, { bold: true });
    line(`Placed ${new Date(order.createdAt).toLocaleDateString('en-IN')} | Payment: ${order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online'} / ${order.paymentStatus}`);
    line(`Fulfillment: ${order.orderStatus.replaceAll('_', ' ')}`);
    y += 8;
    line('Ship to', { bold: true });
    const address = order.shippingAddress;
    line(address.fullName);
    line([address.addressLine1, address.addressLine2, address.city, address.state, address.pincode, address.country].filter(Boolean).join(', '));
    y += 12;
    line('Items & purchase-time terms', { bold: true, color: ink });
    for (const item of order.items) {
      const productName = item.name || (item.product as { name?: string } | null)?.name || 'Ordered item';
      line(productName, { bold: true });
      line(`Option: ${item.variant} | Quantity: ${item.quantity} | Unit: ${price(item.unitPrice)} | Line: ${price(item.totalPrice)}`);
      if (item.purchaseTerms?.sellerName) line(`Sold by: ${item.purchaseTerms.sellerName}`);
      if (item.purchaseTerms?.returnWindowDays !== undefined) line(`Standard return window: ${item.purchaseTerms.returnWindowDays} days after delivery. See the order page for eligibility and support.`);
      if (item.taxRateBps !== undefined) line(`GST rate: ${item.taxRateBps / 100}% | Included tax: ${price((item.taxPaise || 0) / 100)}${item.hsnCode ? ` | HSN: ${item.hsnCode}` : ''}`);
      y += 8;
    }
    line(`Subtotal: ${price(order.subtotal)}`);
    line(`Delivery: ${price(order.shippingFee)}`);
    if (order.discount > 0) line(`Discount: -${price(order.discount)}`);
    if (order.taxStatus === 'complete') line(`Included GST: ${price(order.tax)}`);
    line(`Order total: ${price(order.total)}`, { bold: true, color: ink });
    if (order.refund) line(`Refund: ${order.refund.status.replaceAll('_', ' ')} | Amount: ${price(order.refund.amountPaise / 100)}${order.refund.refundId ? ` | Reference: ${order.refund.refundId}` : ''}`);
    y += 14;
    line('Prices include applicable taxes. This receipt records your order and payment status. It is not a statutory GST tax invoice; request the seller-issued tax invoice through order help.');
    line('For tracking, returns, refunds or support, sign in and open this order on NexMart.');
    const pages = doc.bufferedPageRange();
    for (let page = 0; page < pages.count; page++) {
      doc.switchToPage(page);
      doc.font('Helvetica').fontSize(8).fillColor('#526779').text(`${order.orderId} | Page ${page + 1} of ${pages.count}`, 48, 778, { width: 499, align: 'center', lineBreak: false });
    }
    doc.end();
  });
}

/** Compatibility for queued jobs: retain a private account link, never a
 * public PDF. The document is generated only on an authenticated download. */
export async function generateInvoicePdf(order: IOrder): Promise<string> {
  return `${env.APP_URL.replace(/\/$/, '')}/orders/${String(order._id)}`;
}
