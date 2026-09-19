import { Types } from 'mongoose';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { catalogTaxonomy } from '../seed/taxonomy';
import demoProducts from '../seed/demo-products.json';
import { generateSlug } from '../utils/helpers';
import { productSearchText } from '../utils/catalogSearch';

export const DEMO_CATALOG_SOURCE = 'nexmart-demo-2026-09';

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
      name: `Demo · ${item.name}`, slug, description: item.description,
      category: categories.get(item.root), subCategory: String(categories.get(generateSlug(item.sub))),
      brand: item.brand, specifications: item.specifications, images: item.images, tags: item.tags,
      variants: item.attributes.map((attributes, index) => ({ sku: `DEMO-${item.key}-${index + 1}`, attributes, price: item.price, stock: 0, images: item.images })),
      ratings: { average: 0, count: 0 }, reviews: [], isDemo: true,
      demoSource: `${DEMO_CATALOG_SOURCE} | ${item.source}`, isPublished: true, isFeatured: item.featured, createdBy,
    });
    added++;
  }
  // Backfill only the derived search index, preserving real merchandise data.
  const unindexed = await Product.find({ searchText: { $exists: false } }).select('+searchText');
  for (const product of unindexed) await Product.updateOne({ _id: product._id }, { $set: { searchText: productSearchText(product) } }, { timestamps: false });
  return { added, preserved, indexed: unindexed.length, sampleProducts: demoProducts.length, departments: catalogTaxonomy.length };
}
