import { describe, expect, it } from 'vitest';
import { clientIp } from './net';
import { RateLimiter } from './rateLimit';

describe('clientIp', () => {
  it('güvenilir ara sunucu yoksa X-Forwarded-For başlığını yok sayar (sahte IP ile sınır aşılamaz)', () => {
    expect(clientIp('10.0.0.1', '1.2.3.4', 0)).toBe('10.0.0.1');
  });

  it('bir güvenilir ara sunucu varsa başlıktaki son adresi alır', () => {
    // İstemci kendi başlığına sahte bir adres eklese bile ara sunucunun eklediği adres kullanılır.
    expect(clientIp('10.0.0.1', 'sahte-adres, 85.100.1.2', 1)).toBe('85.100.1.2');
    expect(clientIp('10.0.0.1', ['85.100.1.2'], 1)).toBe('85.100.1.2');
  });

  it('başlık yoksa veya kısa ise bağlanan adrese döner', () => {
    expect(clientIp('10.0.0.1', undefined, 1)).toBe('10.0.0.1');
    expect(clientIp('10.0.0.1', '85.100.1.2', 3)).toBe('85.100.1.2');
    expect(clientIp(undefined, undefined, 0)).toBe('bilinmiyor');
  });
});

describe('RateLimiter', () => {
  it('pencere içinde sınırı aşan istekleri reddeder, pencere dolunca sıfırlar', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.isLimited('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);

    now = 1000;
    expect(limiter.isLimited('a')).toBe(false);
    expect(limiter.take('a')).toBe(true);
  });

  it('unutulan anahtarın sayacını siler', () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.take('a');
    limiter.forget('a');
    expect(limiter.take('a')).toBe(true);
  });

  it('süresi dolmuş kayıtları zamanla temizler', () => {
    let now = 0;
    const limiter = new RateLimiter(1, 10, () => now);
    const size = () => (limiter as unknown as { hits: Map<string, unknown> }).hits.size;
    for (let i = 0; i < 999; i++) limiter.take(`k${i}`);
    expect(size()).toBe(999);
    now = 100;
    limiter.take('son'); // 1000. çağrı temizliği tetikler
    expect(size()).toBe(1);
  });
});
