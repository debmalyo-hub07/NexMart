/* NexMart audit EXTENSION harness (run after audit-harness.js).
 * Focus: live socket data-flow tracing, webhook E2E, and flaw probes NOT in
 * the first harness. Reuses the accounts created by run 1 (looked up by the
 * nexmart.audit.* email marker in Mongo). Socket client is borrowed from
 * frontend/node_modules. Writes audit-results2.json / audit-created2.json.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { io } = require(path.resolve(__dirname, '../frontend/node_modules/socket.io-client'));

const API = 'http://localhost:4000/api/v1';
const ORIGIN = 'http://localhost:3000';
const results = [];
const created = { orders: [], carts: [] };
let PASS = 0, FAIL = 0, INFO = 0;

function log(area, name, ok, detail) {
  const tag = ok === true ? 'PASS' : ok === false ? 'FAIL' : 'INFO';
  if (ok === true) PASS++; else if (ok === false) FAIL++; else INFO++;
  results.push({ area, name, tag, detail });
  const c = ok === true ? '\x1b[32m' : ok === false ? '\x1b[31m' : '\x1b[36m';
  console.log(`${c}[${tag}]\x1b[0m ${area} :: ${name}${detail ? ' — ' + detail : ''}`);
}

async function req(method, url, { token, body, headers, noOrigin, sessionId, raw } = {}) {
  const h = { ...(headers || {}) };
  if (!noOrigin) h['Origin'] = ORIGIN;
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (sessionId) h['x-session-id'] = sessionId;
  try {
    const res = await axios({ method, url: API + url, data: body, headers: h, validateStatus: () => true, timeout: 15000 });
    return { status: res.status, data: res.data };
  } catch (e) {
    return { status: 0, data: { message: e.message } };
  }
}

let db;
async function connectDb() { await mongoose.connect(process.env.MONGODB_URI); db = mongoose.connection.db; }
let _redis;
function redis() {
  if (!_redis) {
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return _redis;
}
async function clearLimits() {
  try {
    const r = redis();
    for (const p of ['nexmart:ratelimit:*', 'nexmart:login:failed:*']) {
      const keys = await r.keys(p);
      if (keys && keys.length) await r.del(...keys);
    }
  } catch { /* fail-open */ }
}

const state = {};
const addr = { fullName: 'Audit Cust', phone: '9876500001', addressLine1: '1 Test St', city: 'Kolkata', state: 'West Bengal', pincode: '700001', country: 'India' };

// ---- socket helpers ----
function connectSocket(token, label) {
  const s = io('http://localhost:4000', { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, timeout: 6000 });
  const bag = { label, events: [], s };
  s.onAny((ev, payload) => bag.events.push({ ev, payload, t: Date.now() }));
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`${label} socket connect timeout`)), 6000);
    s.on('connect', () => { clearTimeout(to); resolve(bag); });
    s.on('connect_error', (e) => { clearTimeout(to); resolve({ label, error: e.message, events: [], s }); });
  });
}
function waitForEvent(bag, ev, matchId, ms = 6000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const iv = setInterval(() => {
      const hit = bag.events.find((e) => e.ev === ev && (!matchId || e.payload?.orderId === matchId));
      if (hit) { clearInterval(iv); resolve(hit); }
      else if (Date.now() - started > ms) { clearInterval(iv); resolve(null); }
    }, 100);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await connectDb();
  console.log(`\n================ NexMart AUDIT-EXTENSION ================\n`);

  // ---- reuse run-1 accounts ----
  const cust = await db.collection('customers').findOne({ email: /^nexmart\.audit\./ });
  const admin = await db.collection('admins').findOne({ email: /^nexmart\.audit\./ });
  const agent = await db.collection('deliveryagents').findOne({ email: /^nexmart\.audit\./ });
  const product = await db.collection('products').findOne({ name: /^__audit_/ }) || await db.collection('products').findOne({ isPublished: true });
  const realProduct = await db.collection('products').findOne({ isPublished: true, name: { $not: /^__audit_/ } });
  state.sku = realProduct.variants[0].sku;
  state.pid = realProduct._id.toString();
  state.stock0 = realProduct.variants[0].stock;
  log('setup', 'run-1 accounts + products located', !!(cust && admin && agent), `cust=${cust.email} agent=${agent.email}`);

  await clearLimits();
  for (const [role, email, pass, key] of [['customer', cust.email, 'NewAudit@123', 'custToken'], ['admin', admin.email, 'AdminAudit@123', 'adminToken'], ['agent', agent.email, 'AgentAudit@123', 'agentToken']]) {
    const fam = role === 'agent' ? '/auth/delivery/login' : `/auth/${role}/login`;
    const r = await req('POST', fam, { body: { email, password: pass } });
    state[key] = r.data?.data?.token;
    log('setup', `relogin ${role}`, !!state[key], `status=${r.status}`);
  }
  state.custId = cust._id.toString();
  state.agentId = agent._id.toString();
  state.agentName = agent.name;
  _custEmail = cust.email;

  await phaseSockets();
  await clearLimits();
  await phaseWebhookE2E();
  await clearLimits();
  await phaseFlaws();

  const fs = require('fs');
  fs.writeFileSync(path.resolve(__dirname, 'audit-results2.json'), JSON.stringify({ results, summary: { PASS, FAIL, INFO }, created }, null, 2));
  fs.writeFileSync(path.resolve(__dirname, 'audit-created2.json'), JSON.stringify(created, null, 2));
  console.log(`\n================ EXT-SUMMARY: ${PASS} PASS · ${FAIL} FAIL · ${INFO} INFO ================`);
  await mongoose.disconnect();
}

