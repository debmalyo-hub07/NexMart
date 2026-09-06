/**
 * Brevo HTTP API probe — can we send via api.brevo.com (port 443, never
 * blocked) using the existing SMTP key? If yes, production email is fixed
 * by switching the transport from SMTP to HTTP API.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const key = process.env.SMTP_PASSWORD;
const fromMatch = (process.env.SMTP_FROM || '').match(/^(.*)<(.+)>$/);
const sender = fromMatch
  ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
  : { email: process.env.SMTP_FROM };

try {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender,
      to: [{ email: process.env.ADMIN_SEED_EMAIL }],
      subject: 'NexMart — Brevo HTTP API probe',
      htmlContent: '<p>If you received this, the HTTP API path works — production email is fixed.</p>',
    }),
  });
  const body = await res.text();
  console.log('HTTP status:', res.status);
  console.log('body:', body.slice(0, 300));
  console.log(res.status === 200 ? 'HTTP API: WORKS ✓' : 'HTTP API: rejected — see body');
} catch (err) {
  console.log('fetch error:', err.message);
}
process.exit(0);
