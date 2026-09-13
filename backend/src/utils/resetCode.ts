import crypto from 'crypto';

/** Reset codes live 15 minutes. */
export const RESET_CODE_TTL_MS = 15 * 60 * 1000;

/** After this many wrong guesses the code is dead and must be re-requested. */
export const RESET_CODE_MAX_ATTEMPTS = 5;

export function generateResetCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Reset codes are stored hashed, never in plaintext. A password-reset code is
 * strictly more sensitive than a verification code: anyone who can read the
 * document could otherwise take over the account. SHA-256 is appropriate here
 * (not bcrypt) because the input is high-entropy-per-attempt and guarded by a
 * 5-attempt cap and a 15-minute expiry, and the check sits in a request path.
 */
export function hashResetCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
