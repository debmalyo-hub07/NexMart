import path from 'path';
import dotenv from 'dotenv';

// Load env FIRST before any other imports
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import http from 'http';
import { createApp } from './app';
import { connectDatabase } from './config/database';
import { initializeSocket } from './config/socket';
import { seedAdmin } from './seed/adminSeed';
import { startInvoiceWorker } from './queues/invoiceQueue';
import { startOrderReaper } from './services/orderReaper';
import { env } from './config/env';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting NexMart API...');

    // 0. Config guards — fail loudly before serving traffic.
    // The webhook is the source of truth for payments made by customers who
    // close the tab mid-checkout; without its secret it 503s silently.
    if (env.NODE_ENV === 'production' && !env.RAZORPAY_WEBHOOK_SECRET) {
      logger.error('FATAL: RAZORPAY_WEBHOOK_SECRET is not set — payment webhooks cannot be verified. Aborting.');
      process.exit(1);
    }
    if (env.NODE_ENV !== 'production' && !env.RAZORPAY_WEBHOOK_SECRET) {
      logger.warn('⚠️  RAZORPAY_WEBHOOK_SECRET not set — the webhook endpoint will 503 until configured.');
    }

    // 1. Connect MongoDB
    await connectDatabase();

    // 2. Seed super-admin (idempotent)
    await seedAdmin();

    // 3. Create Express app
    const app = createApp();

    // 4. Create HTTP server
    const server = http.createServer(app);

    // 5. Initialize Socket.io
    initializeSocket(server);

    // 6. Start invoice worker (in-process async queue — no Redis required)
    startInvoiceWorker();
    logger.info('✅ Invoice worker started (in-process queue)');

    // 7. Start the stale-order reaper (cancels abandoned checkouts, restocks,
    //    reconciles paid-but-unconfirmed orders via the Razorpay API)
    startOrderReaper();

    // 7. Start listening
    server.listen(parseInt(env.PORT), () => {
      logger.info(`✅ NexMart API running at http://localhost:${env.PORT}`);
      logger.info(`   Environment  : ${env.NODE_ENV}`);
      logger.info(`   API Base     : http://localhost:${env.PORT}/api/v1`);
      logger.info(`   Health Check : http://localhost:${env.PORT}/health`);
    });

    // ── Graceful Shutdown ──────────────────────────────────────
    const shutdown = (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        const { disconnectDatabase } = await import('./config/database');
        await disconnectDatabase();
        logger.info('MongoDB connection closed.');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
