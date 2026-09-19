'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

export function Select({ id, value, onChange, options, label }: { id: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; label: string }) {
  return <RadixSelect.Root value={value} onValueChange={onChange}>
    <RadixSelect.Trigger id={id} className="select-trigger" aria-label={label}><RadixSelect.Value /><RadixSelect.Icon><ChevronDown size={16} aria-hidden /></RadixSelect.Icon></RadixSelect.Trigger>
    <RadixSelect.Portal><RadixSelect.Content className="select-content" position="popper" align="end" sideOffset={8} collisionPadding={12}>
      <RadixSelect.ScrollUpButton className="flex justify-center py-2"><ChevronUp size={16} aria-hidden /></RadixSelect.ScrollUpButton>
      <RadixSelect.Viewport className="p-1.5">{options.map(option => <RadixSelect.Item key={option.value} value={option.value} className="select-option"><RadixSelect.ItemText>{option.label}</RadixSelect.ItemText><RadixSelect.ItemIndicator><Check size={16} aria-hidden /></RadixSelect.ItemIndicator></RadixSelect.Item>)}</RadixSelect.Viewport>
      <RadixSelect.ScrollDownButton className="flex justify-center py-2"><ChevronDown size={16} aria-hidden /></RadixSelect.ScrollDownButton>
    </RadixSelect.Content></RadixSelect.Portal>
  </RadixSelect.Root>;
}
