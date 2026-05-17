'use client';

import { cn, getStatusColor, capitalizeStatus } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(getStatusColor(status), className)}>
      {capitalizeStatus(status)}
    </span>
  );
}
