import { randomInt } from 'node:crypto';
import { z } from 'zod';
import {
  NICKNAME_MAX_LENGTH,
  PIN_LENGTH,
  type Ack,
  type AckResponse,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@canli-quiz/shared';
import type { Prisma } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { prisma } from '../db';
import { RateLimiter } from '../rateLimit';
import { Game, GameError, type GameChange, type GameQuiz } from './game';

type QuizServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type QuizSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export interface SocketData {
  /** İstemcinin IP adresi (deneme sınırları için). */
  ip?: string;
  /** El sıkışmada geçerli token gönderildiyse giriş yapmış kullanıcı. */
  userId?: string;
  /** Bu bağlantının bağlı olduğu oyun ve rolü. */
  pin?: string;
  playerId?: string;
  isHost?: boolean;
}

interface GameEntry {
  game: Game;
  hostSocketId: string | null;
  /** playerId → socket id. Bağlantısı kopan oyuncu listede kalır ama soketi silinir. */
  playerSockets: Map<string, string>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  saved: boolean;
}

export interface GameManagerOptions {
  /** Sunucu ekranı kopunca oyunun beklendiği süre. */
  hostGraceMs?: number;
  /** Biten oyunun, geç dönen oyuncular sonucu görebilsin diye bellekte kaldığı süre. */
  endedRetentionMs?: number;
  /** Kötüye kullanıma karşı sınırlar. Testlerde küçültülebilir. */
  limits?: Partial<typeof DEFAULT_LIMITS>;
}

/**
 * Kötüye kullanıma karşı sınırlar. Bir sınıf aynı internet bağlantısını (aynı IP) paylaşabildiği
 * için IP başına katılma sınırı cömert tutulur.
 */
const DEFAULT_LIMITS = {
  /** Bir bağlantının 10 saniyede gönderebileceği olay sayısı. */
  eventsPerSocket: 40,
  /** Aynı IP'den dakikada en fazla katılma denemesi. */
  joinsPerIp: 120,
  /** Aynı IP'den dakikada en fazla hatalı PIN (PIN tahmin etmeye karşı). */
  badPinsPerIp: 20,
};

const TOO_MANY = 'Çok fazla istek gönderdiniz, lütfen biraz bekleyip tekrar deneyin';

const pinSchema = z.string().regex(new RegExp(`^\\d{${PIN_LENGTH}}$`), 'Geçersiz PIN');
const idSchema = z.string().min(1).max(100);
const schemas = {
  create: z.object({ quizId: idSchema }),
  pin: z.object({ pin: pinSchema }),
  join: z.object({ pin: pinSchema, nickname: z.string().max(NICKNAME_MAX_LENGTH * 2) }),
  rejoin: z.object({ pin: pinSchema, reconnectToken: z.string().min(1).max(100) }),
  kick: z.object({ pin: pinSchema, playerId: idSchema }),
  answer: z.object({ pin: pinSchema, choiceId: idSchema }),
};

/**
 * Bir olay işleyicisini sarar: girdiyi doğrular, hataları kullanıcıya uygun mesaja çevirir
 * ve istemci callback göndermediyse çökmez.
 */
function handler<S extends z.ZodType, T>(schema: S, fn: (input: z.output<S>) => Promise<T> | T) {
  return async (payload: unknown, ack?: Ack<T>) => {
    const reply = (response: AckResponse<T>) => {
      if (typeof ack === 'function') ack(response);
    };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      reply({ ok: false, error: parsed.error.issues[0]?.message ?? 'Geçersiz istek' });
      return;
    }
    try {
      reply({ ok: true, data: await fn(parsed.data) });
    } catch (error) {
      if (error instanceof GameError) {
        reply({ ok: false, error: error.message });
      } else {
        console.error('[game] beklenmeyen hata:', error);
        reply({ ok: false, error: 'Beklenmeyen bir hata oluştu' });
      }
    }
  };
}

export class GameManager {
  private readonly games = new Map<string, GameEntry>();
  private readonly hostGraceMs: number;
  private readonly endedRetentionMs: number;
  private readonly socketEvents: RateLimiter;
  private readonly joins: RateLimiter;
  private readonly badPins: RateLimiter;

