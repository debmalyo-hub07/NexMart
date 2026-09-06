/**
 * SMTP probe — send one diagnostic email through the app's exact Brevo
 * transport to surface the real send error (connection works; sends fail).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
});

try {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.ADMIN_SEED_EMAIL, // the owner's own inbox
    subject: 'NexMart E2E — SMTP diagnostic probe',
    text: 'Diagnostic email from the E2E test run. If you received this, sending works.',
  });
  console.log('SEND OK:', JSON.stringify(info, null, 2).slice(0, 600));
} catch (err) {
  console.log('SEND FAILED');
  console.log('code:   ', err.code);
  console.log('message:', err.message);
  if (err.response) console.log('response:', err.response);
  if (err.responseCode) console.log('responseCode:', err.responseCode);
  if (err.command) console.log('command:', err.command);
}
process.exit(0);