// ============ SOCKET DATA-FLOW (§5.1 contract, live) ============
async function phaseSockets() {
  const A = 'socket-flow';
  let bags = {};
  try {
    bags.admin = await connectSocket(state.adminToken, 'admin');
    bags.cust = await connectSocket(state.custToken, 'customer');
    bags.agent = await connectSocket(state.agentToken, 'agent');
    bags.guest = await connectSocket(null, 'guest');
    bags.bad = await connectSocket('invalid.token.here', 'badtoken');
  } catch (e) { log(A, 'socket connect', false, e.message); return; }

  log(A, 'invalid-token socket rejected', !!bags.bad.error && /invalid|expired/i.test(bags.bad.error), `err=${bags.bad.error}`);
  log(A, 'guest socket allowed (public events only)', !!bags.guest.s && bags.guest.s.connected, 'connected as guest role');

  // 1. customer places COD order → admin 'order:new'
  let r = await req('POST', '/orders', { token: state.custToken, body: { items: [{ product: state.pid, variant: state.sku, quantity: 1 }], shippingAddress: addr, paymentMethod: 'cod' } });
  const ordId = r.data?.data?.orderId;
  const humanId = r.data?.data?.humanOrderId;
  if (ordId) created.orders.push(ordId);
  state.sockOrderId = ordId;
  log(A, 'order create for socket test', r.status === 201, `status=${r.status} human=${humanId}`);

  const evNew = await waitForEvent(bags.admin, 'order:new', humanId);
  log(A, "admin room receives 'order:new' on order create", !!evNew && evNew.payload.orderId === humanId, `payload=${evNew ? JSON.stringify(evNew.payload) : 'none'}`);

  const guestLeak = bags.guest.events.find((e) => e.ev === 'order:new');
  log(A, 'guest socket does NOT receive order:new', !guestLeak, guestLeak ? 'LEAK' : 'no leak');

  // 2. admin confirms → customer + admin 'order:status_updated'
  r = await req('PATCH', `/orders/${ordId}/status`, { token: state.adminToken, body: { status: 'confirmed' } });
  const evC1 = await waitForEvent(bags.cust, 'order:status_updated', humanId);
  const evC2 = await waitForEvent(bags.admin, 'order:status_updated', humanId);
  log(A, "customer receives 'order:status_updated' (confirmed)", !!evC1 && evC1.payload.status === 'confirmed', `payload=${evC1 ? JSON.stringify(evC1.payload) : 'none'}`);
  log(A, "admin receives 'order:status_updated'", !!evC2 && evC2.payload.status === 'confirmed', `payload=${evC2 ? JSON.stringify(evC2.payload) : 'none'}`);

  // 3. admin assigns agent → agent 'delivery:assigned'
  r = await req('POST', `/admin/orders/${ordId}/assign/${state.agentId}`, { token: state.adminToken });
  const evA = await waitForEvent(bags.agent, 'delivery:assigned', humanId);
  log(A, "agent receives 'delivery:assigned'", !!evA && evA.payload.orderId === humanId, `payload=${evA ? JSON.stringify(evA.payload) : 'none'}`);
  state.sockAssignmentMade = r.status === 200;

  // 4. agent walks to delivered → customer gets each transition
  for (const st of ['picked', 'out_for_delivery', 'delivered']) {
    await req('PATCH', `/delivery/orders/${ordId}/status`, { token: state.agentToken, body: { status: st } });
  }
  const evD = await waitForEvent(bags.cust, 'order:status_updated', humanId, 4000);
  log(A, "customer receives final 'order:status_updated' (delivered)", !!evD && evD.payload.status === 'delivered', `payload=${evD ? JSON.stringify(evD.payload) : 'none'}`);

  // 5. history purity: no duplicate consecutive entries (B2 regression)
  const odoc = await db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(ordId) });
  const hist = odoc.statusHistory.map((h) => h.status);
  const dups = hist.filter((s, i) => i > 0 && s === hist[i - 1]);
  log(A, 'no duplicate consecutive statusHistory entries', dups.length === 0, `history=${hist.join(' → ')}`);

  // 6. emitAgentStatusUpdate dead-code check: admin approves/reject cycles another agent? none left — report code-level
  log(A, "'agent:status_updated' emitter has zero call sites", null, 'grep: emitAgentStatusUpdate defined in socket.ts but never imported by any controller — event is dead code (email is the channel; frontend polls)');

  for (const b of Object.values(bags)) b.s?.close?.();
}

