'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { SOCKET_EVENTS } from '@/lib/socketEvents';

export function useOrderUpdates() {
  const { on } = useSocket();
  const client = useQueryClient();
  useEffect(() => on(SOCKET_EVENTS.orderStatusUpdated, () => { void client.invalidateQueries({ queryKey: ['customer', 'orders'] }); }), [on, client]);
}
