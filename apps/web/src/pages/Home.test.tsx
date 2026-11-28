import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../lib/auth';
import { HomePage } from './Home';

function GamePlaceholder() {
  const { pin } = useParams();
  return <p>Oyun sayfası: {pin}</p>;
}

function renderHome() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/oyun/:pin" element={<GamePlaceholder />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('ana sayfa', () => {
  it('eksik PIN girilince uyarır ve yönlendirmez', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.type(screen.getByLabelText('Oyuna katıl'), '123');
    await user.click(screen.getByRole('button', { name: /Oyuna katıl/ }));
    expect(screen.getByRole('alert').textContent).toBe('PIN 6 haneli bir sayı olmalı');
    expect(screen.queryByText(/Oyun sayfası/)).toBeNull();
  });

  it('PIN kutusuna sadece rakam yazılır, doğru PIN ile oyuna gider', async () => {
    const user = userEvent.setup();
    renderHome();
    const input = screen.getByLabelText('Oyuna katıl');
    await user.type(input, '12a34-56');
    expect((input as HTMLInputElement).value).toBe('123456');
    await user.click(screen.getByRole('button', { name: /Oyuna katıl/ }));
    expect(screen.getByText('Oyun sayfası: 123456')).toBeTruthy();
  });

  it('giriş yapmamış kişiye giriş ve kayıt bağlantılarını gösterir', () => {
    renderHome();
    expect(screen.getByRole('link', { name: 'Giriş yap' }).getAttribute('href')).toBe('/giris');
    expect(screen.getByRole('link', { name: 'Kayıt ol' }).getAttribute('href')).toBe('/kayit');
  });
});
