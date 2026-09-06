import nodemailer from 'nodemailer';
import { env } from './env';
import { logger } from '../utils/logger';

interface MailOptions {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Dual-mode mailer.
 *
 * BREVO_API_KEY set → Brevo HTTP API (api.brevo.com, port 443). Production
 * path: hosts like Render block/unreliably proxy outbound SMTP ports, so the
 * HTTP API is the reliable channel. Brevo API keys are separate credentials
 * from SMTP keys (SMTP keys get 401 here).
 *
 * No key → nodemailer over SMTP. Local development path.
 */
async function sendViaBrevoApi(options: MailOptions): Promise<void> {
  const fromRaw = options.from || env.SMTP_FROM;
  const fromMatch = fromRaw.match(/^(.*)<(.+)>$/);
  const sender = fromMatch
    ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
    : { email: fromRaw.trim() };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY as string,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
      ...(options.text ? { textContent: options.text } : {}),
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`Brevo API ${res.status}: ${detail}`);
  }
}

const smtpTransporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT),
  secure: env.SMTP_SECURE === 'true',
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

export const mailer = {
  async sendMail(options: MailOptions): Promise<void> {
    if (env.BREVO_API_KEY) {
      return sendViaBrevoApi(options);
    }
    await smtpTransporter.sendMail(options as Parameters<typeof smtpTransporter.sendMail>[0]);
  },

  async verify(): Promise<boolean> {
    if (env.BREVO_API_KEY) return true; // stateless HTTP — nothing to pre-verify
    return smtpTransporter.verify();
  },
};

// Verify on startup (non-blocking) — surfaces misconfig early without
// blocking boot.
mailer.verify().then(() => {
  logger.info(env.BREVO_API_KEY ? '✅ Email via Brevo HTTP API' : '✅ SMTP connection verified (Brevo)');
}).catch((err) => {
  logger.warn('⚠️  Email transport warning:', err.message);
});

export default mailer;
