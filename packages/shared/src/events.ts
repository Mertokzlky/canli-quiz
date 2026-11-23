import type { Ack, GameClosedReason, HostView, PlayerView } from './types';

/** İstemciden (sunucu ekranı veya oyuncu) backend'e giden olaylar. */
export interface ClientToServerEvents {
  /** Giriş yapmış kullanıcı bir quiz için oyun açar. Kendi quizi veya herkese açık bir quiz olabilir. */
  'host:create': (payload: { quizId: string }, ack: Ack<{ pin: string }>) => void;
  /** Sayfayı yenileyen veya bağlantısı kopan sunucu ekranı oyununa geri döner. */
  'host:rejoin': (payload: { pin: string }, ack: Ack) => void;
  'host:start': (payload: { pin: string }, ack: Ack) => void;
  /** Bir sonraki aşamaya geçer. Soru sırasında çağrılırsa süreyi beklemeden cevabı gösterir. */
  'host:next': (payload: { pin: string }, ack: Ack) => void;
  /** Oyunu erkenden bitirir. */
  'host:end': (payload: { pin: string }, ack: Ack) => void;

  'player:join': (
    payload: { pin: string; nickname: string },
    ack: Ack<{ playerId: string; reconnectToken: string }>,
  ) => void;
  /** Bağlantısı kopan oyuncu, katılırken aldığı token ile kaldığı yere döner. */
  'player:rejoin': (payload: { pin: string; reconnectToken: string }, ack: Ack) => void;
  'player:answer': (payload: { pin: string; choiceId: string }, ack: Ack) => void;
}

/** Backend'den istemcilere giden olaylar. */
export interface ServerToClientEvents {
  'host:view': (view: HostView) => void;
  'player:view': (view: PlayerView) => void;
  'game:closed': (payload: { reason: GameClosedReason; message: string }) => void;
}
