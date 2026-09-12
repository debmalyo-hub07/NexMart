'use client';

import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle,
  ClipboardList,
  Loader2,
  Package,
  RotateCcw,
  Truck,
  UserCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn, getStatusColor, capitalizeStatus } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_ICONS: Record<string, LucideIcon> = {
  delivered: CheckCircle,
  cancelled: XCircle,
  returned: RotateCcw,
  shipped: Truck,
  out_for_delivery: Truck,
  placed: ClipboardList,
  confirmed: BadgeCheck,
  processing: Loader2,
  approved: BadgeCheck,
  rejected: XCircle,
  assigned: UserCheck,
  picked: Package,
  attempted: AlertTriangle,
  pending: ClipboardList,
  paid: CheckCircle,
  failed: XCircle,
  refunded: RotateCcw,
  active: UserCheck,
  suspended: XCircle,
  published: CheckCircle,
  draft: ClipboardList,
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status] || Activity;

  return (
    <span className={cn(getStatusColor(status), 'inline-flex max-w-full items-center gap-1.5', className)}>
      <Icon size={13} className="shrink-0" aria-hidden />
      {capitalizeStatus(status)}
    </span>
  );
}
