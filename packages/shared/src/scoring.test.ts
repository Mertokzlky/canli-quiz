import { describe, expect, it } from 'vitest';
import { calculateScore } from './scoring';

const base = { timeLimitMs: 20_000, previousStreak: 0 };

describe('calculateScore', () => {
  it('anında verilen doğru cevaba tam puan verir', () => {
    expect(calculateScore({ ...base, correct: true, elapsedMs: 0 })).toEqual({
      points: 1000,
      streak: 1,
    });
  });

  it('süreye göre puanı orantılı azaltır', () => {
    expect(calculateScore({ ...base, correct: true, elapsedMs: 10_000 }).points).toBe(500);
  });

  it('yanlış cevaba 0 puan verir ve seriyi sıfırlar', () => {
    expect(calculateScore({ ...base, correct: false, elapsedMs: 0, previousStreak: 3 })).toEqual({
      points: 0,
      streak: 0,
    });
  });

  it('süre dolduktan sonra gelen cevabı reddeder', () => {
    expect(calculateScore({ ...base, correct: true, elapsedMs: 20_001 }).points).toBe(0);
  });

  it('seri bonusunu ekler ve üst sınırda keser', () => {
    expect(calculateScore({ ...base, correct: true, elapsedMs: 0, previousStreak: 2 }).points).toBe(
      1200,
    );
    expect(
      calculateScore({ ...base, correct: true, elapsedMs: 0, previousStreak: 50 }).points,
    ).toBe(1500);
  });
});
