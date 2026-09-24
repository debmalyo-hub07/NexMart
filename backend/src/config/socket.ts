import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from './env';
import { logger } from '../utils/logger';
import { resolveSessionIdentity } from '../services/sessionIdentity.service';

let io: SocketIOServer;

export function initializeSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.SOCKET_CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 65536,
  });

  // Auth middleware for socket connections
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      // Allow unauthenticated connections for public events
      socket.data.userId = null;
      socket.data.role = 'guest';
      return next();
    }

    try {
      if (typeof token !== 'string') throw new Error('Invalid token');
      const decoded = await resolveSessionIdentity(token);
      socket.data.userId = decoded.id;
      socket.data.role = decoded.role;
      socket.data.token = token;
      socket.data.expiresAt = decoded.exp * 1000;
      next();
    } catch {
      // A token WAS presented but is invalid/expired — reject the connection
      // rather than silently downgrading to a guest (prevents room-spoofing attempts).
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId, role } = socket.data;

    if (userId) {
      // Join personal room
      socket.join(`user:${userId}`);
      // Join role room
      socket.join(`role:${role}`);
      logger.debug(`Socket connected: user=${userId} role=${role}`);
      const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, Math.min(socket.data.expiresAt - Date.now(), 2147483647)));
      expiry.unref();
      socket.once('disconnect', () => clearTimeout(expiry));
    }

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: user=${userId}`);
    });
  });

  logger.info('✅ Socket.io initialized');
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

/** Re-check before every private push: a connected socket cannot outlive
 * logout, suspension, or a credential change and keep receiving account data. */
function emitPrivate(rooms: string[], event: string, payload: object): void {
  if (!io) return;
  const targets = [...io.sockets.sockets.values()].filter(socket => rooms.some(room => socket.rooms.has(room)));
  void Promise.all(targets.map(async socket => {
    try {
      const identity = await resolveSessionIdentity(socket.data.token);
      if (identity.id !== socket.data.userId || identity.role !== socket.data.role) { socket.disconnect(true); return; }
      if (socket.connected) socket.emit(event, payload);
    } catch { socket.disconnect(true); }
  })).catch(error => logger.error('Private socket delivery failed', error));
}

// ── Event Emitters ───────────────────────────────────────────

export function emitOrderStatusUpdate(
  customerId: string,
  orderId: string,
  status: string,
  data: object = {}
): void {
  emitPrivate([`user:${customerId}`], 'order:status_updated', { orderId, status, ...data });
  emitPrivate(['role:admin'], 'order:status_updated', { orderId, status, customerId, ...data });
}

export function emitNewOrder(orderId: string, data: object = {}): void {
  // Order creation is durable even when the optional realtime channel is not
  // available (for example during startup, in a worker, or in tests). A
  // notification failure must never turn a committed checkout into a retry
  // response or cause a second order attempt.
  try {
    emitPrivate(['role:admin'], 'order:new', { orderId, ...data });
  } catch (err) {
    logger.warn('Socket emitNewOrder skipped:', err instanceof Error ? err.message : err);
  }
}

export function emitStockUpdate(productId: string, variantSku: string, stock: number): void {
  getIO().emit('product:stock_updated', { productId, variantSku, stock });
}

export function emitDashboardStats(stats: object): void {
  emitPrivate(['role:admin'], 'dashboard:stats_updated', stats);
}

export function emitAgentStatusUpdate(agentId: string, status: string): void {
  try {
    emitPrivate([`user:${agentId}`], 'agent:status_updated', { agentId, status });
  } catch (err) {
    logger.error('Socket emitAgentStatusUpdate failed:', err);
  }
}

// Real-time assignment notification for the delivery agent's room. The email
// is the durable channel; this makes the agent's dashboard update instantly.
export function emitDeliveryAssigned(agentId: string, orderId: string, data: object = {}): void {
  try {
    emitPrivate([`user:${agentId}`], 'delivery:assigned', { orderId, ...data });
  } catch (err) {
    logger.error('Socket emitDeliveryAssigned failed:', err);
  }
}
