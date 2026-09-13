import { describe, expect, it } from 'vitest';
import { generateResetCode, hashResetCode, RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS } from '../resetCode';

describe('reset code utility', () => {
  it('generates a six-digit numeric code', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateResetCode()).toMatch(/^\d{6}$/);
    }
  });

  it('hashes deterministically and never returns the plaintext', () => {
    const hash = hashResetCode('123456');
    expect(hash).toBe(hashResetCode('123456'));
    expect(hash).not.toContain('123456');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different codes', () => {
    expect(hashResetCode('123456')).not.toBe(hashResetCode('123457'));
  });

  it('exposes the policy constants', () => {
    expect(RESET_CODE_TTL_MS).toBe(15 * 60 * 1000);
    expect(RESET_CODE_MAX_ATTEMPTS).toBe(5);
  });
});
