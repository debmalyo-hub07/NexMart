'use client';
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

// Module-level singleton, but rebuilt whenever the auth token changes.
// (The old `if (!socket)` guard meant a guest socket created on first load
// lived forever — even after login.)
let socket: Socket | null = null;
let connectedToken: string | null = null;

export function useSocket() {
  const { data: session } = useSession();
  const token = (session?.user as { accessToken?: string } | undefined)?.accessToken ?? null;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

    // Only connect with a real token: every event this app listens for is
    // user/role-scoped, and a guest socket joins no rooms so it can never
    // receive them.
    if (!token) return;

    if (!socket || connectedToken !== token) {
      socket?.disconnect();
      socket = io(apiUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });
      connectedToken = token;
    }

    socketRef.current = socket;
    return () => {
      // Keep the connection alive across mounts; per-listener cleanup is
      // the consumer's job (the `on()` unsubscribe).
      socketRef.current = null;
    };
  }, [token]);

  const on = useCallback(<T,>(event: string, callback: (data: T) => void) => {
    const target = socketRef.current ?? socket;
    target?.on(event, callback);
    return () => { target?.off(event, callback); };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    (socketRef.current ?? socket)?.emit(event, data);
  }, []);

  return { on, emit, socket: socketRef.current };
}
