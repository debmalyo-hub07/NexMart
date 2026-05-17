import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { logger } from '../utils/logger';

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
  });

  // Auth middleware for socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      // Allow unauthenticated connections for public events
      socket.data.userId = null;
      socket.data.role = 'guest';
      return next();
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET_CUSTOMER) as { userId: string; role: string };
      socket.data.userId = decoded.userId;
      socket.data.role = decoded.role;
      next();
    } catch {
      socket.data.userId = null;
      socket.data.role = 'guest';
      next();
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

// ── Event Emitters ───────────────────────────────────────────

export function emitOrderStatusUpdate(
  customerId: string,
  orderId: string,
  status: string,
  data: object = {}
): void {
  const ioInstance = getIO();
  ioInstance.to(`user:${customerId}`).emit('order:status_updated', { orderId, status, ...data });
  ioInstance.to('role:admin').emit('order:status_updated', { orderId, status, customerId, ...data });
}

export function emitNewOrder(orderId: string, data: object = {}): void {
  getIO().to('role:admin').emit('order:new', { orderId, ...data });
}

export function emitStockUpdate(productId: string, variantSku: string, stock: number): void {
  getIO().emit('product:stock_updated', { productId, variantSku, stock });
}

export function emitDashboardStats(stats: object): void {
  getIO().to('role:admin').emit('dashboard:stats_updated', stats);
}
