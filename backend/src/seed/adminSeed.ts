import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { maskEmail } from '../utils/helpers';

export async function seedAdmin(): Promise<void> {
  if (env.ADMIN_SEED_ENABLED !== 'true') {
    logger.info('Admin seed disabled (ADMIN_SEED_ENABLED=false). Skipping.');
    return;
  }

  try {
    const existing = await Admin.findOne({ email: env.ADMIN_SEED_EMAIL });
    if (existing) {
      logger.info(`ℹ️  Super-admin already exists: ${maskEmail(env.ADMIN_SEED_EMAIL)}`);
      return;
    }

    const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);

    await Admin.create({
      name: 'Debmalyo Barman',
      email: env.ADMIN_SEED_EMAIL,
      password: passwordHash,
      role: 'admin',
    });

    logger.info(`✅ Super-admin seeded: ${maskEmail(env.ADMIN_SEED_EMAIL)}`);
  } catch (error) {
    logger.error('❌ Admin seed failed:', error);
    throw error;
  }
}
