import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export async function seedAdmin(): Promise<void> {
  if (env.ADMIN_SEED_ENABLED !== 'true') {
    logger.info('Admin seed disabled (ADMIN_SEED_ENABLED=false). Skipping.');
    return;
  }

  try {
    const existing = await Admin.findOne({ email: env.ADMIN_SEED_EMAIL });
    if (existing) {
      logger.info('ℹ️  Admin bootstrap: account already present.');
      return;
    }

    const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);

    await Admin.create({
      name: 'Debmalyo Barman',
      email: env.ADMIN_SEED_EMAIL,
      password: passwordHash,
      role: 'admin',
    });

    logger.info('✅ Admin bootstrap: first admin account created.');
  } catch (error) {
    logger.error('❌ Admin seed failed:', error);
    throw error;
  }
}
