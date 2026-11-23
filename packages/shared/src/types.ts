/**
 * Oyun akışı bir durum makinesidir:
 * LOBBY → QUESTION → REVEAL → LEADERBOARD → QUESTION → ... → REVEAL (son soru) → ENDED
 */
export type GamePhase = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'ENDED';

export interface PlayerSummary {
  id: string;
  nickname: string;
  connected: boolean;
}

/** Oyunculara gönderilen soru. Doğru cevap bilgisi bilerek yoktur. */
export interface PublicQuestion {
  index: number;
  total: number;
  text: string;
  imageUrl: string | null;
  choices: { id: string; text: string }[];
  timeLimitSec: number;
  /** Sorunun bittiği an, sunucu saatiyle (epoch ms). Zamanı sunucu belirler. */
  endsAt: number;
}

export interface RevealInfo {
  correctChoiceId: string;
  /** Her şıkkı kaç oyuncunun seçtiği. */
  distribution: Record<string, number>;
}

export interface PlayerAnswerResult {
  answered: boolean;
  correct: boolean;
  pointsEarned: number;
  totalScore: number;
  streak: number;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  /** Eşit puanlı oyuncular aynı sırayı paylaşır (1, 2, 2, 4). */
  rank: number;
}

/**
 * Sunucu ekranının gördüğü her şey. Her değişiklikte tamamı yeniden gönderilir;
 * böylece bağlantısı kopup dönen ekran tek mesajla kaldığı yere gelir.
 */
export interface HostView {
  pin: string;
  quizTitle: string;
  phase: GamePhase;
  /** Mesajın gönderildiği an, sunucu saatiyle. İstemci saat farkını bununla hesaplar. */
  serverNow: number;
  players: PlayerSummary[];
  question: PublicQuestion | null;
  answeredCount: number;
  reveal: RevealInfo | null;
  /** LEADERBOARD ve ENDED aşamalarında ilk 10 oyuncu. */
  leaderboard: LeaderboardEntry[];
}

/** Bir oyuncunun kendi ekranında gördüğü her şey. */
export interface PlayerView {
  pin: string;
  quizTitle: string;
  phase: GamePhase;
  serverNow: number;
  me: { id: string; nickname: string; score: number; rank: number | null };
  playerCount: number;
  question: PublicQuestion | null;
  /** Bu soruda verdiği cevap (vermediyse null). */
  myChoiceId: string | null;
  /** REVEAL aşamasında bu sorunun sonucu. */
  result: PlayerAnswerResult | null;
  correctChoiceId: string | null;
  /** LEADERBOARD ve ENDED aşamalarında ilk 5 oyuncu. */
  leaderboard: LeaderboardEntry[];
}

export type GameClosedReason = 'host-left' | 'kicked';

/** Oyun geçmişinde saklanan, tek bir sorunun sonucu. */
export interface QuestionStat {
  text: string;
  correctChoice: string;
  /** Soru açıldığında oyundaki oyuncu sayısı. */
  playerCount: number;
  answered: number;
  correct: number;
  /** Doğru cevap verenlerin ortalama cevap süresi (ms). Doğru cevap yoksa null. */
  avgCorrectMs: number | null;
}

/** Socket.io acknowledgement callback'lerinin ortak cevap tipi. */
export type AckResponse<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T = undefined> = (response: AckResponse<T>) => void;