// ============ WEBHOOK E2E (simulate Razorpay delivery) ============
async function phaseWebhookE2E() {
  const A = 'webhook-e2e';
  // fresh pending online order
  let r = await req('POST', '/orders', { token: state.custToken, body: { items: [{ product: state.pid, variant: state.sku, quantity: 1 }], shippingAddress: addr, paymentMethod: 'online' } });
  const ordId = r.data.data?.orderId;
  const rzpId = r.data.data?.razorpayOrderId;
  if (ordId) created.orders.push(ordId);
  state.whOrderId = ordId;
  log(A, 'online order created for webhook test', !!rzpId, `rzp=${rzpId}`);

  // forge a correctly-signed payment.captured payload (as Razorpay would deliver)
  const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { order_id: rzpId, id: `pay_whaudit_${Date.now()}`, method: 'upi', amount: 5900000 } } } });
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(payload).digest('hex');
  const res = await axios({ method: 'POST', url: API + '/webhooks/razorpay', data: payload, headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig, Origin: ORIGIN }, validateStatus: () => true });
  log(A, 'signed payment.captured accepted (200)', res.status === 200, `status=${res.status}`);

  await sleep(800);
  let doc = await db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(ordId) });
  log(A, 'webhook marks paid + confirmed + deliveryId + paymentId', doc.paymentStatus === 'paid' && doc.orderStatus === 'confirmed' && !!doc.deliveryId && !!doc.razorpayPaymentId, `pay=${doc.paymentStatus} order=${doc.orderStatus} del=${!!doc.deliveryId}`);
  const whNote = doc.statusHistory.find((h) => /Razorpay webhook/.test(h.note || ''));
  log(A, "statusHistory carries 'Confirmed via Razorpay webhook' note", !!whNote, `note=${whNote?.note}`);

  // replay → idempotent, no duplicate history
  const res2 = await axios({ method: 'POST', url: API + '/webhooks/razorpay', data: payload, headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig, Origin: ORIGIN }, validateStatus: () => true });
  await sleep(500);
  doc = await db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(ordId) });
  const notes = doc.statusHistory.filter((h) => /Razorpay webhook/.test(h.note || '')).length;
  log(A, 'webhook replay is idempotent (no duplicate history)', res2.status === 200 && notes === 1, `notes=${notes}`);

  // wrong secret → 400
  const badSig = crypto.createHmac('sha256', 'wrong-secret').update(payload).digest('hex');
  const res3 = await axios({ method: 'POST', url: API + '/webhooks/razorpay', data: payload, headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': badSig, Origin: ORIGIN }, validateStatus: () => true });
  log(A, 'wrong-secret signature rejected 400', res3.status === 400, `status=${res3.status}`);

  // payment.failed marks pending → failed (scoped)
  let r2 = await req('POST', '/orders', { token: state.custToken, body: { items: [{ product: state.pid, variant: state.sku, quantity: 1 }], shippingAddress: addr, paymentMethod: 'online' } });
  const ordId2 = r2.data.data?.orderId;
  const rzpId2 = r2.data.data?.razorpayOrderId;
  if (ordId2) created.orders.push(ordId2);
  const failPayload = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { order_id: rzpId2, id: 'pay_fail_audit', status: 'failed' } } } });
  const fsig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(failPayload).digest('hex');
  await axios({ method: 'POST', url: API + '/webhooks/razorpay', data: failPayload, headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': fsig, Origin: ORIGIN }, validateStatus: () => true });
  await sleep(500);
  const doc2 = await db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(ordId2) });
  log(A, 'payment.failed webhook → paymentStatus=failed', doc2.paymentStatus === 'failed', `pay=${doc2.paymentStatus}`);
}

