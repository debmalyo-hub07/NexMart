import { describe, it, expect } from 'vitest';
import { paymentVerifyPath } from './payment';

describe('paymentVerifyPath', () => {
  it('builds the real backend route with the Mongo order id', () => {
    expect(paymentVerifyPath('66f1a2b3c4d5e6f7a8b9c0d1')).toBe(
      '/orders/66f1a2b3c4d5e6f7a8b9c0d1/payment/verify'
    );
  });
});
