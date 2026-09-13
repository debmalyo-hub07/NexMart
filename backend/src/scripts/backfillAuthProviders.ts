/**
 * One-shot, idempotent repair: accounts linked to Google before the provider
 * was recorded have a googleId but no 'google' entry in authProviders, which
 * the account security screen renders from. The same applies to accounts that
 * have a password but no 'email' entry. Safe to re-run — a second run reports
 * 0 modified.
 *
 * Usage: cd backend && npx ts-node -r tsconfig-paths/register src/scripts/backfillAuthProviders.ts
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import { Customer } from '../models/Customer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);

  const linked = await Customer.updateMany(
    { googleId: { $exists: true, $nin: [null, ''] }, authProviders: { $ne: 'google' } },
    { $addToSet: { authProviders: 'google' } },
  );
  const passworded = await Customer.updateMany(
    { password: { $exists: true, $nin: [null, ''] }, authProviders: { $ne: 'email' } },
    { $addToSet: { authProviders: 'email' } },
  );

  logger.info(`Backfill complete — google: ${linked.modifiedCount}, email: ${passworded.modifiedCount}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  logger.error('Backfill failed', error);
  process.exit(1);
});
