/**
 * Oyun akışı bir durum makinesidir:
 * LOBBY → QUESTION → REVEAL → LEADERBOARD → QUESTION → ... → ENDED
 */
export type GamePhase = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'ENDED';

export interface PlayerSummary {
  id: string;
  nickname: string;
}

/** Oyunculara gönderilen soru. Doğru cevap bilgisi bilerek yoktur. */
export interface PublicQuestion {
  index: number;
  total: number;
  text: string;
  imageUrl: string | null;
  choices: { id: string; text: string }[];
  timeLimitSec: number;
  /** Sunucu saatine göre sorunun bittiği an (epoch ms). Zamanı sunucu belirler. */
  endsAt: number;
}

export interface RevealPayload {
  correctChoiceId: string;
  /** Her şıkkı kaç oyuncunun seçtiği. */
  distribution: Record<string, number>;
}

export interface PlayerAnswerResult {
  correct: boolean;
  pointsEarned: number;
  totalScore: number;
  streak: number;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
}

/** Socket.io acknowledgement callback'lerinin ortak cevap tipi. */
export type Ack<T = undefined> = (
  response: { ok: true; data: T } | { ok: false; error: string },
) => void;
