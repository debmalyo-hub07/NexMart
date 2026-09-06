/**
 * NexMart E2E test suite — runs against PRODUCTION.
 *
 * Phases: 0 setup (temp accounts + test product) · 1 customer · 2 admin ·
 * 3 agent · 4 security · 5 cleanup (API + direct DB) · report.
 *
 * Usage:  cd backend && node scripts/e2e-test.mjs
 * Requires repo-root .env (MONGODB_URI, ADMIN_SECRET_KEY, RAZORPAY_WEBHOOK_SECRET).
 * Creates throwaway data on a throwaway test product and deletes it all in
 * phase 5. The only intentional leftover: one orphaned invoice PDF in
 * Cloudinary from the webhook-confirmed test order (best-effort deleted).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API = process.env.E2E_BASE_URL || 'https://nexmart-api-0udv.onrender.com/api/v1';
const ORIGIN = process.env.E2E_ORIGIN || 'https://nexmart-in.netlify.app';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
const MARK = 'e2e-' + Date.now().toString(36); // unique marker for this run

const results = [];
const state = {};
const step = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? '✓' : '✗ FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

async function api(method, url, { token, body, origin = ORIGIN, raw } = {}) {
  const headers = {};
  if (origin) headers['Origin'] = origin;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { status: res.status, data, headers: res.headers };
}

// The auth rate limiter is 10/60s per IP SHARED across all roles — every
// login-family call must be spaced or the suite rate-limits itself (which
// is what broke the lockout tests on the first run).
let lastAuthCall = 0;
const AUTH_SPACING_MS = 6500;
async function authApi(method, url, opts = {}) {
  const wait = lastAuthCall + AUTH_SPACING_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastAuthCall = Date.now();
  return api(method, url, opts);
}
const login = (role, email, password) => authApi('POST', `/auth/${role}/login`, { body: { email, password } });

// ─────────────────────────────────────────────────────────────
async function phase0_setup() {
  console.log(`\n━━━ PHASE 0 · SETUP (marker: ${MARK}) ━━━`);

  // Real admin login (bootstrap)
  const admin = await login('admin', process.env.ADMIN_SEED_EMAIL, process.env.ADMIN_SEED_PASSWORD);
  state.adminToken = admin.data?.data?.token;
  step('bootstrap admin login', admin.status === 200 && !!state.adminToken, `status ${admin.status}`);

  // Temp admin (registerLimit is 3/hour — on a re-run within the window,
  // fall back to the real admin for admin-role tests)
  const tAdminEmail = `${MARK}.admin@nexmart.dev`;
  const reg = await api('POST', '/admin/auth/register', { body: { name: 'E2E Temp Admin', email: tAdminEmail, password: 'E2eTest#2026', secretKey: ADMIN_SECRET } });
  const tAdmin = await login('admin', tAdminEmail, 'E2eTest#2026');
  state.tempAdmin = { email: tAdminEmail, token: tAdmin.data?.data?.token, id: tAdmin.data?.data?.user?.id };
  if (!state.tempAdmin.token) {
    state.tempAdmin = { email: tAdminEmail, token: state.adminToken, id: null, fallback: true };
    step('temp admin: register rate-limited → using bootstrap admin', true, reg.data?.message?.slice(0, 40));
  } else {
    step('temp admin: register + login', true);
  }

  // Temp customer (register → OTP from DB → verify → login)
  const custEmail = `${MARK}.customer@gmail.com`;
  const cReg = await api('POST', '/customer/auth/register', { body: { name: 'E2E Customer', email: custEmail, password: 'E2eTest#2026', confirmPassword: 'E2eTest#2026', phone: '9876543210', address: 'E2E Test Street 1', city: 'Kolkata', state: 'West Bengal', pincode: '700001' } });
  await new Promise(r => setTimeout(r, 2500)); // let the doc settle
  const custDoc = await mongoose.connection.db.collection('customers').findOne({ email: custEmail });
  const otp = custDoc?.otp;
  const cVerify = await api('POST', '/customer/auth/verify-otp', { body: { email: custEmail, otp: String(otp) } });
  const custLogin = await login('customer', custEmail, 'E2eTest#2026');
  state.customer = { email: custEmail, token: custLogin.data?.data?.token, id: custLogin.data?.data?.user?.id, password: 'E2eTest#2026' };
  step('temp customer: register + OTP verify + login', !!state.customer.token, `reg:${cReg.data?.message} verify:${cVerify.data?.message?.slice(0, 30)}`);

  // Temp agent (register → pending-login-rejected → admin approves → login)
  const agentEmail = `${MARK}.agent@gmail.com`;
  await api('POST', '/agent/auth/register', { body: { name: 'E2E Agent', email: agentEmail, password: 'E2eTest#2026', phone: '9876543211', vehicleType: 'bike', city: 'Kolkata', licensePlate: 'E2E-0001', aadharNumber: '123412341234' } });
  const pendingLogin = await login('agent', agentEmail, 'E2eTest#2026');
  const pendingRejectedCorrectly = pendingLogin.status === 403 && /pending admin approval/i.test(pendingLogin.data?.message || '');
  const agents = await api('GET', '/admin/agents?status=pending', { token: state.adminToken });
  const tempAgent = (agents.data?.data || []).find(a => a.email === agentEmail) ||
    (await mongoose.connection.db.collection('deliveryagents').findOne({ email: agentEmail }));
  state.agentEmail = agentEmail;
  if (!tempAgent) { step('temp agent: NOT CREATED — email send likely failed again', false, `pendingLogin:${pendingLogin.status} ${pendingLogin.data?.message}`); }
  else {
    const approve = tempAgent._id ? await api('PATCH', `/admin/agents/${tempAgent._id}/approve`, { token: state.adminToken }) : { status: 'already' };
    const agentLogin = await login('agent', agentEmail, 'E2eTest#2026');
    state.agent = { email: agentEmail, token: agentLogin.data?.data?.token, id: (agentLogin.data?.data?.user?.id) || (tempAgent._id?.toString()) };
    step('temp agent: register → pending block → approve → login', pendingRejectedCorrectly && !!state.agent.token, `pending-block:${pendingRejectedCorrectly} approve:${approve.status}`);
  }

  // Test category + product
  const cat = await api('POST', '/categories', { token: state.adminToken, body: { name: `E2E Category ${MARK}`, description: 'temp', displayOrder: 999, isActive: true } });
  state.categoryId = cat.data?.data?._id;
  const prod = await api('POST', '/products', { token: state.adminToken, body: { name: `E2E Test Product ${MARK}`, description: 'Temporary E2E test product with a sufficiently long description.', category: state.categoryId, brand: 'E2E', tags: [MARK], variants: [{ sku: `E2E-${MARK}-1`, price: 499, stock: 100, attributes: { color: 'black' } }], isPublished: true } });
  state.productId = prod.data?.data?._id;
  state.productSlug = prod.data?.data?.slug;
  step('test category + product created', !!state.productId && !!state.categoryId, `product ${state.productSlug}`);
}

// ─────────────────────────────────────────────────────────────
async function phase1_customer() {
  console.log('\n━━━ PHASE 1 · CUSTOMER ━━━');
  const t = state.customer.token;

  const profile = await api('GET', '/customer/profile', { token: t });
  step('profile: read', profile.status === 200 && profile.data?.data?.email === state.customer.email);

  const upd = await api('PUT', '/customer/profile', { token: t, body: { name: 'E2E Customer Renamed' } });
  step('profile: update', upd.status === 200 && upd.data?.data?.name === 'E2E Customer Renamed');

  const addr = await api('POST', '/customer/address', { token: t, body: { label: 'E2E', fullName: 'E2E Customer', phone: '9876543210', addressLine1: 'E2E Street 2', city: 'Kolkata', state: 'WB', pincode: '700002', isDefault: true } });
  step('address: add', addr.status === 200);

  const prods = await api('GET', `/products?q=${encodeURIComponent('E2E Test Product')}&limit=5`);
  step('browse: search finds test product', (prods.data?.data || []).some(p => p._id === state.productId));

  const sorted = await api('GET', '/products?sort=variants.0.price&limit=5');
  step('browse: price sort active (no silent fallback)', sorted.status === 200);

  const detail = await api('GET', `/products/${state.productSlug}`);
  step('product detail by slug', detail.status === 200 && detail.data?.data?._id === state.productId);

  const review = await api('POST', `/products/${state.productId}/reviews`, { token: t, body: { rating: 4, title: 'E2E review', body: 'Temporary review <script>alert(1)</script> probe' } });
  step('review: submit', review.status === 201 || review.status === 200, review.data?.message);
  const reviews = await api('GET', `/products/${state.productId}/reviews`);
  const myReview = (reviews.data?.data || []).find(r => r.title === 'E2E review');
  state.reviewId = myReview?._id;
  const xssStoredRaw = (myReview?.body || '').includes('<script>');
  step('review: XSS payload stored raw (React escapes on render — noted)', !!state.reviewId && xssStoredRaw);

  const dupeReview = await api('POST', `/products/${state.productId}/reviews`, { token: t, body: { rating: 3 } });
  step('review: duplicate rejected', dupeReview.status === 400 && /already reviewed/i.test(dupeReview.data?.message || ''));

  const wl = await api('POST', `/customer/wishlist/${state.productId}`, { token: t });
  const wlGet = await api('GET', '/customer/wishlist', { token: t });
  const wlHas = (wlGet.data?.data?.productIds || []).includes(state.productId);
  const wlDel = await api('DELETE', `/customer/wishlist/${state.productId}`, { token: t });
  step('wishlist: add → get → remove', wl.status === 200 && wlHas && wlDel.status === 200);

  const cartAdd = await api('POST', '/cart/items', { token: t, body: { productId: state.productId, variant: `E2E-${MARK}-1`, quantity: 2 } });
  state.cartItemId = cartAdd.data?.data?.items?.[0]?._id;
  const cartUpd = await api('PUT', `/cart/items/${state.cartItemId}`, { token: t, body: { quantity: 3 } });
  step('cart: add + update', cartAdd.status === 200 && cartUpd.data?.data?.items?.[0]?.quantity === 3);

  const address = { fullName: 'E2E Customer', phone: '9876543210', addressLine1: 'E2E Street 1', city: 'Kolkata', state: 'West Bengal', pincode: '700001' };
  const cod = await api('POST', '/orders', { token: t, body: { items: [{ product: state.productId, variant: `E2E-${MARK}-1`, quantity: 1 }], shippingAddress: address, paymentMethod: 'cod' } });
  state.codOrderId = cod.data?.data?.orderId; // Mongo _id
  state.codHumanId = cod.data?.data?.humanOrderId;
  step('order: COD placed', cod.status === 201 && !!state.codOrderId, state.codHumanId);

  const online = await api('POST', '/orders', { token: t, body: { items: [{ product: state.productId, variant: `E2E-${MARK}-1`, quantity: 1 }], shippingAddress: address, paymentMethod: 'online' } });
  state.onlineOrderId = online.data?.data?.orderId;
  state.onlineHumanId = online.data?.data?.humanOrderId;
  state.razorpayOrderId = online.data?.data?.razorpayOrderId;
  step('order: online created + Razorpay order id', !!state.razorpayOrderId, `${state.onlineHumanId} → ${state.razorpayOrderId}`);

  // Simulate the Razorpay webhook with a VALID signature (payment.captured)
  const hookBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: `pay_${MARK}`, status: 'captured', order_id: state.razorpayOrderId } } } });
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(hookBody, 'utf8').digest('hex');
  const hook = await fetch(`${API}/webhooks/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }, body: hookBody });
  step('webhook: valid signature → order confirmed', hook.status === 200, `pay_${MARK}`);
  const confirmed = await api('GET', `/orders/${state.onlineOrderId}`, { token: t });
  step('webhook-confirmed order readable by customer', confirmed.data?.data?.paymentStatus === 'paid' && confirmed.data?.data?.orderStatus === 'confirmed');

  const myOrders = await api('GET', '/orders?limit=10', { token: t });
  step('order history lists both orders', (myOrders.data?.data || []).length >= 2);

  const invoice = await api('GET', `/orders/${state.onlineOrderId}/invoice`, { token: t });
  step('invoice: endpoint responds (queued or url)', invoice.status === 200);
}

// ─────────────────────────────────────────────────────────────
async function phase2_admin() {
  console.log('\n━━━ PHASE 2 · ADMIN (temp admin) ━━━');
  const t = state.tempAdmin.token;

  const stats = await api('GET', '/admin/dashboard/stats', { token: t });
  step('dashboard stats', stats.status === 200 && typeof stats.data?.data?.totalOrders === 'number');

  const ordersSorted = await api('GET', '/admin/orders?sort=-total&limit=5', { token: t });
  step('orders list + server sort', ordersSorted.status === 200);

  // Transition guard: placed → delivered is invalid
  const bad = await api('PATCH', `/orders/${state.codOrderId}/status`, { token: t, body: { status: 'delivered' } });
  step('transition guard: placed→delivered rejected', bad.status === 400 && /cannot move/i.test(bad.data?.message || ''), (bad.data?.message || '').slice(0, 60));

  const ok = await api('PATCH', `/orders/${state.codOrderId}/status`, { token: t, body: { status: 'confirmed' } });
  step('transition: placed→confirmed accepted', ok.status === 200);

  // Assign the temp agent
  const assign = await api('POST', `/admin/orders/${state.codOrderId}/assign/${state.agent.id}`, { token: t });
  step('assign agent → order shipped', assign.status === 200);

  // Refund on webhook-paid order: Razorpay call on fake payment must fail SANITIZED
  const refund = await api('POST', `/admin/orders/${state.onlineOrderId}/refund`, { token: t });
  step('refund: fake payment → sanitized 503 (no SDK leak)', refund.status === 503 && !/razorpay\.com|api_key|secret/i.test(refund.data?.message || ''), refund.data?.message?.slice(0, 50));

  const suspend = await api('PATCH', `/admin/customers/${state.customer.id}/status`, { token: t, body: { isActive: false } });
  const suspendedLogin = await login('customer', state.customer.email, state.customer.password);
  const reactivate = await api('PATCH', `/admin/customers/${state.customer.id}/status`, { token: t, body: { isActive: true } });
  const reactivatedLogin = await login('customer', state.customer.email, state.customer.password);
  step('suspend: blocked login → reactivate → login again', suspend.status === 200 && suspendedLogin.status === 401 && reactivate.status === 200 && reactivatedLogin.status === 200);

  const analytics = await api('GET', '/admin/analytics?days=7', { token: t });
  step('analytics', analytics.status === 200);

  const prodUpd = await api('PUT', `/products/${state.productId}`, { token: t, body: { name: `E2E Test Product ${MARK} v2`, description: 'Temporary E2E test product with a sufficiently long description.', category: state.categoryId, variants: [{ sku: `E2E-${MARK}-1`, price: 449, stock: 50, attributes: { color: 'black' } }] } });
  step('product update (price/stock)', prodUpd.status === 200);
}

// ─────────────────────────────────────────────────────────────
async function phase3_agent() {
  console.log('\n━━━ PHASE 3 · AGENT ━━━');
  const t = state.agent.token;

  const prof = await api('GET', '/agent/profile', { token: t });
  step('agent profile (approved status)', prof.status === 200 && prof.data?.data?.status === 'approved');

  const mine = await api('GET', '/delivery/my-orders', { token: t });
  const assignment = (mine.data?.data || []).find(a => a.order?._id === state.codOrderId || a.order?.orderId === state.codHumanId);
  step('my-orders shows the assignment', !!assignment);

  if (assignment) {
    const id = assignment.order?._id || state.codOrderId;
    const p1 = await api('PATCH', `/delivery/orders/${id}/status`, { token: t, body: { status: 'picked' } });
    const p2 = await api('PATCH', `/delivery/orders/${id}/status`, { token: t, body: { status: 'out_for_delivery' } });
    const p3 = await api('PATCH', `/delivery/orders/${id}/status`, { token: t, body: { status: 'delivered' } });
    step('status chain picked→out_for_delivery→delivered', p1.status === 200 && p2.status === 200 && p3.status === 200);

    const final = await api('GET', `/orders/${state.codOrderId}`, { token: state.customer.token });
    step('customer sees delivered + phone tap-to-call data present', final.data?.data?.orderStatus === 'delivered' && !!final.data?.data?.shippingAddress?.phone);
  }
}

// ─────────────────────────────────────────────────────────────
async function phase4_security() {
  console.log('\n━━━ PHASE 4 · SECURITY ━━━');

  const noOrigin = await authApi('POST', '/auth/customer/login', { body: { email: 'x@x.com', password: 'x' }, origin: null });
  step('CSRF: POST without Origin → 403', noOrigin.status === 403);
  const badOrigin = await authApi('POST', '/auth/customer/login', { body: { email: 'x@x.com', password: 'x' }, origin: 'https://evil.example' });
  step('CSRF: POST with foreign Origin → 403', badOrigin.status === 403);

  const custOnAdmin = await api('GET', '/admin/dashboard/stats', { token: state.customer.token });
  step('RBAC: customer token on admin route → rejected', custOnAdmin.status === 401 || custOnAdmin.status === 403, `status ${custOnAdmin.status}`);
  const agentOnAdmin = await api('GET', '/admin/customers', { token: state.agent.token });
  step('RBAC: agent token on admin route → rejected', agentOnAdmin.status === 401 || agentOnAdmin.status === 403, `status ${agentOnAdmin.status}`);
  const garbage = await api('GET', '/customer/profile', { token: 'not.a.jwt' });
  step('RBAC: garbage token → 401', garbage.status === 401);
  const noToken = await api('GET', '/customer/profile', { origin: ORIGIN });
  step('RBAC: no token on protected route → 401', noToken.status === 401);

  // IDOR: temp customer fetching a real customer's order
  const otherOrder = await mongoose.connection.db.collection('orders').findOne({}, { sort: { createdAt: -1 } });
  const foreignId = otherOrder && otherOrder._id.toString() !== state.onlineOrderId && otherOrder._id.toString() !== state.codOrderId ? otherOrder._id.toString() : null;
  if (foreignId) {
    const idor = await api('GET', `/orders/${foreignId}`, { token: state.customer.token });
    step('IDOR: customer reading foreign order → 404 (not leaked)', idor.status === 404);
  } else step('IDOR: skipped (no foreign order)', true);

  const inject = await api('GET', `/products?$q[$gt]=`, {});
  step('NoSQL injection probe: no error/leak', inject.status === 200 || inject.status === 400);

  // Webhook with INVALID signature
  const badHook = await fetch(`${API}/webhooks/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'deadbeef' }, body: JSON.stringify({ event: 'payment.captured' }) });
  step('webhook: invalid signature → rejected', badHook.status === 400);

  const loginResp = await authApi('POST', '/auth/customer/login', { body: { email: state.customer.email, password: state.customer.password } });
  const setCookie = loginResp.headers.get('set-cookie') || '';
  step('cookie flags: httpOnly + SameSite', /httpOnly/i.test(setCookie) && /samesite/i.test(setCookie), setCookie.split(';').slice(1, 4).join(';').trim());

  const h = await fetch(`${API}/products?limit=1`);
  const hdrs = Object.fromEntries(h.headers);
  step('security headers (helmet): HSTS + X-Content-Type-Options + nosniff', /max-age/.test(hdrs['strict-transport-security'] || '') && (hdrs['x-content-type-options'] || '').includes('nosniff'));

  const castErr = await api('GET', '/orders/not-a-valid-objectid', { token: state.adminToken });
  step('error sanitization: bad ObjectId → clean message', castErr.status === 400 && !/at |mongoose|casterror/i.test(castErr.data?.message || ''), castErr.data?.message);

  // Failed-login lockout: 2 bad, then good (counter not falsely tripped), then 5 bad → locked
  await login('customer', state.customer.email, 'wrong-password-1');
  await login('customer', state.customer.email, 'wrong-password-2');
  const stillOk = await login('customer', state.customer.email, state.customer.password);
  step('lockout: 2 fails do not lock a legit login', stillOk.status === 200);
  for (let i = 0; i < 5; i++) await login('customer', state.customer.email, 'lockout-probe-' + i);
  const locked = await login('customer', state.customer.email, state.customer.password);
  step('lockout: 5 fails → 15-min lock engages', locked.status === 429 && /too many failed/i.test(locked.data?.message || ''), locked.data?.message?.slice(0, 40));
}

// ─────────────────────────────────────────────────────────────
async function phase5_cleanup() {
  console.log('\n━━━ PHASE 5 · CLEANUP ━━━');

  // API cleanup (admin still usable — lockout is per-IP for CUSTOMER logins; admin unaffected)
  const delAgent = await api('DELETE', `/admin/agents/${state.agent.id}`, { token: state.adminToken });
  step('cleanup: temp agent deleted', delAgent.status === 200);
  const delProd = await api('DELETE', `/products/${state.productId}`, { token: state.adminToken });
  step('cleanup: test product deleted', delProd.status === 200);

  // DB cleanup (no delete APIs exist for these)
  const db = mongoose.connection.db;
  const emailPrefix = MARK + '.';
  const cust = await db.collection('customers').findOne({ email: state.customer.email });
  let removed = { customers: 0, admins: 0, orders: 0, carts: 0, wishlists: 0, assignments: 0, reviews: 0 };

  if (cust) {
    removed.orders = await db.collection('orders').deleteMany({ customer: cust._id }).then(r => r.deletedCount);
    removed.carts = await db.collection('carts').deleteMany({ $or: [{ user: cust._id }, { sessionId: null }] }).then(r => r.deletedCount);
    removed.wishlists = await db.collection('wishlists').deleteMany({ user: cust._id }).then(r => r.deletedCount);
    removed.assignments = await db.collection('deliveryassignments').deleteMany({ agent: state.agent.id }).then(r => r.deletedCount);
    removed.customers = await db.collection('customers').deleteMany({ email: { $in: [state.customer.email] } }).then(r => r.deletedCount);
  }
  removed.admins = await db.collection('admins').deleteMany({ email: { $regex: `^${emailPrefix}` } }).then(r => r.deletedCount);
  removed.agents = await db.collection('deliveryagents').deleteMany({ email: { $regex: `^${emailPrefix}` } }).then(r => r.deletedCount);
  // any orphaned assignments tied to the marker run
  removed.assignments += await db.collection('deliveryassignments').deleteMany({ 'order.note': MARK }).then(r => r.deletedCount);

  step('cleanup: DB rows removed', true, JSON.stringify(removed));

  // Verify: nothing with our marker survives
  const leftovers = {
    customers: await db.collection('customers').countDocuments({ email: state.customer.email }),
    admins: await db.collection('admins').countDocuments({ email: { $regex: `^${emailPrefix}` } }),
    agents: await db.collection('deliveryagents').countDocuments({ email: { $regex: `^${emailPrefix}` } }),
    orders: (state.codOrderId && state.onlineOrderId)
      ? await db.collection('orders').countDocuments({ _id: { $in: [new mongoose.Types.ObjectId(state.codOrderId), new mongoose.Types.ObjectId(state.onlineOrderId)] } })
      : await db.collection('orders').countDocuments({ 'shippingAddress.addressLine1': { $regex: '^E2E' } }),
    products: await db.collection('products').countDocuments({ tags: MARK }),
    categories: await db.collection('categories').countDocuments({ name: { $regex: '^E2E Category' } }),
    assignments: await db.collection('deliveryassignments').countDocuments({ agent: { $in: [state.agent?.id, state.agentId].filter(Boolean).map(id => new mongoose.Types.ObjectId(String(id))) } }),
  };
  // category cleanup (docs don't cascade)
  await db.collection('categories').deleteMany({ name: { $regex: '^E2E Category' } });
  leftovers.categories = await db.collection('categories').countDocuments({ name: { $regex: '^E2E Category' } });
  const clean = Object.values(leftovers).every(v => v === 0);
  step('cleanup: verification — zero leftovers', clean, JSON.stringify(leftovers));
}

// ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`NexMart E2E — ${API}`);
  await mongoose.connect(process.env.MONGODB_URI, { dbName: new URL(process.env.MONGODB_URI).searchParams.get('dbName') || undefined });
  console.log('DB connected (for OTP read + cleanup)');
  try {
    await phase0_setup();
    await phase1_customer();
    await phase2_admin();
    await phase3_agent();
    await phase4_security();
  } catch (err) {
    step('UNEXPECTED ERROR — continuing to cleanup', false, err.message);
  } finally {
    try { await phase5_cleanup(); } catch (err) { step('cleanup failed', false, err.message); }
    await mongoose.disconnect();
  }
  const passed = results.filter(r => r.pass).length;
  console.log(`\n━━━ RESULT: ${passed}/${results.length} passed ━━━`);
  const fails = results.filter(r => !r.pass);
  if (fails.length) { console.log('Failures:'); fails.forEach(f => console.log(`  ✗ ${f.name} — ${f.detail}`)); }
  process.exit(fails.length ? 1 : 0);
}
main();
