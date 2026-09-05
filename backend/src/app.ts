import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import hpp from 'hpp';
import mongoSanitize from 'mongo-sanitize';

import { env } from './config/env';
import { logger } from './utils/logger';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimit } from './middleware/rateLimiter';

import { razorpayWebhook } from './controllers/webhook.controller';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import adminRoutes from './routes/admin.routes';
import deliveryRoutes from './routes/delivery.routes';
import searchRoutes from './routes/search.routes';
import customerRoutes from './routes/customer.routes';
import agentRoutes from './routes/agent.routes';
import authRoutes from './routes/auth.routes';

export function createApp(): express.Application {
  const app = express();

  // ── Security Middleware ──────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // handled by Next.js
  }));

  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id'],
  }));

  // ── Razorpay Webhook (raw body — must run BEFORE json/CSRF/rate-limit) ──
  // Authenticated by HMAC signature, not by Origin/Referer, so it is exempt from CSRF.
  app.post(
    '/api/v1/webhooks/razorpay',
    express.raw({ type: '*/*', limit: '1mb' }),
    razorpayWebhook
  );

  // CSRF Protection Middleware
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin;
      const referer = req.headers.referer;
      const allowedOrigin = env.CORS_ORIGIN;

      let isValid = false;
      if (origin && origin === allowedOrigin) {
        isValid = true;
      } else if (referer && referer.startsWith(allowedOrigin)) {
        isValid = true;
      }

      // Note: requests with NEITHER Origin NOR Referer are now REJECTED. Legitimate
      // server-to-server callers (e.g. Razorpay) use dedicated signed endpoints mounted
      // above this middleware, so they never reach here.
      if (!isValid) {
        logger.warn(`CSRF Blocked: Method: ${req.method}, Origin: ${origin}, Referer: ${referer}, Expected: ${allowedOrigin}`);
        return res.status(403).json({
          success: false,
          message: 'CSRF protection triggered. Request origin/referer mismatch.',
        });
      }
    }
    next();
  });

  // ── Body Parsing ──────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Sanitization ─────────────────────────────────────────────
  app.use((req, _res, next) => {
    req.body = mongoSanitize(req.body);
    req.params = mongoSanitize(req.params) as typeof req.params;
    next();
  });
  app.use(hpp());

  // ── Logging ───────────────────────────────────────────────────
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));

  // ── Health Check ──────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
  });

  // ── Role-Based API Routes ──────────────────────────────────────
  const apiPrefix = '/api/v1';

  // Global sliding-window rate limit on all API traffic (health check is exempt).
  app.use(apiPrefix, generalLimit);

  // Shared auth routes (Google OAuth callback, etc.)
  app.use(`${apiPrefix}/auth`, authRoutes);

  // Specific role routes
  app.use(`${apiPrefix}/admin`, adminRoutes);
  app.use(`${apiPrefix}/customer`, customerRoutes);
  app.use(`${apiPrefix}/agent`, agentRoutes);

  // General routes / Domain routes 
  // We attach them to their domain endpoints, but they should be consumed by respective client apps 
  // Alternatively we could nest them inside the role routers. Let's keep them here, assuming they have their own middlewares inside.
  app.use(`${apiPrefix}/products`, productRoutes);
  app.use(`${apiPrefix}/categories`, categoryRoutes);
  app.use(`${apiPrefix}/cart`, cartRoutes);
  app.use(`${apiPrefix}/orders`, orderRoutes);
  app.use(`${apiPrefix}/delivery`, deliveryRoutes);
  app.use(`${apiPrefix}/search`, searchRoutes);

  // ── 404 & Error Handlers ──────────────────────────────────────
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
