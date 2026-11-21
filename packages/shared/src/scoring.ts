import { MAX_BASE_POINTS, STREAK_BONUS_MAX, STREAK_BONUS_STEP } from './constants';

export interface ScoreInput {
  correct: boolean;
  /** Cevabın soru başladıktan kaç ms sonra geldiği (sunucu saatiyle). */
  elapsedMs: number;
  timeLimitMs: number;
  /** Bu cevaptan önceki üst üste doğru sayısı. */
  previousStreak: number;
}

export interface ScoreOutput {
  points: number;
  streak: number;
}

/**
 * Puan = 1000 × (kalan süre / toplam süre) + seri bonusu.
 * Yanlış veya süre dolduktan sonra gelen cevap 0 puan alır ve seriyi sıfırlar.
 */
export function calculateScore(input: ScoreInput): ScoreOutput {
  const { correct, elapsedMs, timeLimitMs, previousStreak } = input;

  if (!correct || timeLimitMs <= 0 || elapsedMs < 0 || elapsedMs > timeLimitMs) {
    return { points: 0, streak: 0 };
  }

  const remainingRatio = (timeLimitMs - elapsedMs) / timeLimitMs;
  const basePoints = Math.round(MAX_BASE_POINTS * remainingRatio);
  const streakBonus = Math.min(previousStreak * STREAK_BONUS_STEP, STREAK_BONUS_MAX);

  return { points: basePoints + streakBonus, streak: previousStreak + 1 };
}