  constructor(
    private readonly io: QuizServer,
    options: GameManagerOptions = {},
  ) {
    this.hostGraceMs = options.hostGraceMs ?? 5 * 60 * 1000;
    this.endedRetentionMs = options.endedRetentionMs ?? 10 * 60 * 1000;
    const limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.socketEvents = new RateLimiter(limits.eventsPerSocket, 10_000);
    this.joins = new RateLimiter(limits.joinsPerIp, 60_000);
    this.badPins = new RateLimiter(limits.badPinsPerIp, 60_000);
  }

  get activeGameCount() {
    return this.games.size;
  }

  attach(socket: QuizSocket) {
    // Bağlantı başına olay sınırı: aşan olaylar işlenmez, cevap bekleyene hata döner.
    socket.use(([, ...args], next) => {
      if (this.socketEvents.take(socket.id)) {
        next();
        return;
      }
      const ack = args.at(-1);
      if (typeof ack === 'function') ack({ ok: false, error: TOO_MANY });
    });

    socket.on(
      'host:create',
      handler(schemas.create, async ({ quizId }) => {
        const userId = this.requireUser(socket);
        const quiz = await this.loadQuiz(quizId, userId);
        this.leaveCurrentGame(socket);

        const pin = this.generatePin();
        const entry: GameEntry = {
          game: new Game(pin, quiz, userId, (_game, change) => this.broadcast(pin, change)),
          hostSocketId: socket.id,
          playerSockets: new Map(),
          cleanupTimer: null,
          saved: false,
        };
        this.games.set(pin, entry);
        Object.assign(socket.data, { pin, isHost: true, playerId: undefined });
        this.broadcast(pin);
        return { pin };
      }),
    );

    socket.on(
      'host:rejoin',
      handler(schemas.pin, ({ pin }) => {
        const entry = this.getEntry(pin);
        if (entry.game.hostUserId !== this.requireUser(socket)) {
          throw new GameError('Bu oyunun sunucusu değilsiniz');
        }
        this.leaveCurrentGame(socket);
        entry.hostSocketId = socket.id;
        this.cancelCleanup(entry);
        if (entry.game.phase === 'ENDED') this.scheduleCleanup(pin, this.endedRetentionMs);
        Object.assign(socket.data, { pin, isHost: true, playerId: undefined });
        this.broadcast(pin);
        return undefined;
      }),
    );

    const hostAction = (fn: (game: Game) => void) =>
      handler(schemas.pin, ({ pin }) => {
        fn(this.hostGame(socket, pin));
        return undefined;
      });

    socket.on(
      'host:start',
      hostAction((game) => game.start()),
    );
    socket.on(
      'host:next',
      hostAction((game) => game.next()),
    );
    socket.on(
      'host:end',
      hostAction((game) => game.end()),
    );

    socket.on(
      'host:kick',
      handler(schemas.kick, ({ pin, playerId }) => {
        const game = this.hostGame(socket, pin);
        const entry = this.getEntry(pin);
        game.kickPlayer(playerId);

        const kickedSocketId = entry.playerSockets.get(playerId);
        entry.playerSockets.delete(playerId);
        if (kickedSocketId) {
          this.io.to(kickedSocketId).emit('game:closed', {
            reason: 'kicked',
            message: 'Sunucu sizi oyundan çıkardı',
          });
          const kicked = this.io.sockets.sockets.get(kickedSocketId);
          if (kicked) Object.assign(kicked.data, { pin: undefined, playerId: undefined });
        }
        return undefined;
      }),
    );

    socket.on(
      'player:join',
      handler(schemas.join, ({ pin, nickname }) => {
        if (!this.joins.take(this.ipOf(socket))) throw new GameError(TOO_MANY);
        const entry = this.findEntryForPlayer(socket, pin);
        // Aynı bağlantı aynı oyuna ikinci kez katılamaz; aksi halde tek kişi lobiyi doldurabilirdi.
        if (socket.data.pin === pin && socket.data.playerId) {
          throw new GameError('Bu oyuna zaten katıldınız');
        }
        this.leaveCurrentGame(socket);
        const result = entry.game.addPlayer(nickname);
        entry.playerSockets.set(result.playerId, socket.id);
        Object.assign(socket.data, { pin, playerId: result.playerId, isHost: false });
        // addPlayer zaten yayın yaptı ama o anda soket henüz eşleşmemişti.
        this.sendPlayerView(entry, result.playerId);
        return result;
      }),
    );

    socket.on(
      'player:rejoin',
      handler(schemas.rejoin, ({ pin, reconnectToken }) => {
        const entry = this.findEntryForPlayer(socket, pin);
        const playerId = entry.game.findPlayerByToken(reconnectToken);
        if (!playerId) throw new GameError('Oturumunuz bulunamadı, lütfen tekrar katılın');

        this.leaveCurrentGame(socket);
        // Aynı oyuncu başka bir sekmeden dönerse eski bağlantı devre dışı kalır.
        entry.playerSockets.set(playerId, socket.id);
        Object.assign(socket.data, { pin, playerId, isHost: false });
        entry.game.setPlayerConnected(playerId, true);
        this.sendPlayerView(entry, playerId);
        return undefined;
      }),
    );

    socket.on(
      'player:answer',
      handler(schemas.answer, ({ pin, choiceId }) => {
        const entry = this.getEntry(pin);
        const playerId = socket.data.playerId;
        if (
          socket.data.pin !== pin ||
          !playerId ||
          entry.playerSockets.get(playerId) !== socket.id
        ) {
          throw new GameError('Bu oyunda oyuncu değilsiniz');
        }
        entry.game.answer(playerId, choiceId);
        return undefined;
      }),
    );

    socket.on('disconnect', () => {
      this.socketEvents.forget(socket.id);
      this.leaveCurrentGame(socket);
    });
  }

