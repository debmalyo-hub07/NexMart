import { describe, expect, it } from 'vitest';
import { LocalRateLimit } from '../localRateLimit';

describe('outage rate protection', () => {
  it('limits repeated attempts and lets independent visitors continue', () => {
    const limiter = new LocalRateLimit();
    for (let i = 0; i < 10; i++) expect(limiter.consume('login:one', 10, 60000, 0).success).toBe(true);
    expect(limiter.consume('login:one', 10, 60000, 0).success).toBe(false);
    expect(limiter.consume('login:two', 10, 60000, 0).success).toBe(true);
    expect(limiter.consume('login:one', 10, 60000, 60000).success).toBe(true);
  });
  it('bounds memory without evicting live protection buckets', () => {
    const limiter = new LocalRateLimit(2);
    limiter.consume('one', 1, 60000, 0); limiter.consume('two', 1, 60000, 0);
    expect(limiter.consume('three', 1, 60000, 0).success).toBe(false);
    expect(limiter.consume('one', 1, 60000, 0).success).toBe(false);
    expect(limiter.consume('three', 1, 60000, 60000).success).toBe(true);
  });
});
