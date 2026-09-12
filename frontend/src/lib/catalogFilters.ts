export const CATALOG_SORTS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'variants.0.price', label: 'Price: low to high' },
  { value: '-variants.0.price', label: 'Price: high to low' },
  { value: '-ratings.average', label: 'Highest rated' },
];

export function catalogParams(input: Pick<URLSearchParams, 'get'>, categorySlug?: string) {
  const params = new URLSearchParams();
  const q = input.get('q')?.trim().slice(0, 200);
  if (q) params.set('q', q);
  const category = categorySlug || input.get('category');
  if (category) params.set('category', category);
  const sort = input.get('sort');
  if (sort && CATALOG_SORTS.some(option => option.value === sort)) params.set('sort', sort);
  for (const key of ['minPrice', 'maxPrice', 'rating']) {
    const raw = input.get(key);
    const value = Number(raw);
    if (raw && Number.isFinite(value) && value >= 0 && (key !== 'rating' || value <= 5)) params.set(key, String(value));
  }
  for (const key of ['inStock', 'featured']) if (input.get(key) === 'true') params.set(key, 'true');
  const page = Number(input.get('page'));
  params.set('page', Number.isSafeInteger(page) && page > 0 ? String(page) : '1');
  params.set('limit', '12');
  return params;
}
