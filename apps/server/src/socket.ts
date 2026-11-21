import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@canli-quiz/shared';
import { env } from './env';

export type QuizServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function createSocketServer(httpServer: HttpServer): QuizServer {
  const io: QuizServer = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN },
    // Telefon kilitlenip açıldığında oturumu kısa süre korur (yeniden bağlanma).
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] bağlandı: ${socket.id}`);

    // Oyun motoru 3-4. haftada eklenecek. Şimdilik olaylar tanımlı ama uygulanmadı.
    const notImplemented = (_payload: unknown, ack: (r: { ok: false; error: string }) => void) =>
      ack({ ok: false, error: 'Henüz uygulanmadı' });

    socket.on('host:create', notImplemented);
    socket.on('host:start', notImplemented);
    socket.on('host:next', notImplemented);
    socket.on('player:join', notImplemented);
    socket.on('player:rejoin', notImplemented);
    socket.on('player:answer', notImplemented);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] ayrıldı: ${socket.id} (${reason})`);
    });
  });

  return io;
}
