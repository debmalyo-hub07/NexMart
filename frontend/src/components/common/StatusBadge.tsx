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
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status] || Activity;

  return (
    <span className={cn(getStatusColor(status), 'inline-flex items-center gap-1', className)}>
      <Icon size={12} aria-hidden />
      {capitalizeStatus(status)}
    </span>
  );
}