// ============ NEW FLAW PROBES ============
async function phaseFlaws() {
  const A = 'flaws';

  // F1: admin cancel does NOT restock (reaper is the only restock path)
  let r = await req('POST', '/orders', { token: state.custToken, body: { items: [{ product: state.pid, variant: state.sku, quantity: 2 }], shippingAddress: addr, paymentMethod: 'cod' } });
  const cId = r.data.data?.orderId;
  if (cId) created.orders.push(cId);
  const before = (await db.collection('products').findOne({ _id: new mongoose.Types.ObjectId(state.pid) })).variants.find((v) => v.sku === state.sku).stock;
  r = await req('PATCH', `/orders/${cId}/status`, { token: state.adminToken, body: { status: 'cancelled' } });
  const after = (await db.collection('products').findOne({ _id: new mongoose.Types.ObjectId(state.pid) })).variants.find((v) => v.sku === state.sku).stock;
  log(A, 'F-NEW-1: admin cancel restocks items?', after === before + 2, after === before + 2 ? 'restocked (good)' : `FLAW — stock stays ${after} (was ${before}, 2 units lost to cancelled order ${r.data?.data?.orderId})`);
  state.cancelledNoRestock = after !== before + 2;

  // F2: quantity abuse
  r = await req('POST', '/orders', { token: state.custToken, body: { items: [{ product: state.pid, variant: state.sku, quantity: 0 }], shippingAddress: addr, paymentMethod: 'cod' } });
  log(A, 'order qty=0 rejected', r.status === 400, `status=${r.status}`);
  r = await req('POST', '/orders', { token: state.custToken, body: { items: [{ product: state.pid, variant: state.sku, quantity: -5 }], shippingAddress: addr, paymentMethod: 'cod' } });
  log(A, 'order qty=-5 rejected', r.status === 400, `status=${r.status}`);
  r = await req('POST', '/orders', { token: state.custToken, body: { items: [{ product: state.pid, variant: state.sku, quantity: 999999 }], shippingAddress: addr, paymentMethod: 'cod' } });
  log(A, 'order qty>stock rejected', r.status === 400, `status=${r.status} msg=${r.data.message}`);
  r = await req('POST', '/orders', { token: state.custToken, body: { items: [{ product: '000000000000000000000000', variant: state.sku, quantity: 1 }], shippingAddress: addr, paymentMethod: 'cod' } });
  log(A, 'order with nonexistent product rejected', r.status === 400 || r.status === 404, `status=${r.status}`);

  // F3: agent operating on an order NOT assigned to them
  r = await req('POST', '/orders', { token: state.custToken, body: { items: [{ product: state.pid, variant: state.sku, quantity: 1 }], shippingAddress: addr, paymentMethod: 'cod' } });
  const unassignedId = r.data.data?.orderId;
  if (unassignedId) created.orders.push(unassignedId);
  await req('PATCH', `/orders/${unassignedId}/status`, { token: state.adminToken, body: { status: 'confirmed' } });
  r = await req('PATCH', `/delivery/orders/${unassignedId}/status`, { token: state.agentToken, body: { status: 'out_for_delivery' } });
  log(A, 'agent cannot update unassigned order', r.status === 404 || r.status === 403, `status=${r.status} msg=${r.data.message}`);

  // F4: invoice IDOR — customer fetching another customer's invoice
  const otherOrder = await db.collection('orders').findOne({ customer: { $ne: new mongoose.Types.ObjectId(state.custId) } });
  if (otherOrder) {
    r = await req('GET', `/orders/${otherOrder._id}/invoice`, { token: state.custToken });
    log(A, 'invoice IDOR: other customer invoice blocked', r.status === 404, `status=${r.status}`);
  }

  // F5: refund guards (COD → 400 clean; fake payment id → 503 clean, no SDK text)
  r = await req('POST', `/admin/orders/${unassignedId}/refund`, { token: state.adminToken });
  log(A, 'refund of COD order rejected clean', r.status === 400, `status=${r.status} msg=${r.data.message}`);
  r = await req('POST', `/admin/orders/${state.whOrderId}/refund`, { token: state.adminToken });
  const leaked = /rzp_|payment_id|Error/i.test(JSON.stringify(r.data));
  log(A, 'refund of unknown payment id → 503, no SDK leak', r.status === 503 && !leaked, `status=${r.status} msg=${r.data.message}`);

  // F6: missing routes (gap documentation)
  r = await req('POST', `/orders/${unassignedId}/cancel`, { token: state.custToken });
  log(A, 'GAP: customer self-cancel route missing', null, `POST /orders/:id/cancel → ${r.status} (customer cannot cancel their own placed order; only admin can)`);
  r = await req('PUT', '/agent/profile', { token: state.agentToken, body: { name: 'x' } });
  log(A, 'GAP: agent profile update route missing', null, `PUT /agent/profile → ${r.status} (delivery profile page is read-only)`);
  r = await req('PUT', '/admin/profile', { token: state.adminToken, body: { name: 'x' } });
  log(A, 'admin profile update exists', r.status === 200, `status=${r.status}`);

  // F7: guest cart with x-session-id
  const sid = `audit-guest-${Date.now()}`;
  r = await req('POST', '/cart/items', { sessionId: sid, body: { productId: state.pid, variant: state.sku, quantity: 1 } });
  log(A, 'guest cart via x-session-id works', r.status === 200, `status=${r.status}`);
  const gcart = await db.collection('carts').findOne({ sessionId: sid });
  if (gcart) created.carts.push(gcart._id.toString());
  // guest cart of another session not readable
  r = await req('GET', '/cart', { sessionId: 'different-session-xyz' });
  log(A, 'another guest session sees empty cart (no cross-session leak)', r.status === 200 && (r.data.data === null || r.data.data?.items?.length === 0), `status=${r.status} items=${r.data.data?.items?.length}`);

  // F8: products?category with real ObjectId (data-flow: what frontend must send)
  const cat = await db.collection('categories').findOne({ isActive: true });
  r = await req('GET', `/products?category=${cat._id.toString()}`);
  log(A, 'products?category=<ObjectId> works', r.status === 200, `status=${r.status} count=${r.data.data?.length}`);
  r = await req('GET', `/products?category=${cat.slug}`);
  log(A, 'products?category=<slug> still 400s (known-open)', r.status === 400, `status=${r.status}`);

  // F9: OTP resend throttle
  await clearLimits();
  let lastStatus = null;
  for (let i = 0; i < 6; i++) {
    const rr = await req('POST', '/auth/customer/resend-otp', { body: { email: custEmail() } });
    lastStatus = rr.status;
    if (rr.status === 429) break;
  }
  log(A, 'OTP resend throttled', lastStatus === 429, `lastStatus=${lastStatus}`);
}

// customer email captured at setup for the OTP probe
let _custEmail;
function custEmail() { return _custEmail; }

main().catch((e) => { console.error('HARNESS2 CRASH', e); process.exit(1); });
