import { describe, expect, it } from 'vitest';
import { questionInputSchema, registerSchema } from './schemas';
import { cleanName } from './text';

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
    expect(questionInputSchema.safeParse(question('https://ornek.com/resim.png')).success).toBe(
      true,
    );
    expect(questionInputSchema.safeParse(question('http://ornek.com/resim.jpg')).success).toBe(
      true,
    );
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

describe('kayıt', () => {
  const base = { email: 'a@example.com', displayName: 'Deniz' };

  it("şifre sınırını bcrypt'in 72 baytına göre uygular (Türkçe harfler 2 bayt)", () => {
    expect(registerSchema.safeParse({ ...base, password: 'a'.repeat(72) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: 'a'.repeat(73) }).success).toBe(false);
    // 40 "ş" = 80 bayt: 72 karakterden kısa ama bcrypt sonunu yok sayardı.
    const turkish = registerSchema.safeParse({ ...base, password: 'ş'.repeat(40) });
    expect(turkish.success).toBe(false);
    expect(turkish.error?.issues[0]?.message).toContain('Şifre çok uzun');
  });

  it('görünen adı temizler, sadece görünmez karakterden oluşan adı reddeder', () => {
    const ok = registerSchema.parse({
      ...base,
      password: 'gizli-sifre',
      displayName: ' Ali​ Can ',
    });
    expect(ok.displayName).toBe('Ali Can');
    expect(
      registerSchema.safeParse({ ...base, password: 'gizli-sifre', displayName: 'ㅤ​ㅤ' }).success,
    ).toBe(false);
  });
});

describe('cleanName', () => {
  it('yön değiştiren ve sıfır genişlikli karakterleri siler, boşlukları sadeleştirir', () => {
    expect(cleanName('‮Ayşe‍   Yılmaz ')).toBe('Ayşe Yılmaz');
    expect(cleanName('Işık')).toBe('Işık');
  });
});
