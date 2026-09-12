'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { Overlay } from './Overlay';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', onConfirm, onCancel, isLoading }: ConfirmDialogProps) {
  return <Overlay open={open} onClose={onCancel} title={title} busy={isLoading}
    footer={<div className="flex flex-wrap justify-end gap-3">
      <button type="button" onClick={onCancel} disabled={isLoading} className="btn-secondary">{cancelLabel}</button>
      <button type="button" onClick={onConfirm} disabled={isLoading} className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}>
        {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden />}{isLoading ? 'Saving…' : confirmLabel}
      </button>
    </div>}>
    <div className="flex items-start gap-3"><AlertTriangle size={22} className={variant === 'danger' ? 'shrink-0 text-red-300' : 'shrink-0 text-amber-300'} aria-hidden /><p className="text-sm text-secondary">{description}</p></div>
  </Overlay>;
}
