import PDFDocument from 'pdfkit';
import { IOrder } from '../types';
import { uploadPdfBuffer } from './cloudinary.service';
import { env } from '../config/env';
import path from 'path';
import fs from 'fs';

export async function generateInvoicePdf(order: IOrder & {
  customer: { name: string; email?: string; phone?: string };
  items: Array<{
    product: { name: string };
    variant: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}): Promise<string> {
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ────────────────────────────────────────────────
    doc
      .fontSize(24)
      .fillColor('#7C3AED')
      .text('NexMart', 50, 50)
      .fontSize(10)
      .fillColor('#666')
      .text('Tax Invoice', 50, 80);

    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#7C3AED').stroke();

    // ── Order Info ────────────────────────────────────────────
    doc.fontSize(11).fillColor('#333');
    doc.text(`Order ID: ${order.orderId}`, 50, 120);
    doc.text(`Delivery ID: ${order.deliveryId || 'N/A'}`, 50, 138);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 50, 156);
    doc.text(`Payment: ${order.paymentMethod.toUpperCase()} — ${order.paymentStatus.toUpperCase()}`, 50, 174);

    // ── Customer Info ─────────────────────────────────────────
    doc.fontSize(11).fillColor('#7C3AED').text('Bill To:', 350, 120);
    doc.fillColor('#333');
    doc.text(order.customer.name, 350, 138);
    if (order.customer.email) doc.text(order.customer.email, 350, 156);
    if (order.customer.phone) doc.text(order.customer.phone, 350, 174);

    const addr = order.shippingAddress;
    doc.text(`${addr.addressLine1}`, 350, 192);
    doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, 350, 210);

    // ── Table Header ──────────────────────────────────────────
    let y = 260;
    doc.moveTo(50, y - 10).lineTo(545, y - 10).strokeColor('#eee').stroke();
    doc.fontSize(10).fillColor('#fff');
    doc.rect(50, y - 10, 495, 22).fill('#7C3AED').stroke();
    doc.fillColor('#fff');
    doc.text('Item', 55, y - 3);
    doc.text('SKU', 270, y - 3);
    doc.text('Qty', 350, y - 3);
    doc.text('Unit Price', 390, y - 3);
    doc.text('Total', 480, y - 3);

    // ── Line Items ────────────────────────────────────────────
    y += 22;
    doc.fillColor('#333').fontSize(10);
    for (const item of order.items) {
      const productName = (item.product as { name: string }).name || 'Product';
      doc.text(productName.substring(0, 30), 55, y);
      doc.text(item.variant, 270, y);
      doc.text(String(item.quantity), 350, y);
      doc.text(`₹${item.unitPrice.toFixed(2)}`, 390, y);
      doc.text(`₹${item.totalPrice.toFixed(2)}`, 480, y);
      y += 22;
      doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#f0f0f0').stroke();
    }

    // ── Totals ────────────────────────────────────────────────
    y += 10;
    doc.fontSize(10).fillColor('#666');
    doc.text('Subtotal:', 390, y); doc.text(`₹${order.subtotal.toFixed(2)}`, 480, y); y += 18;
    doc.text('Shipping:', 390, y); doc.text(`₹${order.shippingFee.toFixed(2)}`, 480, y); y += 18;
    doc.text('Tax (GST):', 390, y); doc.text(`₹${order.tax.toFixed(2)}`, 480, y); y += 18;
    if (order.discount > 0) {
      doc.text('Discount:', 390, y); doc.text(`-₹${order.discount.toFixed(2)}`, 480, y); y += 18;
    }
    doc.moveTo(390, y).lineTo(545, y).strokeColor('#7C3AED').stroke(); y += 8;
    doc.fontSize(12).fillColor('#7C3AED').font('Helvetica-Bold');
    doc.text('Total:', 390, y); doc.text(`₹${order.total.toFixed(2)}`, 480, y);

    // ── Footer ────────────────────────────────────────────────
    doc.fontSize(9).fillColor('#999').font('Helvetica');
    doc.text('Thank you for shopping with NexMart!', 50, 760, { align: 'center', width: 495 });
    doc.text('This is a computer-generated invoice and does not require a signature.', 50, 775, { align: 'center', width: 495 });

    doc.end();
  });

  if (env.INVOICE_STORAGE === 'cloudinary') {
    const result = await uploadPdfBuffer(buffer, 'invoices', `invoice_${order.orderId}`);
    return result.url;
  } else {
    // Local storage for dev
    const invoicesDir = path.join(process.cwd(), 'invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    const filePath = path.join(invoicesDir, `invoice_${order.orderId}.pdf`);
    fs.writeFileSync(filePath, buffer);
    return `${env.API_URL}/invoices/invoice_${order.orderId}.pdf`;
  }
}
