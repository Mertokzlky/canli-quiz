import { describe, expect, it } from 'vitest';
import { quizInputSchema } from '@canli-quiz/shared';
import { BANK, BankError, buildQuickQuiz, listCategories } from './index';

// Bu testler soru bankasının kendisini denetler: yeni soru eklerken yapılan
// hataları (boş şık, aynı şıkkın iki kez yazılması, çok uzun metin) CI yakalar.

describe('soru bankası bütünlüğü', () => {
  it('kategori adları ve kısaltmaları benzersizdir', () => {
    const slugs = BANK.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('her kategoride her zorlukta soru vardır', () => {
    for (const c of listCategories()) {
      expect(c.counts.total, c.name).toBeGreaterThanOrEqual(20);
      expect(c.counts.kolay, `${c.name} kolay`).toBeGreaterThan(0);
      expect(c.counts.orta, `${c.name} orta`).toBeGreaterThan(0);
      expect(c.counts.zor, `${c.name} zor`).toBeGreaterThan(0);
    }
  });

  it('bir soru metni bankada iki kez geçmez', () => {
    const texts = BANK.flatMap((c) => c.questions.map((x) => x.text.toLocaleLowerCase('tr')));
    const duplicates = texts.filter((t, i) => texts.indexOf(t) !== i);
    expect(duplicates).toEqual([]);
  });

  it('her soru editördeki kurallara uyar ve şıkları birbirinden farklıdır', () => {
    for (const category of BANK) {
      for (const question of category.questions) {
        const choices = [question.correct, ...question.wrong];
        const label = `${category.name}: ${question.text}`;
        expect(new Set(choices.map((c) => c.toLocaleLowerCase('tr'))).size, label).toBe(
          choices.length,
        );

        const parsed = quizInputSchema.safeParse({
          title: 'x',
          questions: [
            {
              text: question.text,
              timeLimitSec: 20,
              choices: choices.map((text, i) => ({ text, isCorrect: i === 0 })),
            },
          ],
        });
        expect(parsed.success, `${label} → ${parsed.error?.issues[0]?.message}`).toBe(true);
      }
    }
  });
});

describe('hızlı quiz oluşturma', () => {
  it('istenen sayıda soru üretir ve her soruda tek doğru cevap olur', () => {
    const quiz = buildQuickQuiz({
      categories: ['futbol'],
      questionCount: 10,
      difficulty: 'karisik',
    });
    expect(quiz.questions).toHaveLength(10);
    for (const question of quiz.questions) {
      expect(question.choices.filter((c) => c.isCorrect)).toHaveLength(1);
    }
    expect(quizInputSchema.safeParse(quiz).success).toBe(true);
  });

  it('birden fazla kategoriden dengeli seçer', () => {
    const quiz = buildQuickQuiz({
      categories: ['cs2', 'lol'],
      questionCount: 10,
      difficulty: 'karisik',
    });
    const cs2Texts = new Set(BANK.find((c) => c.slug === 'cs2')!.questions.map((x) => x.text));
    const fromCs2 = quiz.questions.filter((x) => cs2Texts.has(x.text)).length;
    expect(fromCs2).toBe(5);
  });

  it('zorluk filtresine uyar ve zor sorulara daha uzun süre verir', () => {
    const quiz = buildQuickQuiz({ categories: ['tarih'], questionCount: 20, difficulty: 'zor' });
    const zorCount = BANK.find((c) => c.slug === 'tarih')!.questions.filter(
      (x) => x.difficulty === 'zor',
    ).length;
    expect(quiz.questions).toHaveLength(zorCount);
    expect(quiz.questions.every((x) => x.timeLimitSec === 30)).toBe(true);
  });

  it('aynı soruyu bir quizde iki kez kullanmaz ve şıkların yerini karıştırır', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const quiz = buildQuickQuiz({
        categories: ['genel-kultur'],
        questionCount: 10,
        difficulty: 'karisik',
      });
      const texts = quiz.questions.map((x) => x.text);
      expect(new Set(texts).size).toBe(texts.length);
      for (const x of quiz.questions) positions.add(x.choices.findIndex((c) => c.isCorrect));
    }
    // Doğru cevap her zaman aynı sırada olsaydı oyuncular ezberlerdi.
    expect(positions.size).toBeGreaterThan(1);
  });

  it('bilinmeyen kategoriyi reddeder', () => {
    expect(() =>
      buildQuickQuiz({
        categories: ['yok-boyle-bir-sey'],
        questionCount: 5,
        difficulty: 'karisik',
      }),
    ).toThrow(BankError);
  });

  it('başlık sınırı aşılmaz', () => {
    const quiz = buildQuickQuiz({
      categories: BANK.map((c) => c.slug),
      questionCount: 5,
      difficulty: 'karisik',
    });
    expect(quiz.title.length).toBeLessThanOrEqual(100);
  });
});
