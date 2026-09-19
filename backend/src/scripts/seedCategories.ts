import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { seedTaxonomy } from '../services/catalogSeed.service';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const categories = await seedTaxonomy();
    console.log(`Category taxonomy ready: ${categories.size} entries. Existing IDs preserved.`);
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Category seed failed'); process.exitCode = 1; });
