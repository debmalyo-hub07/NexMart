export interface SellerOffer {
  id: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  condition: 'new' | 'used' | 'refurbished';
  handlingTimeDays: number;
  fulfillmentMode: 'seller' | 'nexmart';
  returnWindowDays: number;
  warrantyText?: string;
  inventory?: { available: number };
  seller: { id: string; storefrontName: string; verification: 'verified' | 'standard'; performance?: { ratingAverage?: number; ratingCount?: number } };
  canonicalVariantSku?: string;
}
export type OfferSort = 'price' | 'rating' | 'speed';
export function matchingOffers(offers: SellerOffer[], sku: string, sort: OfferSort) {
  return offers.filter(offer => !offer.canonicalVariantSku || offer.canonicalVariantSku === sku).sort((a, b) => {
    const availability = Number((b.inventory?.available ?? 0) > 0) - Number((a.inventory?.available ?? 0) > 0);
    return availability || (sort === 'rating' ? (b.seller.performance?.ratingAverage ?? 0) - (a.seller.performance?.ratingAverage ?? 0) : sort === 'speed' ? a.handlingTimeDays - b.handlingTimeDays : a.pricePaise - b.pricePaise) || a.pricePaise - b.pricePaise || a.id.localeCompare(b.id);
  });
}
export function lowestAvailablePrice(offers: SellerOffer[]) {
  const prices = offers.filter(offer => (offer.inventory?.available ?? 0) > 0).map(offer => offer.pricePaise);
  return prices.length ? Math.min(...prices) : undefined;
}
