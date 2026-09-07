const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const show = async (c, proj) => {
    const docs = await db.collection(c).find({}).project(proj).toArray();
    console.log(`\n=== ${c} (${docs.length}) ===`);
    docs.forEach(d => console.log(JSON.stringify(d)));
  };
  await show('admins', { email:1, name:1, role:1 });
  await show('customers', { email:1, name:1, isActive:1, emailVerified:1 });
  await show('deliveryagents', { email:1, name:1, status:1, isApproved:1 });
  await show('products', { name:1, slug:1, isPublished:1, 'variants.sku':1, 'variants.price':1, 'variants.stock':1, category:1 });
  await show('orders', { orderId:1, orderStatus:1, paymentStatus:1, paymentMethod:1, customer:1 });
  await show('carts', { user:1, sessionId:1, 'items':1 });
  const cats = await db.collection('categories').find({ isActive: true }).project({ name:1, slug:1 }).limit(3).toArray();
  console.log('\n=== sample active categories ==='); cats.forEach(c=>console.log(JSON.stringify(c)));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
