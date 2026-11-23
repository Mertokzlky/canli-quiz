import { randomUUID } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  AckResponse,
  ClientToServerEvents,
  HostView,
  PlayerView,
  QuizInput,
  ServerToClientEvents,
} from '@canli-quiz/shared';
import { createApp } from '../app';
import { prisma } from '../db';
import { createSocketServer } from '../socket';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const app = createApp();
const RUN_ID = randomUUID().slice(0, 8);
let httpServer: HttpServer;
let sockets: ReturnType<typeof createSocketServer>;
let url: string;
let token: string;
let quizId: string;
const clients: ClientSocket[] = [];

const quiz: QuizInput = {
  title: 'Soket Testi',
  isPublic: false,
  questions: [
    {
      text: '1 + 1 kaçtır?',
      timeLimitSec: 20,
      choices: [
        { text: '2', isCorrect: true },
        { text: '3', isCorrect: false },
      ],
    },
    {
      text: 'Türkiye kaç ildir?',
      timeLimitSec: 10,
      choices: [
        { text: '80', isCorrect: false },
        { text: '81', isCorrect: true },
      ],
    },
  ],
};

/** Yeni bir soket istemcisi açar ve bağlanmasını bekler. */
async function client(authToken?: string): Promise<ClientSocket> {
  const socket: ClientSocket = connect(url, {
    auth: authToken ? { token: authToken } : {},
    transports: ['websocket'],
    forceNew: true,
  });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

/** Bir olayı gönderip sunucunun cevabını (ack) bekler. */
function emit<T>(socket: ClientSocket, event: string, payload: unknown): Promise<AckResponse<T>> {
  return new Promise((resolve) =>
    (socket.emit as (e: string, p: unknown, cb: (r: AckResponse<T>) => void) => void)(
      event,
      payload,
      resolve,
    ),
  );
}

/** Koşulu sağlayan ilk görünüm mesajını bekler. */
function waitForView<T extends HostView | PlayerView>(
  socket: ClientSocket,
  event: 'host:view' | 'player:view',
  predicate: (view: T) => boolean,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} beklenirken zaman aşımı`)), 3000);
    const listener = (view: T) => {
      if (!predicate(view)) return;
      clearTimeout(timeout);
      socket.off(event, listener as never);
      resolve(view);
    };
    socket.on(event, listener as never);
  });
}

beforeAll(async () => {
  httpServer = createServer(app);
  sockets = createSocketServer(httpServer, { hostGraceMs: 200, endedRetentionMs: 200 });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;

  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      email: `test-${RUN_ID}-host@example.com`,
      password: 'gizli-sifre-123',
      displayName: 'Sunucu',
    });
  token = reg.body.token;
  const created = await request(app)
    .post('/api/quizzes')
    .set('Authorization', `Bearer ${token}`)
    .send(quiz);
  quizId = created.body.id;
});

afterAll(async () => {
  for (const c of clients) c.disconnect();
  sockets.games.shutdown();
  sockets.io.close();
  await prisma.user.deleteMany({ where: { email: { startsWith: `test-${RUN_ID}-` } } });
  await prisma.$disconnect();
});

describe('canlı oyun akışı', () => {
  it('giriş yapmamış kullanıcı oyun açamaz', async () => {
    const anon = await client();
    const res = await emit(anon, 'host:create', { quizId });
    expect(res).toEqual({ ok: false, error: 'Oyun başlatmak için giriş yapmalısınız' });
  });

  it('olmayan PIN ve bozuk girdi anlaşılır hata döner', async () => {
    const anon = await client();
    expect(await emit(anon, 'player:join', { pin: '999999', nickname: 'Ali' })).toMatchObject({
      ok: false,
      error: 'Bu PIN ile bir oyun bulunamadı',
    });
    expect(await emit(anon, 'player:join', { pin: 'abc', nickname: 'Ali' })).toMatchObject({
      ok: false,
      error: 'Geçersiz PIN',
    });
  });

  it('baştan sona bir oyun oynanır, kopan oyuncu geri döner ve sonuçlar kaydedilir', async () => {
    const host = await client(token);
    const created = await emit<{ pin: string }>(host, 'host:create', { quizId });
    expect(created.ok).toBe(true);
    const pin = (created as { data: { pin: string } }).data.pin;
    expect(pin).toMatch(/^\d{6}$/);

    // İki oyuncu katılır
    const ayse = await client();
    const lobbyWithBoth = waitForView<HostView>(host, 'host:view', (v) => v.players.length === 2);
    const joinedAyse = await emit<{ playerId: string; reconnectToken: string }>(
      ayse,
      'player:join',
      {
        pin,
        nickname: 'Ayşe',
      },
    );
    expect(joinedAyse.ok).toBe(true);
    const ayseToken = (joinedAyse as { data: { reconnectToken: string } }).data.reconnectToken;

    let mehmet = await client();
    await emit(mehmet, 'player:join', { pin, nickname: 'Mehmet' });
    expect((await lobbyWithBoth).phase).toBe('LOBBY');

    // Oyuncu oyunu başlatamaz
    expect(await emit(ayse, 'host:start', { pin })).toMatchObject({ ok: false });

    // 1. soru
    const ayseQuestion = waitForView<PlayerView>(
      ayse,
      'player:view',
      (v) => v.phase === 'QUESTION',
    );
    expect(await emit(host, 'host:start', { pin })).toEqual({ ok: true, data: undefined });
    const q1 = (await ayseQuestion).question!;
    expect(q1.text).toBe('1 + 1 kaçtır?');
    expect(JSON.stringify(q1)).not.toContain('isCorrect');

    // Ayşe'nin bağlantısı kopar ve katılırken aldığı token ile soru ortasında geri döner
    ayse.disconnect();
    const ayseBack = await client();
    const backView = waitForView<PlayerView>(ayseBack, 'player:view', () => true);
    expect(await emit(ayseBack, 'player:rejoin', { pin, reconnectToken: ayseToken })).toEqual({
      ok: true,
      data: undefined,
    });
    expect((await backView).phase).toBe('QUESTION');

    // Geri dönen oyuncu cevap verebilir, ikinci kez veremez
    const reveal = waitForView<HostView>(host, 'host:view', (v) => v.phase === 'REVEAL');
    expect(await emit(ayseBack, 'player:answer', { pin, choiceId: q1.choices[0]!.id })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(
      await emit(ayseBack, 'player:answer', { pin, choiceId: q1.choices[0]!.id }),
    ).toMatchObject({ ok: false, error: 'Bu soruya zaten cevap verdiniz' });
    await emit(mehmet, 'player:answer', { pin, choiceId: q1.choices[1]!.id });
    const revealView = await reveal;
    expect(revealView.reveal?.correctChoiceId).toBe(q1.choices[0]!.id);

    // Sıralama ve 2. soru
    await emit(host, 'host:next', { pin });
    const q2View = waitForView<PlayerView>(mehmet, 'player:view', (v) => v.phase === 'QUESTION');
    await emit(host, 'host:next', { pin });
    const q2 = (await q2View).question!;
    expect(q2.index).toBe(1);

    // Mehmet sayfayı yeniler gibi bağlantısını koparır; Ayşe cevaplayınca soru kapanır
    mehmet.disconnect();
    mehmet = await client();
    const ended = waitForView<HostView>(host, 'host:view', (v) => v.phase === 'ENDED');
    await emit(ayseBack, 'player:answer', { pin, choiceId: q2.choices[1]!.id });
    await emit(host, 'host:next', { pin });
    const final = await ended;
    expect(final.leaderboard.map((e) => [e.nickname, e.rank])).toEqual([
      ['Ayşe', 1],
      ['Mehmet', 2],
    ]);

    // Sonuçlar veritabanına yazıldı
    await expect
      .poll(
        () => prisma.gameSession.findFirst({ where: { pin, quizId }, include: { results: true } }),
        { timeout: 5000 },
      )
      .toMatchObject({ status: 'FINISHED', results: expect.arrayContaining([expect.anything()]) });
    const session = await prisma.gameSession.findFirst({
      where: { pin, quizId },
      include: { results: { orderBy: { rank: 'asc' } } },
    });
    expect(session?.results.map((r) => [r.nickname, r.correctCount])).toEqual([
      ['Ayşe', 2],
      ['Mehmet', 0],
    ]);
  });

  it('sunucu ekranı ayrılıp dönmezse oyuncular bilgilendirilir ve oyun kapanır', async () => {
    const host = await client(token);
    const created = await emit<{ pin: string }>(host, 'host:create', { quizId });
    const pin = (created as { data: { pin: string } }).data.pin;

    const player = await client();
    await emit(player, 'player:join', { pin, nickname: 'Zeynep' });
    const closed = new Promise((resolve) => player.once('game:closed', resolve));
    host.disconnect();

    expect(await closed).toMatchObject({ reason: 'host-left' });
    expect(await emit(player, 'player:join', { pin, nickname: 'Zeynep' })).toMatchObject({
      ok: false,
      error: 'Bu PIN ile bir oyun bulunamadı',
    });
  });

  it('sayfayı yenileyen sunucu ekranı oyununa geri döner', async () => {
    const host = await client(token);
    const created = await emit<{ pin: string }>(host, 'host:create', { quizId });
    const pin = (created as { data: { pin: string } }).data.pin;
    host.disconnect();

    const hostBack = await client(token);
    const view = waitForView<HostView>(hostBack, 'host:view', () => true);
    expect(await emit(hostBack, 'host:rejoin', { pin })).toEqual({ ok: true, data: undefined });
    expect((await view).pin).toBe(pin);

    // Başka bir kullanıcı bu oyunu devralamaz
    const intruderReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: `test-${RUN_ID}-intruder@example.com`,
        password: 'gizli-sifre-123',
        displayName: 'Başkası',
      });
    const intruder = await client(intruderReg.body.token);
    expect(await emit(intruder, 'host:rejoin', { pin })).toMatchObject({
      ok: false,
      error: 'Bu oyunun sunucusu değilsiniz',
    });
  });
});
