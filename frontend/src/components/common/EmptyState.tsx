import { type ReactNode } from 'react';
import { PackageOpen, type LucideIcon } from 'lucide-react';

export function EmptyState({ title, description, action, icon: Icon = PackageOpen }: { title: string; description: string; action?: ReactNode; icon?: LucideIcon }) {
  return <div className="rounded-2xl border border-dashed border-white/20 px-5 py-10 text-center sm:py-14">
    <Icon size={28} className="mx-auto mb-4 text-muted" aria-hidden />
    <h2 className="text-xl">{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm text-secondary">{description}</p>
    {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
  </div>;
}
