/** Shared normalization for stored search text, queries and taxonomy aliases. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/(\d)\s+(gb|tb|mb|kg|ml|mm|cm|hz|mah)\b/g, '$1$2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function values(record: unknown): string {
  if (record instanceof Map) return [...record.entries()].flat().join(' ');
  return record && typeof record === 'object' ? Object.entries(record).flat().join(' ') : '';
}

export function productSearchText(product: { name: string; description?: string; brand?: string; tags?: string[]; specifications?: unknown; variants?: Array<{ attributes?: unknown }> }): string {
  return normalizeSearch([product.name, product.brand, ...(product.tags ?? []), values(product.specifications), ...(product.variants ?? []).map(variant => values(variant.attributes)), product.description?.slice(0, 3000)].filter(Boolean).join(' '));
}

const synonyms: string[][] = [
  ['phone', 'phones', 'smartphone', 'smartphones', 'mobile', 'mobiles'],
  ['laptop', 'laptops', 'notebook'], ['headphone', 'headphones', 'earbuds', 'audio'],
  ['tv', 'tvs', 'television', 'televisions'], ['sneaker', 'sneakers', 'shoe', 'shoes'],
  ['fridge', 'refrigerator', 'refrigerators'], ['tshirt', 'tee'],
];

export function searchAlternatives(token: string): string[] {
  return synonyms.find(group => group.includes(token)) ?? [token];
}

export function tokenPattern(token: string, approximate = false): string {
  // Tokens are normalized letters/numbers only. Escape anyway so this helper
  // remains safe if normalization changes. No user-supplied regex is executed.
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alternatives = searchAlternatives(token).map(escape);
  if (approximate && /^[a-z0-9]{4,24}$/.test(token)) {
    for (let index = 0; index < token.length; index++) {
      const left = escape(token.slice(0, index));
      const right = escape(token.slice(index + 1));
      alternatives.push(`${left}${right}`, `${left}[a-z0-9]${right}`, `${left}[a-z0-9]${escape(token.slice(index))}`);
      if (index < token.length - 1) alternatives.push(escape(token.slice(0, index) + token[index + 1] + token[index] + token.slice(index + 2)));
    }
  }
  return `(^|\\s)(${[...new Set(alternatives)].join('|')})`;
}