  /** Testler ve kapanış için: tüm oyunların zamanlayıcılarını durdurur. */
  shutdown() {
    for (const [pin] of this.games) this.removeGame(pin);
  }

  // ---------- Yardımcılar ----------

  private requireUser(socket: QuizSocket): string {
    if (!socket.data.userId) throw new GameError('Oyun başlatmak için giriş yapmalısınız');
    return socket.data.userId;
  }

  private ipOf(socket: QuizSocket): string {
    return socket.data.ip ?? socket.handshake.address;
  }

  /**
   * Oyuncunun girdiği PIN'in oyununu bulur. Aynı IP'den çok sayıda hatalı PIN gelirse bir süre
   * engellenir; böylece 6 haneli PIN'ler deneme yanılmayla taranıp açık oyunlar bulunamaz.
   */
  private findEntryForPlayer(socket: QuizSocket, pin: string): GameEntry {
    const ip = this.ipOf(socket);
    if (this.badPins.isLimited(ip)) {
      throw new GameError('Çok fazla hatalı PIN denendi, lütfen bir dakika sonra tekrar deneyin');
    }
    const entry = this.games.get(pin);
    if (!entry) {
      this.badPins.take(ip);
      throw new GameError('Bu PIN ile bir oyun bulunamadı');
    }
    return entry;
  }

  private getEntry(pin: string): GameEntry {
    const entry = this.games.get(pin);
    if (!entry) throw new GameError('Bu PIN ile bir oyun bulunamadı');
    return entry;
  }

  private hostGame(socket: QuizSocket, pin: string): Game {
    const entry = this.getEntry(pin);
    if (entry.hostSocketId !== socket.id) throw new GameError('Bu oyunun sunucusu değilsiniz');
    return entry.game;
  }

