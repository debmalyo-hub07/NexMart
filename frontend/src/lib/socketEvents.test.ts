import { describe, it, expect } from 'vitest';
import { SOCKET_EVENTS } from './socketEvents';

describe('SOCKET_EVENTS (contract with backend/src/config/socket.ts)', () => {
  it('order status event uses the backend spelling — order:status_updated', () => {
    expect(SOCKET_EVENTS.orderStatusUpdated).toBe('order:status_updated');
  });
});
