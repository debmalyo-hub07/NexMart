import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { io as connect, type Socket } from 'socket.io-client';

const cache = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('@upstash/redis', () => ({ Redis: class { get = cache.get; set = cache.set; } }));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: class { static slidingWindow() { return {}; } } }));

import { startTestDb, stopTestDb, clearCollections } from './helpers';
import { Customer } from '../models/Customer';
import { RevokedSession } from '../models/RevokedSession';
import { generateToken } from '../middleware/auth';
import { env } from '../config/env';
import { blacklistToken, isTokenBlacklisted } from '../config/redis';
import { emitOrderStatusUpdate, initializeSocket } from '../config/socket';
import { verifySessionClaims } from '../services/sessionIdentity.service';

const server = createServer();
const sockets = initializeSocket(server);
const clients: Socket[] = [];
let address: string;
beforeAll(async () => {
  await startTestDb('nexmart_socket_revocation');
  await RevokedSession.init();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 120000);
afterAll(async () => {
  clients.forEach(client => client.disconnect());
  await new Promise<void>(resolve => sockets.close(() => resolve()));
  await stopTestDb();
});
beforeEach(async () => {
  clients.forEach(client => client.disconnect());
  clients.length = 0;
  await clearCollections();
  cache.get.mockRejectedValue(new Error('Simulated cache outage'));
  cache.set.mockRejectedValue(new Error('Simulated cache outage'));
});
async function identity(suffix: string) {
  const customer = await Customer.create({ name: 'Socket Customer', email: `${suffix}@example.test`, emailVerified: true });
  const token = generateToken({ id: customer.id, role: 'customer' }, env.JWT_SECRET_CUSTOMER, '1h');
  return { customer, token };
}
function client(token: string) {
  const socket = connect(address, { autoConnect: false, reconnection: false, transports: ['websocket'], auth: { token } });
  clients.push(socket);
  return socket;
}
async function connected(token: string) {
  const socket = client(token);
  await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
  return socket;
}

describe('durable session revocation and live private events', () => {
  it('keeps revocation effective when Redis fails and later returns a cache miss', async () => {
    const { token } = await identity('revoked');
    const claims = verifySessionClaims(token);
    await blacklistToken(claims.jti!, 3600);
    expect(await isTokenBlacklisted(claims.jti)).toBe(true);
    cache.get.mockResolvedValue(null);
    expect(await isTokenBlacklisted(claims.jti)).toBe(true);
    expect(await RevokedSession.countDocuments({ jti: claims.jti })).toBe(1);
    const socket = client(token);
    const rejected = new Promise<Error>(resolve => socket.once('connect_error', resolve));
    socket.connect();
    expect((await rejected).message).toBe('Invalid or expired token');
  });

  it('delivers only to the owner and disconnects a revoked connected session before a private push', async () => {
    const owner = await identity('owner');
    const stranger = await identity('stranger');
    const [owned, other] = await Promise.all([connected(owner.token), connected(stranger.token)]);
    const otherEvents: unknown[] = [];
    other.on('order:status_updated', payload => otherEvents.push(payload));
    const first = new Promise<{ orderId: string }>(resolve => owned.once('order:status_updated', resolve));
    emitOrderStatusUpdate(owner.customer.id, 'ORD-PRIVATE', 'confirmed');
    expect((await first).orderId).toBe('ORD-PRIVATE');
    const leaked: unknown[] = [];
    owned.on('order:status_updated', payload => leaked.push(payload));
    await blacklistToken(verifySessionClaims(owner.token).jti!, 3600);
    const disconnected = new Promise<string>(resolve => owned.once('disconnect', resolve));
    emitOrderStatusUpdate(owner.customer.id, 'ORD-PRIVATE', 'shipped');
    expect(await disconnected).toBe('io server disconnect');
    expect(leaked).toEqual([]);
    expect(otherEvents).toEqual([]);
  });

  it('rejects private pushes after an account is suspended', async () => {
    const owner = await identity('suspended');
    const owned = await connected(owner.token);
    await Customer.updateOne({ _id: owner.customer._id }, { isActive: false });
    const disconnected = new Promise<string>(resolve => owned.once('disconnect', resolve));
    emitOrderStatusUpdate(owner.customer.id, 'ORD-PRIVATE', 'delivered');
    expect(await disconnected).toBe('io server disconnect');
  });
});
