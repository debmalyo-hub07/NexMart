'use client';
import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

let shared: Socket | null = null;
let connectedToken: string | null = null;
const consumers = new Map<symbol, Socket>();

export function useSocket() {
  const { data: session } = useSession();
  const token = (session?.user as { accessToken?: string } | undefined)?.accessToken ?? null;
  const [target, setTarget] = useState<Socket | null>(null);
  useEffect(() => {
    if (!token) { shared?.disconnect(); shared = null; connectedToken = null; setTarget(null); return; }
    if (!shared || connectedToken !== token) {
      shared?.disconnect();
      shared = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000', {
        auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: 5,
      });
      connectedToken = token;
    }
    const socket = shared;
    const id = Symbol('socket consumer');
    consumers.set(id, socket);
    setTarget(socket);
    return () => {
      consumers.delete(id);
      if (![...consumers.values()].includes(socket)) {
        socket.disconnect();
        if (shared === socket) { shared = null; connectedToken = null; }
      }
    };
  }, [token]);
  // Consumers re-subscribe after token hydration or a socket replacement.
  const on = useCallback(<T,>(event: string, callback: (data: T) => void) => {
    target?.on(event, callback);
    return () => { target?.off(event, callback); };
  }, [target]);
  const emit = useCallback((event: string, data?: unknown) => { target?.emit(event, data); }, [target]);
  return { on, emit, socket: target };
}
