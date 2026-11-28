import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@canli-quiz/shared';
import { verifyToken } from './auth/token';
import { env } from './env';
import { clientIp } from './net';
import { GameManager, type GameManagerOptions, type SocketData } from './game/manager';

export type QuizServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export function createSocketServer(httpServer: HttpServer, options?: GameManagerOptions) {
  const io: QuizServer = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN },
    // Mesajlar küçük; büyük paketlerle sunucuyu yormaya çalışanları keser.
    maxHttpBufferSize: 16 * 1024,
  });

  // Token göndermek isteğe bağlı: oyuncular giriş yapmadan katılır, sunucu ekranı için gerekir.
  io.use((socket, next) => {
    socket.data.ip = clientIp(
      socket.handshake.address,
      socket.handshake.headers['x-forwarded-for'],
      env.TRUST_PROXY,
    );
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token === 'string') socket.data.userId = verifyToken(token) ?? undefined;
    next();
  });

  const games = new GameManager(io, options);
  io.on('connection', (socket) => games.attach(socket));

  return { io, games };
}
