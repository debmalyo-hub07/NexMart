import { BookOpen, Dumbbell, Gamepad2, House, Laptop, Package, Shirt, ShoppingBag, Smartphone, Sparkles, Watch } from 'lucide-react';

/** Catalog labels vary; all category marks use the existing Lucide family. */
export function CategoryIcon({ name, size = 22 }: { name: string; size?: number }) {
  const key = name.toLowerCase();
  const Icon = /phone|mobile/.test(key) ? Smartphone : /computer|laptop|electronic/.test(key) ? Laptop : /fashion|cloth|apparel/.test(key) ? Shirt : /home|furniture|kitchen/.test(key) ? House : /book/.test(key) ? BookOpen : /sport|fitness/.test(key) ? Dumbbell : /beauty|care/.test(key) ? Sparkles : /watch|accessor/.test(key) ? Watch : /game|toy/.test(key) ? Gamepad2 : /grocery|food/.test(key) ? ShoppingBag : Package;
  return <Icon size={size} strokeWidth={1.5} aria-hidden />;
}
