import { describe, expect, it } from 'vitest';
import { containsProfanity } from './profanity';
import { registerSchema } from './schemas';

describe('küfür filtresi', () => {
  it('açık küfürleri yakalar', () => {
    for (const name of ['orospu', 'Siktir', 'pezevenk', 'kahpe', 'ibne', 'yarrak', 'fuck you']) {
      expect(containsProfanity(name), name).toBe(true);
    }
  });

  it('atlatma denemelerini yakalar: rakam, sembol, boşluk, tekrar ve Türkçe harf', () => {
    for (const name of [
      '0r0spu',
      's1kt1r',
      'o.r.o.s.p.u',
      'o r o s p u',
      'orrrospuuu',
      'ŞEREFSİZ',
      'şerefsiz123',
      'p!ç',
      'Ali amk',
      'yarrrrak',
      'xXsiktirXx',
    ]) {
      expect(containsProfanity(name), name).toBe(true);
    }
  });

  it('kısa kelimeleri sadece tek başına kelimeyken yakalar', () => {
    expect(containsProfanity('piç')).toBe(true);
    expect(containsProfanity('Mehmet piç')).toBe(true);
    expect(containsProfanity('Picasso')).toBe(false);
  });

  it('masum isimleri ve kelimeleri engellemez', () => {
    for (const name of [
      'Işık',
      'Sık Sık',
      'Sıkı',
      'Sıkıntı',
      'Sıkışık',
      'Sikke',
      'Kamil',
      'Tamer',
      'Amasya',
      'Amina',
      'Emine',
      'Nigâr',
      'Fagot',
      'Malatya',
      'Kayarak',
      'Sayarak Gel',
      'Koyarak',
      'Bayraktar',
      'Gotham',
      'Hiroshita',
      'Scunthorpe',
      'Picasso',
      'İbrahim',
      'Ocak',
      'Göktuğ',
      'Mükemmel',
      'Ahmet Can',
      'Şükrü',
      'Pusula',
    ]) {
      expect(containsProfanity(name), name).toBe(false);
    }
  });

  it('kayıtta görünen adda küfürü reddeder', () => {
    const base = { email: 'a@example.com', password: 'gizli-sifre-123' };
    const result = registerSchema.safeParse({ ...base, displayName: 'Orospu Çocuğu' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Bu isim uygun değil, lütfen başka bir tane seçin',
    );
    expect(registerSchema.safeParse({ ...base, displayName: 'Işık Yılmaz' }).success).toBe(true);
  });
});
