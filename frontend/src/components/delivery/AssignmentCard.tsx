'use client';

import { Loader2, MapPin, Navigation, Phone, WifiOff } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { deliveryActionsFor, type StatusAction } from '@/lib/orderStatus';
import { formatPrice, formatDate } from '@/lib/utils';
import { indianPhone } from '@/lib/address';
import type { Address, DeliveryAssignment } from '@/types';

/** One line per address part — an agent needs the whole thing, never a clamp. */
function addressLines(address?: Address) {
  return [
    address?.addressLine1,
    address?.addressLine2,
    [address?.city, address?.state].filter(Boolean).join(', '),
    address?.pincode,
  ].filter(Boolean) as string[];
}

/**
 * A single delivery, presented as the task it is: where to go, who to call,
 * what to collect, and the one action that comes next. Controls are 48px for
 * one-handed outdoor use (CLAUDE.md §4.3).
 */
export function AssignmentCard({
  assignment, busy, disabled, onAction,
}: {
  assignment: DeliveryAssignment;
  busy: boolean;
  /** Offline: actions are unavailable until the connection returns. */
  disabled: boolean;
  onAction: (assignment: DeliveryAssignment, action: StatusAction) => void;
}) {
  const order = assignment.order;

  // An order can be deleted or unreadable while an assignment still points at
  // it — say so instead of rendering a card full of blanks.
  if (!order) {
    return (
      <li className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5">
        <p className="text-sm text-amber-200">
          This assignment’s order is no longer available. Contact the store before acting on it.
        </p>
        <p className="mt-1 text-xs text-muted">Assigned {formatDate(assignment.assignedAt)}</p>
      </li>
    );
  }

  const address = order.shippingAddress;
  const phone = indianPhone(address?.phone);
  const lines = addressLines(address);
  const destination = encodeURIComponent([...lines, 'India'].join(', '));
  const actions = deliveryActionsFor(assignment.status, order.orderStatus);
  const collectCash = order.paymentMethod === 'cod' && order.paymentStatus !== 'paid';

  return (
    <li className="rounded-2xl border border-white/15 bg-space-800 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-violet-300">{order.orderId}</p>
          <p className="mt-1 text-xs text-muted">
            Assigned {formatDate(assignment.assignedAt)} · {order.items?.length ?? 0} item{order.items?.length === 1 ? '' : 's'}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>

      {/* What to collect. A cash order is the one fact an agent cannot get
          wrong, so it is stated as an instruction, not a payment status. */}
      <div className="mt-4 rounded-xl border border-white/15 bg-space-900 px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-muted">{collectCash ? 'Collect on delivery' : 'Order total'}</p>
        <p className={`font-mono text-xl font-semibold ${collectCash ? 'text-acid-400' : 'text-white'}`}>
          {formatPrice(order.total)}
        </p>
        <p className="mt-0.5 text-xs text-secondary">
          {collectCash ? 'Cash on delivery — collect this amount' : 'Already paid online — collect nothing'}
        </p>
      </div>

      {/* Where and who */}
      <div className="mt-4 flex items-start gap-2">
        <MapPin size={16} className="mt-0.5 shrink-0 text-violet-300" aria-hidden />
        <address className="min-w-0 text-sm not-italic leading-relaxed text-white/80">
          <span className="block font-medium text-white">{address?.fullName || order.customer?.name || 'Recipient'}</span>
          {lines.map((line) => <span key={line} className="block">{line}</span>)}
        </address>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {phone ? (
          <a
            href={`tel:+91${phone}`}
            aria-label={`Call ${address?.fullName || 'customer'} for order ${order.orderId}`}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-medium text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
          >
            <Phone size={16} aria-hidden /> Call
          </a>
        ) : (
          <p className="flex min-h-12 items-center justify-center rounded-xl border border-dashed border-white/15 px-2 text-center text-xs text-muted">
            No phone on this order
          </p>
        )}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Directions to ${address?.city || 'delivery address'} for order ${order.orderId}`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-medium text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
        >
          <Navigation size={16} aria-hidden /> Directions <span className="sr-only">(opens in Maps)</span>
        </a>
      </div>

      {/* The next step. One primary action; anything the server would reject is
          never offered (see deliveryActionsFor). */}
      <div className="mt-4 space-y-2 border-t border-white/15 pt-4">
        {actions.length === 0 ? (
          <p className="text-sm text-secondary">
            Nothing further to do on this delivery.
          </p>
        ) : disabled ? (
          <p className="flex items-center gap-2 text-sm text-amber-200">
            <WifiOff size={16} aria-hidden /> Offline — reconnect to update this delivery.
          </p>
        ) : (
          actions.map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={busy}
              onClick={() => onAction(assignment, action)}
              className={[
                'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60',
                action.tone === 'primary'
                  ? 'bg-acid-400 text-space-950 hover:bg-acid-400/90 focus-visible:ring-acid-400/70'
                  : action.tone === 'danger'
                    ? 'border border-red-400/40 text-red-200 hover:bg-red-500/10 focus-visible:ring-red-400/70'
                    : 'border border-white/20 text-white hover:bg-white/5 focus-visible:ring-violet-500/60',
              ].join(' ')}
            >
              {busy && action.tone === 'primary' && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {action.label}
            </button>
          ))
        )}
      </div>
    </li>
  );
}
