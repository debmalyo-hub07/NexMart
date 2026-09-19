export const CATALOG_SORTS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'price', label: 'Price: low to high' },
  { value: '-price', label: 'Price: high to low' },
  { value: '-ratings.average', label: 'Highest rated' },
];

export function catalogParams(input: Pick<URLSearchParams, 'get'>, categorySlug?: string) {
  const params = new URLSearchParams();
  const q = input.get('q')?.trim().slice(0, 200);
  if (q) params.set('q', q);
  const multi = (value: string | null | undefined) => [...new Set((value ?? '').split(',').map(part => part.trim()).filter(Boolean))].slice(0, 12).sort().join(',');
  const category = categorySlug || multi(input.get('category'));
  if (category) params.set('category', category);
  const brand = multi(input.get('brand'));
  if (brand) params.set('brand', brand);
  const sort = input.get('sort')?.replace('variants.0.price', 'price');
  if (sort && CATALOG_SORTS.some(option => option.value === sort)) params.set('sort', sort);
  for (const key of ['minPrice', 'maxPrice', 'rating']) {
    const raw = input.get(key);
    const value = Number(raw);
    if (raw && Number.isFinite(value) && value >= 0 && (key !== 'rating' || value <= 5)) params.set(key, String(value));
  }
  for (const key of ['inStock', 'featured']) if (input.get(key) === 'true') params.set(key, 'true');
  const page = Number(input.get('page'));
  params.set('page', Number.isSafeInteger(page) && page > 0 ? String(Math.min(page, 10000)) : '1');
  params.set('limit', '12');
  return params;
}
