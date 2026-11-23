import type { BankDifficulty } from '@canli-quiz/shared';

export interface BankQuestion {
  difficulty: BankDifficulty;
  text: string;
  /** Doğru cevap. Quiz oluşturulurken şıklar karıştırılır, sırası önemli değil. */
  correct: string;
  wrong: string[];
}

export interface BankCategoryData {
  slug: string;
  name: string;
  emoji: string;
  questions: BankQuestion[];
}

/** Soru yazmayı kısaltan yardımcı: q('kolay', 'Soru?', 'Doğru', 'Yanlış 1', 'Yanlış 2', ...) */
export const q = (
  difficulty: BankDifficulty,
  text: string,
  correct: string,
  ...wrong: string[]
): BankQuestion => ({ difficulty, text, correct, wrong });
