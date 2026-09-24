'use client';

import { Printer } from 'lucide-react';

/** Browser print / save-as-PDF. No server round-trip. */
export function PolicyPrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="policy-action">
      <Printer size={15} aria-hidden /> Print / save PDF
    </button>
  );
}
