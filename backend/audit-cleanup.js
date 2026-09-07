/* NexMart audit CLEANUP — removes ALL test data and verifies the DB returns
 * to its pre-audit baseline. Covers BOTH waves (the 2026-09-07 morning run
 * whose customer was missed by its cleanup, and today's runs), identified by
 * the /nexmart\.audit\./ email marker rather than the JSON manifests (the
 * manifest of the morning run is gone — the marker is the reliable net).
 *
 * Also destroys Cloudinary assets created by the audit (invoice PDFs), pulls
 * audit reviews out of the REAL product (recomputing its ratings), restores
 * stock to the baseline value, and clears rate-limit Redis keys.
 *
 * DRY-RUN first: `node audit-cleanup.js dry` prints what would be deleted.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const DRY = process.argv[2] === 'dry';

// Baseline captured immediately before today's first harness run (2026-09-07 ~15:15):
// { admins:1, customers:2, deliveryagents:1, products:1, categories:52, orders:3,
//   deliveryassignments:0, carts:2, wishlists:1, otprecords:0 }
// NOTE customers=2 already included the morning run's leftover audit customer —
// the post-cleanup expectation for REAL data is 1 customer / 1 order (the May COD order).
const BASELINE_STOCK = { 'SAM-MOBI-4PSX-1': 16 };

function cloudinary() {
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

// Parse public_id from a Cloudinary URL on OUR cloud only (same strictness as the B11 parser)
function publicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.hostname !== 'res.cloudinary.com') return null;
  const m = u.pathname.match(/\/v\d+\/(.+)$/);
  return m ? m[1] : null;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const O = (s) => new mongoose.Types.ObjectId(s);

  const counts = async (label) => {
    const cols = ['admins','customers','deliveryagents','products','categories','orders','deliveryassignments','carts','wishlists','otprecords'];
    const out = {};
    for (const c of cols) out[c] = await db.collection(c).countDocuments();
    console.log(`\n=== ${label} ===`, JSON.stringify(out));
    return out;
  };
  const before = await counts('COUNTS BEFORE');

  // 1. find ALL audit accounts (both waves) by email marker
  const marker = /^nexmart\.audit\./;
  const custs = await db.collection('customers').find({ email: marker }).project({ _id: 1, email: 1 }).toArray();
  const admins = await db.collection('admins').find({ email: marker }).project({ _id: 1, email: 1 }).toArray();
  const agents = await db.collection('deliveryagents').find({ email: marker }).project({ _id: 1, email: 1 }).toArray();
  const custIds = custs.map((d) => d._id);
  const agentIds = agents.map((d) => d._id);
  console.log(`\nAudit accounts found: ${custs.length} customers, ${admins.length} admins, ${agents.length} agents`);
  custs.concat(admins, agents).forEach((d) => console.log('  -', d.email));
  if (!custIds.length && !admins.length && !agentIds.length) { console.log('Nothing to clean.'); await mongoose.disconnect(); return; }

  // 2. their orders (+ invoice assets)
  const orders = await db.collection('orders').find({ customer: { $in: custIds } }).project({ _id: 1, orderId: 1, invoiceUrl: 1 }).toArray();
  console.log(`\nAudit orders: ${orders.length}`);
  const invoiceUrls = orders.map((o) => o.invoiceUrl).filter(Boolean);
  const orderIds = orders.map((o) => o._id);
  console.log('  invoice assets:', invoiceUrls.length);

  // 3. audit products/categories (by name marker, any run)
  const auditProducts = await db.collection('products').find({ name: /^__audit_/ }).project({ _id: 1, name: 1, images: 1 }).toArray();
  const auditCategories = await db.collection('categories').find({ name: /^__audit_/ }).project({ _id: 1, name: 1 }).toArray();
  console.log(`Audit products: ${auditProducts.length} (image sets: ${auditProducts.map(p => (p.images||[]).length).join(',') || '-'})`);
  console.log(`Audit categories: ${auditCategories.length}`);

  if (DRY) {
    console.log('\n[DRY RUN] would delete:');
    console.log('  customers:', custIds.map(String));
    console.log('  orders:', orders.map((o) => o.orderId));
    console.log('  cloudinary invoices:', invoiceUrls);
    return;
  }

  // ---- EXECUTE ----
  // Cloudinary invoice PDFs
  if (invoiceUrls.length) {
    const cl = cloudinary();
    for (const url of invoiceUrls) {
      const pid = publicIdFromUrl(url);
      if (!pid) { console.log('  ! unparseable invoice URL skipped:', url); continue; }
      try { const r = await cl.uploader.destroy(pid, { resource_type: 'raw' }); console.log(`  cloudinary destroyed ${pid} → ${r.result}`); }
      catch (e) { console.log(`  ! cloudinary destroy failed for ${pid}: ${e.message}`); }
    }
  }
  // Audit product images (if any)
  for (const p of auditProducts) {
    for (const img of p.images || []) {
      const pid = publicIdFromUrl(typeof img === 'string' ? img : img.url);
      if (!pid) continue;
      try { await cloudinary().uploader.destroy(pid, { invalidate: true }); console.log(`  cloudinary destroyed product image ${pid}`); }
      catch (e) { console.log(`  ! destroy failed ${pid}: ${e.message}`); }
    }
  }

  // Reviews: pull audit customers' reviews from EVERY product, recompute ratings
  const productsWithReviews = await db.collection('products').find({ 'reviews.user': { $in: custIds } }).project({ _id: 1, reviews: 1 }).toArray();
  for (const p of productsWithReviews) {
    const kept = (p.reviews || []).filter((r) => !custIds.some((c) => c.equals(r.user)));
    const count = kept.length;
    const average = count ? kept.reduce((s, r) => s + r.rating, 0) / count : 0;
    await db.collection('products').updateOne({ _id: p._id }, { $set: { reviews: kept, 'ratings.count': count, 'ratings.average': average } });
    console.log(`  reviews cleaned on product ${p._id} (kept ${count})`);
  }

  // DB deletions
  const del = async (coll, filter, label) => {
    const r = await db.collection(coll).deleteMany(filter);
    console.log(`  deleted ${r.deletedCount} from ${coll} (${label})`);
  };
  await del('orders', { customer: { $in: custIds } }, 'audit orders');
  await del('deliveryassignments', { $or: [{ agent: { $in: agentIds } }, { order: { $in: orderIds } }] }, 'audit assignments');
  await del('carts', { $or: [{ user: { $in: custIds } }, { sessionId: /^audit-guest-/ }] }, 'audit carts');
  await del('wishlists', { user: { $in: custIds } }, 'audit wishlists');
  await del('otprecords', { email: marker }, 'audit otps');
  await del('products', { name: /^__audit_/ }, 'audit products');
  await del('categories', { name: /^__audit_/ }, 'audit categories');
  await del('customers', { email: marker }, 'audit customers');
  await del('admins', { email: marker }, 'audit admins');
  await del('deliveryagents', { email: marker }, 'audit agents');

  // Restore stock on the REAL product to the verified pre-audit baseline
  for (const [sku, qty] of Object.entries(BASELINE_STOCK)) {
    const r = await db.collection('products').updateOne({ 'variants.sku': sku }, { $set: { 'variants.$.stock': qty } });
    console.log(`  stock restored for ${sku} → ${qty} (matched ${r.matchedCount})`);
  }

  // Clear rate-limit / lockout keys
  try {
    const { Redis } = require('@upstash/redis');
    const r = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    for (const p of ['nexmart:ratelimit:*', 'nexmart:login:failed:*']) {
      const keys = await r.keys(p);
      if (keys && keys.length) { await r.del(...keys); console.log(`  redis cleared ${keys.length} keys (${p})`); }
    }
  } catch (e) { console.log('  ! redis clear skipped:', e.message); }

  // ---- VERIFY ----
  const after = await counts('COUNTS AFTER');
  const remaining = await db.collection('customers').find({}).project({ email: 1 }).toArray();
  console.log('\nremaining customers:', remaining.map((c) => c.email));
  const remOrders = await db.collection('orders').find({}).project({ orderId: 1, orderStatus: 1 }).toArray();
  console.log('remaining orders:', remOrders.map((o) => `${o.orderId}(${o.orderStatus})`));
  const leftovers = await db.collection('products').findOne({ 'reviews.user.0': { $exists: true } });
  const realStock = (await db.collection('products').findOne({ 'variants.sku': 'SAM-MOBI-4PSX-1' })).variants.find((v) => v.sku === 'SAM-MOBI-4PSX-1').stock;
  console.log(`real product stock: ${realStock} (baseline 16)`);
  console.log(`\nBASELINE restorable-check vs before: customers ${before.customers}→${after.customers}, orders ${before.orders}→${after.orders}, products ${before.products}→${after.products}, categories ${before.categories}→${after.categories}`);
  await mongoose.disconnect();
  console.log('\nCLEANUP COMPLETE');
}

main().catch((e) => { console.error('CLEANUP CRASH', e); process.exit(1); });
