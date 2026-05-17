import { z } from 'zod';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from project root (two levels up from src/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // MongoDB
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),

  // Auth
  AUTH_SECRET: z.string().min(1),
  JWT_SECRET_ADMIN: z.string().min(1),
  JWT_SECRET_CUSTOMER: z.string().min(1),
  JWT_SECRET_AGENT: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_MAXAGE: z.string().default('2592000'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // Email (Brevo SMTP)
  SMTP_HOST: z.string().default('smtp-relay.brevo.com'),
  SMTP_PORT: z.string().default('587'),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().default('NexMart <noreply@nexmart.in>'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  PAYMENT_RATE_LIMIT_MAX: z.string().default('10'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Socket.io
  SOCKET_CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Invoice
  INVOICE_STORAGE: z.enum(['cloudinary', 'local']).default('cloudinary'),

  // Admin seed
  ADMIN_SEED_EMAIL: z.string().email(),
  ADMIN_SEED_PASSWORD: z.string().min(6),
  ADMIN_SEED_ENABLED: z.string().default('true'),

  // Admin Secret Key — Phase 3 security (required for new admin registration)
  ADMIN_SECRET_KEY: z.string().min(8, 'ADMIN_SECRET_KEY must be at least 8 characters'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
