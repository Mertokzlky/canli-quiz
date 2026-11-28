import { describe, expect, it, vi } from 'vitest';
import { api, ApiRequestError, SESSION_EXPIRED_EVENT, tokenStore } from './api';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api istemcisi', () => {
  it('token gönderilen istek 401 dönerse oturumu kapatır ve haber verir', async () => {
    tokenStore.set('eski-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, { error: 'Bu işlem için giriş yapmalısınız' }),
    );
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);

    await expect(api.myQuizzes()).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.get()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it('girişteki 401 (yanlış şifre) oturum bitti sayılmaz', async () => {
    tokenStore.set('mevcut-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, { error: 'E-posta veya şifre hatalı' }),
    );
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);

    await expect(api.login({ email: 'a@example.com', password: 'yanlis' })).rejects.toThrow(
      'E-posta veya şifre hatalı',
    );
    expect(expired).not.toHaveBeenCalled();
    expect(tokenStore.get()).toBe('mevcut-token');
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it('token varsa Authorization başlığıyla gönderir, alan hatalarını taşır', async () => {
    tokenStore.set('gecerli-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(400, {
        error: 'Gönderilen bilgiler geçersiz',
        fields: { title: 'Başlık gerekli' },
      }),
    );

    const error = await api.createQuiz({ title: '', questions: [] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).fields).toEqual({ title: 'Başlık gerekli' });
    const init = fetchMock.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gecerli-token');
  });

  it('sunucuya ulaşılamazsa anlaşılır bir mesaj verir', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.publicQuizzes()).rejects.toThrow('Sunucuya ulaşılamadı');
  });
});
