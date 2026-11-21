import type {
  Ack,
  GamePhase,
  LeaderboardEntry,
  PlayerAnswerResult,
  PlayerSummary,
  PublicQuestion,
  RevealPayload,
} from './types';

/** İstemciden (sunucu ekranı veya oyuncu) backend'e giden olaylar. */
export interface ClientToServerEvents {
  /** Sunucu ekranı bir quiz için yeni oyun açar, cevap olarak PIN döner. */
  'host:create': (payload: { quizId: string }, ack: Ack<{ pin: string }>) => void;
  /** Sunucu ekranı oyunu başlatır veya bir sonraki aşamaya geçirir. */
  'host:start': (payload: { pin: string }, ack: Ack) => void;
  'host:next': (payload: { pin: string }, ack: Ack) => void;

  /** Oyuncu PIN ve takma adla katılır. */
  'player:join': (
    payload: { pin: string; nickname: string },
    ack: Ack<{ playerId: string; reconnectToken: string }>,
  ) => void;
  /** Bağlantısı kopan oyuncu, katılırken aldığı token ile geri döner. */
  'player:rejoin': (payload: { pin: string; reconnectToken: string }, ack: Ack) => void;
  'player:answer': (payload: { pin: string; choiceId: string }, ack: Ack) => void;
}

/** Backend'den istemcilere giden olaylar. */
export interface ServerToClientEvents {
  'lobby:update': (payload: { players: PlayerSummary[] }) => void;
  'game:phase': (payload: { phase: GamePhase }) => void;
  'game:question': (payload: PublicQuestion) => void;
  'game:reveal': (payload: RevealPayload) => void;
  /** Sadece ilgili oyuncuya gönderilir. */
  'player:result': (payload: PlayerAnswerResult) => void;
  'game:leaderboard': (payload: { entries: LeaderboardEntry[] }) => void;
  'game:end': (payload: { entries: LeaderboardEntry[] }) => void;
  'game:error': (payload: { message: string }) => void;
}
