import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AckResponse } from '@canli-quiz/shared';
import { createSocketServer } from '../socket';

// Kötüye kullanım sınırları küçük değerlerle, veritabanına ihtiyaç duymadan denenir.
let httpServer: HttpServer;
let sockets: ReturnType<typeof createSocketServer>;
let url: string;
const clients: Socket[] = [];

async function client(): Promise<Socket> {
  const socket = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

const emit = (socket: Socket, event: string, payload: unknown) =>
  new Promise<AckResponse<unknown>>((resolve) => socket.emit(event, payload, resolve));

beforeAll(async () => {
  httpServer = createServer();
  sockets = createSocketServer(httpServer, {
    limits: { eventsPerSocket: 5, joinsPerIp: 4, badPinsPerIp: 3 },
  });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(() => {
  for (const c of clients) c.disconnect();
  sockets.games.shutdown();
  sockets.io.close();
});

describe('socket kötüye kullanım sınırları', () => {
  it('hatalı PIN denemeleri sınırı aşınca o IP bir süre engellenir', async () => {
    const socket = await client();
    for (let i = 0; i < 3; i++) {
      expect(await emit(socket, 'player:join', { pin: '999999', nickname: 'Ali' })).toMatchObject({
        error: 'Bu PIN ile bir oyun bulunamadı',
      });
    }
    // Yeni bağlantı açmak da işe yaramaz: sınır IP'ye bağlı.
    const other = await client();
    expect(await emit(other, 'player:rejoin', { pin: '999998', reconnectToken: 'x' })).toEqual({
      ok: false,
      error: 'Çok fazla hatalı PIN denendi, lütfen bir dakika sonra tekrar deneyin',
    });
  });

  it('bir IP dakikada sınırdan fazla katılma denemesi yapamaz', async () => {
    const socket = await client();
    // Önceki testteki 3 deneme + bu deneme = 4 (sınır); sonraki reddedilir.
    await emit(socket, 'player:join', { pin: '999997', nickname: 'Ali' });
    expect(await emit(socket, 'player:join', { pin: '999997', nickname: 'Ali' })).toEqual({
      ok: false,
      error: 'Çok fazla istek gönderdiniz, lütfen biraz bekleyip tekrar deneyin',
    });
  });

  it('bir bağlantı kısa sürede çok fazla olay gönderemez', async () => {
    const socket = await client();
    const replies = await Promise.all(
      Array.from({ length: 7 }, () => emit(socket, 'host:start', { pin: '123456' })),
    );
    const limited = replies.filter((r) => !r.ok && r.error.startsWith('Çok fazla istek'));
    expect(limited).toHaveLength(2);
  });
});
