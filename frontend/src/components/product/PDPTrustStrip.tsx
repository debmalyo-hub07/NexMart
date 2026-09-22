'use client';

import { useState } from 'react';
import { BadgeIndianRupee, CalendarClock, Lock, MapPin, RotateCcw, ShieldCheck } from 'lucide-react';

/**
 * PDP trust block (audit 2026-09-22 §D3): the reassurance an Amazon/Flipkart
 * buyer scans for before adding to cart — delivery check by pincode, returns
 * window, GST-inclusive pricing, and how payment is handled.
 *
 * The pincode estimate is derived from the published standard shipping rule
 * (3–6 working days, ₹49 below ₹999 / free above) — it never invents a
 * courier commitment the fulfilment side has not made.
 */
const STANDARD_DAYS_MIN = 3;
const STANDARD_DAYS_MAX = 6;

function estimateWindow(pincode: string) {
  // Same broad window nationwide; the input only confirms the code is serviceable-shaped.
  if (!/^[1-9]\d{5}$/.test(pincode)) return null;
  const start = new Date();
  start.setDate(start.getDate() + STANDARD_DAYS_MIN);
  const end = new Date();
  end.setDate(end.getDate() + STANDARD_DAYS_MAX);
  const fmt = (date: Date) => date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function PDPTrustStrip() {
  const [pincode, setPincode] = useState('');
  const [applied, setApplied] = useState('');
  const window_ = estimateWindow(applied);
  const invalid = applied.length === 6 && !window_;

  return <section aria-label="Delivery and assurance" className="mt-6 space-y-4 rounded-xl border border-[var(--border)] bg-[#FAFAF8] p-4">
    <div>
      <label htmlFor="pdp-pincode" className="flex items-center gap-2 text-sm font-medium"><MapPin size={16} className="text-orange-500" aria-hidden />Check delivery to your pincode</label>
      <div className="mt-2 flex gap-2">
        <input id="pdp-pincode" inputMode="numeric" maxLength={6} value={pincode} onChange={event => setPincode(event.target.value.replace(/\D/g, ''))} placeholder="6-digit pincode" className="input min-h-11 w-40" aria-describedby="pdp-pincode-help" />
        <button type="button" className="btn-secondary min-h-11" onClick={() => setApplied(pincode)}>Check</button>
      </div>
      <p id="pdp-pincode-help" className="mt-2 text-xs leading-relaxed text-muted" role="status">
        {window_ ? <>Standard delivery <strong className="text-[var(--text-primary)]">{window_}</strong> · free above ₹999, ₹49 below.</>
          : invalid ? <span className="text-red-600">Enter a valid 6-digit pincode.</span>
          : 'Standard shipping takes 3–6 working days. Free on item subtotals over ₹999.'}
      </p>
    </div>
    <ul className="grid gap-3 border-t border-[var(--border)] pt-4 text-xs leading-relaxed text-secondary sm:grid-cols-2">
      <li className="flex items-start gap-2"><RotateCcw size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /><span><strong className="text-[var(--text-primary)]">7-day easy returns</strong> on eligible items from your orders page.</span></li>
      <li className="flex items-start gap-2"><BadgeIndianRupee size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /><span><strong className="text-[var(--text-primary)]">Price includes GST</strong> — the total never grows at checkout.</span></li>
      <li className="flex items-start gap-2"><Lock size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /><span><strong className="text-[var(--text-primary)]">Secure payments</strong> via Razorpay — UPI, cards, netbanking.</span></li>
      <li className="flex items-start gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /><span><strong className="text-[var(--text-primary)]">Cash on delivery</strong> where available, plus a clear invoice every time.</span></li>
      <li className="flex items-start gap-2 sm:col-span-2"><CalendarClock size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /><span className="text-muted">Estimates follow our published shipping policy and exclude seller dispatch delays, which are shown on the order.</span></li>
    </ul>
  </section>;
}
