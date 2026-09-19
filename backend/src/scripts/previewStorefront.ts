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
    GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', ADMIN_SEED_EMAIL: 'preview@example.test', ADMIN_SEED_PASSWORD: 'PreviewOnly123', ADMIN_SECRET_KEY: 'isolated-preview-admin', LOG_LEVEL: 'error',
  });
  await mongoose.connect(database.getUri(), { dbName: 'isolated_storefront_preview' });
  const { seedDemoCatalog } = await import('../services/catalogSeed.service');
  const { Product } = await import('../models/Product');
  const { Category } = await import('../models/Category');
  const { Customer } = await import('../models/Customer');
  const summary = await seedDemoCatalog(new mongoose.Types.ObjectId());
  const mobiles = await Category.findOne({ slug: 'mobiles' });
  await Product.create({
    name: 'Preview · Samsung Galaxy S25', slug: 'preview-galaxy-s25', brand: 'Samsung', description: 'Isolated browser-test inventory. This fixture is never inserted by the starter catalog seed.',
    category: mobiles!._id, createdBy: new mongoose.Types.ObjectId(), isPublished: true, isFeatured: true,
    images: ['https://res.cloudinary.com/drb7nw0o9/image/upload/v1778443598/nexmart/products/dkkvcuvsbo3vgbicpzsb.jpg'],
    specifications: { Storage: '256 GB', RAM: '12 GB', Colour: 'Silver Shadow' },
    variants: [
      { sku: 'PREVIEW-128', attributes: { Storage: '128 GB' }, price: 45000, stock: 0 },
      { sku: 'PREVIEW-256', attributes: { Storage: '256 GB' }, price: 50000, stock: 16 },
      { sku: 'PREVIEW-512', attributes: { Storage: '512 GB' }, price: 62000, stock: 2 },
    ],
  });
  await Customer.create({ name: 'Preview Customer', email: 'preview@example.test', password: 'PreviewOnly123', emailVerified: true });
  // Only this disposable process replaces rate-limit calls. Production is untouched.
  const redis = await import('../config/redis');
  for (const limiter of [redis.generalRateLimiter, redis.authRateLimiter, redis.paymentRateLimiter, redis.otpRateLimiter, redis.registrationRateLimiter]) {
    limiter.limit = async () => ({ success: true, limit: 10000, remaining: 9999, reset: Date.now() + 60000, pending: Promise.resolve() });
  }
  const { createApp } = await import('../app');
  const server = createApp().listen(4100, '127.0.0.1', () => console.log(JSON.stringify({ preview: 'http://localhost:4100', database: 'disposable memory replica set', pid: process.pid, ...summary })));
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
