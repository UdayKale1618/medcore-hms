import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const getSocketCorsOrigins = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  if (configuredOrigins.length > 0) {
    return isProduction
      ? configuredOrigins
      : [...configuredOrigins, 'http://localhost:3000', 'http://127.0.0.1:3000'];
  }
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
};

@WebSocketGateway({
  cors: {
    origin: getSocketCorsOrigins(),
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly jwtService: JwtService) { }

  async handleConnection(client: Socket) {
    try {
      const authHeader =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization ||
        client.handshake.query?.token;

      if (!authHeader) {
        this.logger.warn(`Socket connection rejected: No authentication token`);
        client.disconnect();
        return;
      }

      const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : String(authHeader).trim();

      const secret =
        process.env.JWT_ACCESS_SECRET || 'test-jwt-secret-key-12345678901234567890';
      const payload = this.jwtService.verify(token, { secret });

      if (!payload || !payload.userId) {
        client.disconnect();
        return;
      }

      // Attach authenticated identity to socket client
      client.data.userId = payload.userId;
      client.data.hospitalId = payload.hospitalId;
      client.data.role = payload.role;

      // Join tenant & user specific isolated rooms
      client.join(`user:${payload.userId}`);
      if (payload.hospitalId) {
        client.join(`hospital:${payload.hospitalId}`);
      }

      this.logger.log(
        `Socket connected: user=${payload.userId}, hospital=${payload.hospitalId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Socket authentication failed: ${message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  // Multi-tenant and user scoped emission
  emitToUser(userId: string, event: string, payload: unknown) {
    if (this.server) {
      this.server.to(`user:${userId}`).emit(event, payload);
    }
  }

  emitToHospital(hospitalId: string, event: string, payload: unknown) {
    if (this.server) {
      this.server.to(`hospital:${hospitalId}`).emit(event, payload);
    }
  }
}
