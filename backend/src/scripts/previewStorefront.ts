/** Isolated browser QA. Never connects to MONGODB_URI from the user's environment. */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

async function main() {
  if (!process.argv.includes('--isolated')) throw new Error('Use --isolated to start the disposable storefront preview.');
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' } });
  Object.assign(process.env, {
    NODE_ENV: 'test', MONGODB_URI: database.getUri(), PORT: '4100',
    APP_URL: 'http://localhost:3100', API_URL: 'http://localhost:4100', CORS_ORIGIN: 'http://localhost:3100', SOCKET_CORS_ORIGIN: 'http://localhost:3100',
    UPSTASH_REDIS_REST_URL: 'http://127.0.0.1:9', UPSTASH_REDIS_REST_TOKEN: 'preview-only',
    CLOUDINARY_CLOUD_NAME: 'preview-only', CLOUDINARY_API_KEY: 'preview-only', CLOUDINARY_API_SECRET: 'preview-only',
    RAZORPAY_KEY_ID: 'rzp_test_preview', RAZORPAY_KEY_SECRET: 'preview-only', RAZORPAY_WEBHOOK_SECRET: '',
    JWT_SECRET_ADMIN: 'isolated-preview-admin', JWT_SECRET_CUSTOMER: 'isolated-preview-customer', JWT_SECRET_AGENT: 'isolated-preview-agent', JWT_SECRET_SELLER: 'isolated-preview-seller',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '9', SMTP_USER: 'preview-only', SMTP_PASSWORD: 'preview-only', BREVO_API_KEY: '',
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', ADMIN_SEED_EMAIL: 'admin-preview@example.test', ADMIN_SEED_PASSWORD: 'PreviewOnly123', ADMIN_SECRET_KEY: 'isolated-preview-admin', IP_WHITELIST_ENABLED: 'false', LOG_LEVEL: 'error',
  });
  await mongoose.connect(database.getUri(), { dbName: 'isolated_storefront_preview' });
  const { seedDemoCatalog } = await import('../services/catalogSeed.service');
  const { Product } = await import('../models/Product');
  const { Category } = await import('../models/Category');
  const { Customer } = await import('../models/Customer');
  const { Admin } = await import('../models/Admin');
  const { DeliveryAgent } = await import('../models/DeliveryAgent');
  const { Seller } = await import('../models/Seller');
  const { SellerListing } = await import('../models/SellerListing');
  const { SellerInventory } = await import('../models/SellerInventory');
  const summary = await seedDemoCatalog(new mongoose.Types.ObjectId());
  const mobiles = await Category.findOne({ slug: 'mobiles' });
  const previewProduct = await Product.create({
    name: 'Preview · Samsung Galaxy S25', slug: 'preview-galaxy-s25', brand: 'Samsung', description: 'Isolated browser-test inventory. This fixture is never inserted by the starter catalog seed.',
    category: mobiles!._id, createdBy: new mongoose.Types.ObjectId(), isPublished: true, isFeatured: true,
    taxRateBps: 1800, hsnCode: '8517', returnWindowDays: 7,
    images: ['https://res.cloudinary.com/drb7nw0o9/image/upload/v1778443598/nexmart/products/dkkvcuvsbo3vgbicpzsb.jpg'],
    specifications: { Storage: '256 GB', RAM: '12 GB', Colour: 'Silver Shadow' },
    variants: [
      { sku: 'PREVIEW-128', attributes: { Storage: '128 GB' }, price: 45000, stock: 0 },
      { sku: 'PREVIEW-256', attributes: { Storage: '256 GB' }, price: 50000, stock: 16 },
      { sku: 'PREVIEW-512', attributes: { Storage: '512 GB' }, price: 62000, stock: 2 },
    ],
  });
  // Passwords are hashed by the calling controller in this codebase (the
  // Customer model has no pre-save hook) — hash here or login can never match.
  const previewBcrypt = (await import('bcryptjs')).default;
  const password = await previewBcrypt.hash('PreviewOnly123', 12);
  const customer = await Customer.create({ name: 'Preview Customer', email: 'preview@example.test', password, emailVerified: true });
  await Admin.create({ name: 'Preview Operator', email: 'admin-preview@example.test', password });
  await DeliveryAgent.create({ name: 'Preview Delivery', email: 'delivery-preview@example.test', password, status: 'approved', isApproved: true });
  const address = { fullName: 'Preview Customer', phone: '9876543210', addressLine1: '12 Preview Street', city: 'Kolkata', state: 'West Bengal', pincode: '700001', country: 'India' };
  const seller = await Seller.create({
    name: 'Preview Seller', email: 'seller-preview@example.test', password, phone: '9876543211', emailVerified: true,
    isActive: true, lifecycleStatus: 'active', legalBusinessName: 'Isolated QA Store', storefrontName: 'Preview Electronics',
    businessType: 'individual', pickupAddress: address, returnAddress: address,
  });
  const listing = await SellerListing.create({ seller: seller._id, canonicalProduct: previewProduct._id, canonicalVariantSku: 'PREVIEW-256', sellerSku: 'PREVIEW-SELLER-256', pricePaise: 4900000, status: 'published', handlingTimeDays: 2, returnWindowDays: 7 });
  const inventory = await SellerInventory.create({ seller: seller._id, listing: listing._id, available: 4 });
  listing.inventory = inventory._id;
  await listing.save();
  const books = await Category.findOne({ slug: 'books' });
  await Product.create({ name: 'Preview sample journal', slug: 'preview-sample-journal', description: 'Isolated sample fixture. Not for purchase.', category: books!._id, createdBy: new mongoose.Types.ObjectId(), isPublished: true, isDemo: true, images: ['/images/collections/books.webp'], variants: [{ sku: 'PREVIEW-SAMPLE', price: 299, stock: 0 }] });
  // Only this disposable process replaces rate-limit calls. Production is untouched.
  const redis = await import('../config/redis');
  for (const limiter of [redis.generalRateLimiter, redis.authRateLimiter, redis.paymentRateLimiter, redis.otpRateLimiter, redis.registrationRateLimiter]) {
    limiter.limit = async () => ({ success: true, limit: 10000, remaining: 9999, reset: Date.now() + 60000, pending: Promise.resolve() });
  }
  const { createOrder } = await import('../controllers/checkout.controller');
  const { Order } = await import('../models/Order');
  const { persistOrderLifecycle } = await import('../services/orderLifecycle.service');
  const orders: string[] = [];
  for (const sellerOrder of [true, false]) {
    let status = 200;
    let output: { data?: { orderId?: string }; message?: string } = {};
    const req = { body: { checkoutId: crypto.randomUUID(), items: [{ product: String(previewProduct._id), variant: 'PREVIEW-256', quantity: 1, expectedPrice: sellerOrder ? 49000 : 50000, ...(sellerOrder ? { listing: String(listing._id) } : {}) }], shippingAddress: address, paymentMethod: 'cod', expectedTotal: sellerOrder ? 49000 : 50000 }, user: { id: customer.id, userId: customer.id, role: 'customer' }, params: {}, query: {}, headers: {} };
    const res = { locals: {}, status(code: number) { status = code; return this; }, json(body: typeof output) { output = body; return this; } };
    await createOrder(req as unknown as import('express').Request, res as unknown as import('express').Response);
    if (status !== 201 || !output.data?.orderId) throw new Error(`Preview checkout failed: ${output.message || status}`);
    orders.push(output.data.orderId);
    if (!sellerOrder) {
      const order = (await Order.findById(output.data.orderId))!;
      order.orderStatus = 'delivered'; order.paymentStatus = 'paid';
      order.statusHistory.push({ status: 'delivered', timestamp: new Date(Date.now() - 86400000) } as typeof order.statusHistory[number]);
      await persistOrderLifecycle(order);
    }
  }
  const { createApp } = await import('../app');
  const server = createApp().listen(4100, '127.0.0.1', () => console.log(JSON.stringify({ preview: 'http://localhost:4100', database: 'disposable memory replica set', pid: process.pid, sellerId: String(seller._id), listingId: String(listing._id), orders, ...summary })));
  let closing = false;
  const close = async () => {
    if (closing) return; closing = true;
    server.closeAllConnections(); server.close();
    await mongoose.disconnect(); await database.stop(); process.exit(0);
  };
  process.on('SIGINT', () => void close());
  process.on('SIGTERM', () => void close());
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Preview failed'); process.exit(1); });
