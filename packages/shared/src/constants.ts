/** Oyun PIN'inin hane sayısı. */
export const PIN_LENGTH = 6;

/** Bir sorunun alabileceği süreler (saniye). */
export const QUESTION_TIME_LIMITS = [10, 20, 30] as const;

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 4;

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;

/** Hızlı quizler geçicidir: kullanıcı başına en son bu kadarı saklanır. */
export const QUICK_QUIZ_KEEP = 10;

/** Bir oyuna katılabilecek en fazla oyuncu sayısı. */
export const MAX_PLAYERS_PER_GAME = 500;

/** Doğru cevabın alabileceği en yüksek taban puan. */
export const MAX_BASE_POINTS = 1000;

/** Üst üste her doğru cevap için eklenen bonus ve bonusun üst sınırı. */
export const STREAK_BONUS_STEP = 100;
export const STREAK_BONUS_MAX = 500;
