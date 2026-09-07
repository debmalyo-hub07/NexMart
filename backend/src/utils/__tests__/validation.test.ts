import { describe, it, expect } from 'vitest';
import { cartMergeSchema, passwordChangeSchema } from '../validation';

describe('cartMergeSchema (B1: accepts the shape the frontend actually sends)', () => {
  it('parses { items: [...] } — the authStore.ts payload', () => {
    const parsed = cartMergeSchema.parse({
      items: [{ product: '6a00e54b70fc52166c9b33cf', variant: 'SAM-MOBI-4PSX-1', quantity: 3 }],
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].quantity).toBe(3);
  });

  it('rejects the old bare-array shape so the contract has exactly one form', () => {
    expect(() =>
      cartMergeSchema.parse([{ product: 'a', variant: 'b', quantity: 1 }])
    ).toThrow();
  });

  it('rejects items with non-positive or non-integer quantities', () => {
    expect(() => cartMergeSchema.parse({ items: [{ product: 'a', variant: 'b', quantity: 0 }] })).toThrow();
    expect(() => cartMergeSchema.parse({ items: [{ product: 'a', variant: 'b', quantity: 1.5 }] })).toThrow();
  });

  it('caps the batch so a merge cannot push an unbounded payload', () => {
    const items = Array.from({ length: 51 }, () => ({ product: 'a', variant: 'b', quantity: 1 }));
    expect(() => cartMergeSchema.parse({ items })).toThrow();
  });
});

describe('passwordChangeSchema (B5: current password + strength policy)', () => {
  it('requires currentPassword', () => {
    expect(() =>
      passwordChangeSchema.parse({ password: 'GoodPass1' })
    ).toThrow();
  });

  it('rejects the E2E-verified 1-character password', () => {
    expect(() =>
      passwordChangeSchema.parse({ currentPassword: 'old', password: 'x' })
    ).toThrow();
  });

  it('requires uppercase, lowercase, and a digit (same policy as the frontend modal)', () => {
    expect(() => passwordChangeSchema.parse({ currentPassword: 'old', password: 'alllowercase1' })).toThrow();
    expect(() => passwordChangeSchema.parse({ currentPassword: 'old', password: 'ALLUPPERCASE1' })).toThrow();
    expect(() => passwordChangeSchema.parse({ currentPassword: 'old', password: 'NoDigitsHere' })).toThrow();
  });

  it('accepts a compliant change', () => {
    const parsed = passwordChangeSchema.parse({ currentPassword: 'OldPass1', password: 'GoodPass1' });
    expect(parsed.password).toBe('GoodPass1');
  });
});
