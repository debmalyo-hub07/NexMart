import { Types } from 'mongoose';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { catalogTaxonomy } from '../seed/taxonomy';
import demoProducts from '../seed/demo-products.json';
import { generateSlug } from '../utils/helpers';
import { productSearchText } from '../utils/catalogSearch';

export const DEMO_CATALOG_SOURCE = 'nexmart-demo-2026-09';

// Starter sellable state for the demo catalog. The store used to seed every
// product as isDemo with zero stock — the entire storefront read "Sample · not
// for sale" and nothing could be ordered (audit 2026-09-22 §A2). Catalog
// entries are now real, purchasable inventory from first insert; demoSource
// keeps their provenance.
const STARTER_STOCK = 12;
/** Reference list price ~25% above selling price, rounded, so discount math renders. */
const starterComparePrice = (price: number) => Math.round((price * 1.25) / 10) * 10;

/** Additive by slug: never replaces category IDs or existing editorial content. */
export async function seedTaxonomy() {
  const ids = new Map<string, Types.ObjectId>();
  for (const [order, definition] of catalogTaxonomy.entries()) {
    const image = demoProducts.find(product => product.root === definition.slug)?.images[0];
    const category = await Category.findOneAndUpdate({ slug: definition.slug }, { $setOnInsert: { name: definition.name, slug: definition.slug, description: definition.description, displayOrder: order, image } }, { upsert: true, new: true });
    if (!category.description) { category.description = definition.description; await category.save(); }
    ids.set(definition.slug, category._id);
    for (const [index, name] of definition.sub.entries()) {
      const slug = generateSlug(name);
      const child = await Category.findOneAndUpdate({ slug }, { $setOnInsert: { name, slug, parent: category._id, displayOrder: index } }, { upsert: true, new: true });
      if (String(child.parent) !== String(category._id)) throw new Error(`Existing category ${slug} belongs to a different parent; it was preserved.`);
      ids.set(slug, child._id);
    }
  }
  return ids;
}

export async function seedDemoCatalog(createdBy: Types.ObjectId) {
  const categories = await seedTaxonomy();
  let added = 0;
  let preserved = 0;
  for (const item of demoProducts) {
    const slug = `demo-${generateSlug(item.name)}-${item.key}`;
    if (await Product.exists({ slug })) { preserved++; continue; }
    await Product.create({
      name: item.name, slug, description: item.description,
      category: categories.get(item.root), subCategory: String(categories.get(generateSlug(item.sub))),
      brand: item.brand, specifications: item.specifications, images: item.images, tags: item.tags,
      variants: item.attributes.map((attributes, index) => ({ sku: `DEMO-${item.key}-${index + 1}`, attributes, price: item.price, comparePrice: starterComparePrice(item.price), stock: STARTER_STOCK, images: item.images })),
      ratings: { average: 0, count: 0 }, reviews: [], isDemo: false,
      demoSource: `${DEMO_CATALOG_SOURCE} | ${item.source}`, isPublished: true, isFeatured: item.featured, createdBy,
    });
    added++;
  }
  const activated = await activateSampleCatalog();
  // Backfill only the derived search index, preserving real merchandise data.
  const unindexed = await Product.find({ searchText: { $exists: false } }).select('+searchText');
  for (const product of unindexed) await Product.updateOne({ _id: product._id }, { $set: { searchText: productSearchText(product) } }, { timestamps: false });
  return { added, preserved, activated, indexed: unindexed.length, sampleProducts: demoProducts.length, departments: catalogTaxonomy.length };
}

/**
 * Idempotent activation of legacy sample products (audit 2026-09-22 §A2):
 * flips remaining isDemo documents to sellable stock — clear name, positive
 * stock, reference compare price. Only ever touches isDemo documents, so real
 * merchandise is never mutated.
 */
async function activateSampleCatalog(): Promise<number> {
  let activated = 0;
  for (const product of await Product.find({ isDemo: true })) {
    product.isDemo = false;
    product.name = product.name.replace(/^Demo · /, '');
    for (const variant of product.variants) {
      if (!variant.stock) variant.stock = STARTER_STOCK;
      if (!variant.comparePrice) variant.comparePrice = starterComparePrice(variant.price);
    }
    await product.save(); // pre('validate') recomputes searchText after the rename
    activated++;
  }
  return activated;
}
