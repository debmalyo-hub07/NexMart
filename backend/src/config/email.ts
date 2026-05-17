import nodemailer from 'nodemailer';
import { env } from './env';
import { logger } from '../utils/logger';

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT),
  secure: env.SMTP_SECURE === 'true',
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

// Verify connection on startup (non-blocking)
transporter.verify().then(() => {
  logger.info('✅ SMTP connection verified (Brevo)');
}).catch((err) => {
  logger.warn('⚠️  SMTP connection warning:', err.message);
});

export default transporter;
