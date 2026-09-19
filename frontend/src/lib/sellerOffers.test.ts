import { describe, expect, it } from 'vitest';
import { lowestAvailablePrice, matchingOffers, type SellerOffer } from './sellerOffers';
const offer = (id: string, pricePaise: number, available: number, sku = 'A') => ({ id, pricePaise, inventory: { available }, canonicalVariantSku: sku, seller: { id: 'seller', storefrontName: 'Shop' }, handlingTimeDays: 2 } as SellerOffer);
describe('seller offer presentation', () => {
  it('excludes unavailable stock from the lowest available price claim', () => {
    const offers = [offer('empty', 100, 0), offer('available', 500, 2), offer('other', 300, 1, 'B')];
    expect(matchingOffers(offers, 'A', 'price').map(item => item.id)).toEqual(['available', 'empty']);
    expect(lowestAvailablePrice(matchingOffers(offers, 'A', 'price'))).toBe(500);
    expect(lowestAvailablePrice([offers[0]])).toBeUndefined();
  });
});
