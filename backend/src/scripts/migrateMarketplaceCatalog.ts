import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import { env } from '../config/env';
import { migrateLegacyCatalog } from '../services/marketplaceCatalogMigration.service';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(env.MONGODB_URI);
  const result = await migrateLegacyCatalog({ dryRun });
  logger.info(`Marketplace catalog migration complete: ${JSON.stringify(result)}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  logger.error('Marketplace catalog migration failed', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
