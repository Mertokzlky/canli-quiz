import { randomInt } from 'node:crypto';
import type { BankCategory, QuizInputParsed } from '@canli-quiz/shared';
import { anime } from './categories/anime';
import { cografya } from './categories/cografya';
import { cs2 } from './categories/cs2';
import { dizi } from './categories/dizi';
import { futbol } from './categories/futbol';
import { genelKultur } from './categories/genel-kultur';
import { hayvanlar } from './categories/hayvanlar';
import { lol } from './categories/lol';
import { mitoloji } from './categories/mitoloji';
import { oyunlar } from './categories/oyunlar';
import { sinema } from './categories/sinema';
import { tarih } from './categories/tarih';
import { turkceMuzik } from './categories/turkce-muzik';
import { yemek } from './categories/yemek';
import type { BankCategoryData, BankQuestion } from './types';

/** Yeni kategori eklemek için: categories/ altına dosya yazıp buraya eklemek yeterli. */
export const BANK: BankCategoryData[] = [
  genelKultur,
  futbol,
  sinema,
  dizi,
  oyunlar,
  cs2,
  lol,
  tarih,
  turkceMuzik,
  anime,
  yemek,
  cografya,
  mitoloji,
  hayvanlar,
];

const DIFFICULTY_LABELS = { karisik: 'Karışık', kolay: 'Kolay', orta: 'Orta', zor: 'Zor' };

/** Zor sorulara biraz daha fazla düşünme süresi verilir. */
const TIME_LIMITS: Record<BankQuestion['difficulty'], number> = { kolay: 20, orta: 20, zor: 30 };

export function listCategories(): BankCategory[] {
  return BANK.map((c) => {
    const count = (d: BankQuestion['difficulty']) =>
      c.questions.filter((x) => x.difficulty === d).length;
    return {
      slug: c.slug,
      name: c.name,
      emoji: c.emoji,
      counts: {
        kolay: count('kolay'),
        orta: count('orta'),
        zor: count('zor'),
        total: c.questions.length,
      },
    };
  });
}

/** Fisher-Yates karıştırma; tahmin edilemez sıra için kriptografik rastgelelik kullanır. */
function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export interface QuickQuizOptions {
  categories: string[];
  questionCount: number;
  difficulty: 'karisik' | BankQuestion['difficulty'];
}

export class BankError extends Error {}

/**
 * Seçilen kategorilerden sırayla birer soru alarak (dengeli dağılım) rastgele bir quiz üretir.
 * Bankada yeterli soru yoksa olanların hepsini kullanır.
 */
export function buildQuickQuiz(options: QuickQuizOptions): QuizInputParsed {
  const selected = [...new Set(options.categories)].map((slug) => {
    const category = BANK.find((c) => c.slug === slug);
    if (!category) throw new BankError(`Bilinmeyen kategori: ${slug}`);
    return category;
  });

  const pools = selected.map((c) =>
    shuffle(
      c.questions.filter(
        (x) => options.difficulty === 'karisik' || x.difficulty === options.difficulty,
      ),
    ),
  );

  const picked: BankQuestion[] = [];
  while (picked.length < options.questionCount && pools.some((p) => p.length > 0)) {
    for (const pool of pools) {
      const next = pool.pop();
      if (next) picked.push(next);
      if (picked.length === options.questionCount) break;
    }
  }
  if (picked.length === 0) throw new BankError('Seçimlere uygun soru bulunamadı');

  const names = selected.map((c) => c.name).join(', ');
  const title = `Hızlı Quiz: ${names}`;

  return {
    title: title.length > 100 ? `${title.slice(0, 99)}…` : title,
    description: `${picked.length} soru · ${DIFFICULTY_LABELS[options.difficulty]} zorluk`,
    isPublic: false,
    questions: shuffle(picked).map((x) => ({
      text: x.text,
      imageUrl: null,
      timeLimitSec: TIME_LIMITS[x.difficulty],
      choices: shuffle([
        { text: x.correct, isCorrect: true },
        ...x.wrong.map((text) => ({ text, isCorrect: false })),
      ]),
    })),
  };
}
