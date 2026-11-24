import { describe, expect, it } from 'vitest';
import { questionInputSchema } from './schemas';

const question = (imageUrl: unknown) => ({
  text: 'Soru',
  imageUrl,
  timeLimitSec: 20,
  choices: [
    { text: 'A', isCorrect: true },
    { text: 'B', isCorrect: false },
  ],
});

describe('soru görseli', () => {
  it('http ve https adreslerini kabul eder, boş bırakılabilir', () => {
    expect(questionInputSchema.safeParse(question('https://ornek.com/resim.png')).success).toBe(true);
    expect(questionInputSchema.safeParse(question('http://ornek.com/resim.jpg')).success).toBe(true);
    expect(questionInputSchema.safeParse(question(null)).success).toBe(true);
    expect(questionInputSchema.safeParse(question(undefined)).success).toBe(true);
  });

  it('tehlikeli veya geçersiz adresleri reddeder', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'ftp://ornek.com/a.png',
      'resim.png',
      `https://ornek.com/${'a'.repeat(600)}.png`,
    ]) {
      expect(questionInputSchema.safeParse(question(bad)).success, bad).toBe(false);
    }
  });
});
