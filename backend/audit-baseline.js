// Audit helper — snapshot collection counts + list any pre-existing audit test data.
// Run: node audit-baseline.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const cols = ['admins','customers','deliveryagents','products','categories','orders','deliveryassignments','carts','wishlists','otprecords'];
  const out = {};
  for (const c of cols) {
    try { out[c] = await db.collection(c).countDocuments(); } catch { out[c] = 'n/a'; }
  }
  console.log('=== BASELINE COUNTS ===');
  console.log(JSON.stringify(out, null, 2));

  // Look for any leftover audit markers
  const marker = /audit_|__audit|nexmart-audit/i;
  for (const c of ['customers','deliveryagents','admins']) {
    const docs = await db.collection(c).find({ email: marker }).project({ email:1, name:1 }).toArray();
    if (docs.length) console.log(`Pre-existing audit rows in ${c}:`, docs.map(d=>d.email));
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
