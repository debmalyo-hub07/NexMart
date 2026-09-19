import type { Types } from 'mongoose';

type CategoryNode = { _id: Types.ObjectId; parent?: Types.ObjectId | null; isActive?: boolean };
/** Root-reachable nodes only: inactive ancestors, orphans, and cycles stay hidden. */
export function visibleCategories<T extends CategoryNode>(categories: T[]): T[] {
  const visible = new Set<string>();
  let size = -1;
  while (size !== visible.size) {
    size = visible.size;
    for (const category of categories) if (category.isActive !== false && (!category.parent || visible.has(String(category.parent)))) visible.add(String(category._id));
  }
  return categories.filter(category => visible.has(String(category._id)));
}

export function publicProductVisibility(categories: CategoryNode[]) {
  const ids = categories.map(category => category._id);
  return {
    isPublished: true,
    category: { $in: ids },
    $or: [{ subCategory: { $exists: false } }, { subCategory: null }, { subCategory: '' }, { subCategory: { $in: ids.map(String) } }],
  };
}
