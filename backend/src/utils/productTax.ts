/** Rates are an explicit catalogue setting in basis points (18% = 1800).
 * Missing configuration is distinct from a verified zero rate. */
export function includedProductTax(amountPaise: number, rateBps?: number): number {
  if (rateBps === undefined) return 0;
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 0 || !Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new Error('Invalid product tax configuration.');
  return Math.round(amountPaise * rateBps / (10000 + rateBps));
}
