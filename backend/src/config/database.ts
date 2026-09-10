import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

let retryCount = 0;

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    logger.info('✅ MongoDB connection established');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('❌ MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️  MongoDB disconnected. Attempting reconnect...');
  });

  await attemptConnection();
}

async function attemptConnection(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    retryCount = 0;
  } catch (error) {
    retryCount++;
    logger.error(`❌ MongoDB connection attempt ${retryCount}/${MAX_RETRIES} failed`);

    if (retryCount >= MAX_RETRIES) {
      logger.error('❌ Max retries reached. Exiting...');
      process.exit(1);
    }

    logger.info(`🔄 Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
    await new Promise((res) => setTimeout(res, RETRY_INTERVAL_MS));
    return attemptConnection();
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

/** Readiness is intentionally cheap and side-effect free. */
export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
