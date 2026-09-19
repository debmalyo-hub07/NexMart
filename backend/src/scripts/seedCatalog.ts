import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { seedDemoCatalog } from '../services/catalogSeed.service';
import { Admin } from '../models/Admin';
import demoProducts from '../seed/demo-products.json';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'preview', products: demoProducts.length, byCategory: Object.fromEntries([...new Set(demoProducts.map(item => item.root))].map(root => [root, demoProducts.filter(item => item.root === root).length])), stock: 0, note: 'Demo products are labelled, cannot be purchased, and contain no fabricated reviews. Existing products and category IDs are preserved. Pass --apply --database=<expected-name> to insert into MONGODB_URI.' }, null, 2));
    return;
  }
  const expectedDatabase = process.argv.find(value => value.startsWith('--database='))?.slice('--database='.length);
  if (!expectedDatabase) throw new Error('Supply --database=<expected-name> alongside --apply to confirm the target database.');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  try {
    if (mongoose.connection.name !== expectedDatabase) throw new Error('The connected database does not match --database. No catalog changes were made.');
    const admin = await Admin.findOne().select('_id');
    if (!admin) throw new Error('Create an admin before seeding catalog products.');
    console.log(JSON.stringify({ database: mongoose.connection.name, ...(await seedDemoCatalog(admin._id)) }, null, 2));
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Catalog seed failed'); process.exitCode = 1; });