  private async loadQuiz(quizId: string, userId: string): Promise<GameQuiz> {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { choices: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!quiz || (!quiz.isPublic && quiz.ownerId !== userId)) {
      throw new GameError('Quiz bulunamadı');
    }
    return {
      id: quiz.id,
      title: quiz.title,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl,
        timeLimitSec: q.timeLimitSec,
        choices: q.choices.map((c) => ({ id: c.id, text: c.text, isCorrect: c.isCorrect })),
      })),
    };
  }

  private generatePin(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      const min = 10 ** (PIN_LENGTH - 1);
      const pin = String(randomInt(min, 10 ** PIN_LENGTH));
      if (!this.games.has(pin)) return pin;
    }
    throw new GameError('Şu an yeni oyun açılamıyor, lütfen tekrar deneyin');
  }

  /** Soketi bağlı olduğu oyundan ayırır (bağlantı koptuğunda veya başka oyuna geçerken). */
  private leaveCurrentGame(socket: QuizSocket) {
    const { pin, playerId, isHost } = socket.data;
    Object.assign(socket.data, { pin: undefined, playerId: undefined, isHost: undefined });
    if (!pin) return;
    const entry = this.games.get(pin);
    if (!entry) return;

    if (isHost && entry.hostSocketId === socket.id) {
      entry.hostSocketId = null;
      // Biten oyun zaten temizlenecek; devam eden oyunda sunucuya dönmesi için süre tanınır.
      if (entry.game.phase !== 'ENDED') this.scheduleCleanup(pin, this.hostGraceMs, 'host-left');
    }
    if (playerId && entry.playerSockets.get(playerId) === socket.id) {
      entry.playerSockets.delete(playerId);
      entry.game.setPlayerConnected(playerId, false);
    }
  }

  private broadcast(pin: string, change: GameChange = { type: 'all' }) {
    const entry = this.games.get(pin);
    if (!entry) return;
    const { game } = entry;

    if (entry.hostSocketId) this.io.to(entry.hostSocketId).emit('host:view', game.hostView());
    if (change.type === 'answer') {
      // Bir cevap sadece o oyuncunun ekranını değiştirir; diğerlerine gönderilecek bir şey yok.
      this.sendPlayerView(entry, change.playerId);
      return;
    }
    for (const playerId of entry.playerSockets.keys()) this.sendPlayerView(entry, playerId);

    if (game.phase === 'ENDED' && !entry.saved) {
      entry.saved = true;
      void this.saveResults(game);
      this.scheduleCleanup(pin, this.endedRetentionMs);
    }
  }

  private sendPlayerView(entry: GameEntry, playerId: string) {
    const socketId = entry.playerSockets.get(playerId);
    const view = entry.game.playerView(playerId);
    if (socketId && view) this.io.to(socketId).emit('player:view', view);
  }

  private scheduleCleanup(pin: string, delayMs: number, reason?: 'host-left') {
    const entry = this.games.get(pin);
    if (!entry) return;
    this.cancelCleanup(entry);
    entry.cleanupTimer = setTimeout(() => {
      if (reason === 'host-left') {
        for (const socketId of entry.playerSockets.values()) {
          this.io.to(socketId).emit('game:closed', {
            reason,
            message: 'Sunucu oyundan ayrıldığı için oyun kapandı',
          });
        }
      }
      this.removeGame(pin);
    }, delayMs);
  }

  private cancelCleanup(entry: GameEntry) {
    if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer);
    entry.cleanupTimer = null;
  }

  private removeGame(pin: string) {
    const entry = this.games.get(pin);
    if (!entry) return;
    this.cancelCleanup(entry);
    entry.game.dispose();
    this.games.delete(pin);
  }

  private async saveResults(game: Game) {
    const results = game.finalResults();
    // Hiç başlamamış ya da kimsenin oynamadığı oyunlar geçmişe yazılmaz.
    if (!game.startedAt || results.length === 0) return;
    try {
      // Quiz oyun sırasında silinmiş olabilir; o durumda geçmiş yine kaydedilir ama bağlantısız.
      const quizStillExists = await prisma.quiz.findUnique({
        where: { id: game.quiz.id },
        select: { id: true },
      });
      await prisma.gameSession.create({
        data: {
          pin: game.pin,
          status: 'FINISHED',
          quizId: quizStillExists?.id ?? null,
          quizTitle: game.quiz.title,
          questionCount: game.quiz.questions.length,
          questionStats: game.questionStats() as unknown as Prisma.InputJsonValue,
          hostId: game.hostUserId,
          startedAt: game.startedAt,
          endedAt: game.endedAt,
          results: { create: results },
        },
      });
    } catch (error) {
      console.error('[game] sonuçlar kaydedilemedi:', error);
    }
  }
}
