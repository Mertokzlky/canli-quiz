import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SESSION_EXPIRED_EVENT } from '../lib/api';
import { AuthProvider } from '../lib/auth';
import { AuthPage } from './Auth';

function renderAuth(path: '/giris' | '/kayit') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/giris" element={<AuthPage mode="login" />} />
          <Route path="/kayit" element={<AuthPage mode="register" />} />
          <Route path="/panel" element={<p>Panel</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('kayıt ve giriş', () => {
  it('kayıt formundaki hataları sunucuya gitmeden alanların altında gösterir', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderAuth('/kayit');

    await user.type(screen.getByLabelText('Adınız'), 'Orospu');
    await user.type(screen.getByLabelText('E-posta'), 'gecersiz-eposta');
    await user.type(screen.getByLabelText('Şifre'), 'kisa');
    await user.click(screen.getByRole('button', { name: 'Kayıt ol' }));

    expect(screen.getByText('Bu isim uygun değil, lütfen başka bir tane seçin')).toBeTruthy();
    expect(screen.getByText('Geçerli bir e-posta girin')).toBeTruthy();
    expect(screen.getByText('Şifre en az 8 karakter olmalı')).toBeTruthy();
    expect(screen.getByLabelText('Adınız').getAttribute('aria-invalid')).toBe('true');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('başarılı girişte token saklanır ve panele gidilir', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          token: 'yeni-token',
          user: { id: 'u1', email: 'ayse@example.com', displayName: 'Ayşe' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const user = userEvent.setup();
    renderAuth('/giris');

    await user.type(screen.getByLabelText('E-posta'), 'ayse@example.com');
    await user.type(screen.getByLabelText('Şifre'), 'gizli-sifre-123');
    await user.click(screen.getByRole('button', { name: 'Giriş yap' }));

    expect(await screen.findByText('Panel')).toBeTruthy();
    expect(localStorage.getItem('canli-quiz:token')).toBe('yeni-token');
  });

  it('oturum kullanım sırasında biterse giriş sayfasında bilgi verir', () => {
    renderAuth('/giris');
    expect(screen.queryByText(/Oturumunun süresi doldu/)).toBeNull();
    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });
    expect(screen.getByText(/Oturumunun süresi doldu/)).toBeTruthy();
  });
});
