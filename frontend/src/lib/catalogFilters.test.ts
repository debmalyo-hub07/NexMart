import { describe, expect, it } from 'vitest';
import { catalogParams } from './catalogFilters';

describe('catalog URLs', () => {
  it('keeps category, featured and filters when arriving from another page', () => {
    const params = catalogParams(new URLSearchParams('category=phones&featured=true&minPrice=100000.50&inStock=true'));
    expect(params.get('category')).toBe('phones');
    expect(params.get('featured')).toBe('true');
    expect(params.get('minPrice')).toBe('100000.5');
    expect(params.has('maxPrice')).toBe(false);
  });
  it('does not allow a query to override the category route', () => {
    expect(catalogParams(new URLSearchParams('category=other'), 'phones').get('category')).toBe('phones');
  });
  it('normalizes untrusted pagination, prices and sorting without an implicit ceiling', () => {
    const params = catalogParams(new URLSearchParams('page=-2&sort=secret&maxPrice=NaN&rating=20'));
    expect(params.get('page')).toBe('1');
    expect(params.has('maxPrice')).toBe(false);
    expect(params.has('sort')).toBe(false);
    expect(params.has('rating')).toBe(false);
  });
});
