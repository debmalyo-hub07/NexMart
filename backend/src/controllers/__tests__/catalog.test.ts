import { describe, expect, it } from 'vitest';
import { parseCatalogInput } from '../../services/catalog.service';
import { normalizeSearch, productSearchText } from '../../utils/catalogSearch';

describe('catalog input boundaries', () => {
  it('normalizes units and punctuation without interpreting regex operators', () => {
    expect(normalizeSearch('  Galaxy S25 / 256 GB  ')).toBe('galaxy s25 256gb');
    expect(parseCatalogInput({ q: '.*(Samsung)+' }).q).toBe('samsung');
  });
  it('keeps the first page reachable and bounds public page sizes', () => {
    expect(parseCatalogInput({ page: '-2', limit: '9999', sort: '__proto__' })).toMatchObject({ page: 1, limit: 48, sort: '' });
  });
  it('deduplicates multiple brands and retains an explicit zero price bound', () => {
    expect(parseCatalogInput({ brand: 'Samsung, Orbit, Samsung', minPrice: '0' })).toMatchObject({ brands: ['Samsung', 'Orbit'], minPrice: 0 });
  });
  it('indexes attributes and specifications as well as product names', () => {
    const text = productSearchText({ name: 'A phone', variants: [{ attributes: new Map([['Storage', '256 GB']]) }], specifications: { RAM: '12 GB' } });
    expect(text).toContain('256gb');
    expect(text).toContain('12gb');
  });
});
