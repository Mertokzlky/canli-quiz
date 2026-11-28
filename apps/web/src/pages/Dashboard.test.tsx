import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizSummary } from '@canli-quiz/shared';
import { api, tokenStore } from '../lib/api';
import { AuthProvider } from '../lib/auth';
import { DashboardPage } from './Dashboard';

const quiz = (id: string, title: string, extra: Partial<QuizSummary> = {}): QuizSummary => ({
  id,
  title,
  description: null,
  isPublic: false,
  questionCount: 5,
  ownerName: 'Deniz',
  isOwner: true,
  isQuick: false,
  updatedAt: '2026-11-27T10:00:00.000Z',
  ...extra,
});

beforeEach(() => {
  tokenStore.set('test-token');
  vi.spyOn(api, 'me').mockResolvedValue({
    id: 'u1',
    email: 'd@example.com',
    displayName: 'Deniz Yılmaz',
  });
  vi.spyOn(api, 'myQuizzes').mockResolvedValue([
    quiz('1', 'Tarih Sınavı'),
    quiz('2', 'Coğrafya Tekrarı'),
    quiz('3', 'Matematik'),
    quiz('4', 'Genel Kültür Turnuvası', { isPublic: true }),
    quiz('5', 'Hızlı Quiz: Futbol', { isQuick: true }),
    quiz('6', 'Hızlı Quiz: Sinema', { isQuick: true }),
  ]);
  vi.spyOn(api, 'publicQuizzes').mockResolvedValue([
    quiz('9', 'Yazılım Temelleri', { isOwner: false, isPublic: true, ownerName: 'Canlı Quiz' }),
  ]);
  vi.spyOn(api, 'games').mockResolvedValue([]);
  // Geçmiş listesi en fazla 50 oyun döner; toplamlar ayrı uç noktadan gelir.
  vi.spyOn(api, 'gameStats').mockResolvedValue({ gameCount: 120, playerCount: 2450 });
});

function renderDashboard() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('panel', () => {
  it('kullanıcıyı adıyla karşılar ve tüm oyunların toplamını gösterir', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: 'Hoş geldin, Deniz!' })).toBeTruthy();
    const stats = screen.getByText('Oyun').closest('div')!;
    expect(within(stats).getByText('120')).toBeTruthy();
    expect(screen.getByText('2.450')).toBeTruthy();
  });

  it('hızlı quizleri "Geçici" rozetiyle ayrı bölümde gösterir', async () => {
    renderDashboard();
    const quickHeading = await screen.findByRole('heading', { name: /Son hızlı quizler/ });
    const quickSection = quickHeading.closest('div[aria-labelledby]')! as HTMLElement;
    expect(within(quickSection).getAllByText('Geçici')).toHaveLength(2);
    expect(within(quickSection).getByText('Hızlı Quiz: Futbol')).toBeTruthy();

    // Kalıcı quiz sayısına hızlı quizler dahil değil.
    const mineHeading = screen.getByRole('heading', { name: /^Quizlerim/ });
    expect(within(mineHeading).getByText('4')).toBeTruthy();
    expect(screen.getByText('Yazılım Temelleri')).toBeTruthy();
  });

  it('arama sadece kalıcı quizlerde ve Türkçe harf duyarsız çalışır', async () => {
    const user = userEvent.setup();
    renderDashboard();
    const search = await screen.findByPlaceholderText('Quizlerde ara...');
    await user.type(search, 'COĞRAFYA');
    expect(screen.getByText('Coğrafya Tekrarı')).toBeTruthy();
    expect(screen.queryByText('Tarih Sınavı')).toBeNull();
    // Hızlı quizler aramadan etkilenmez.
    expect(screen.getByText('Hızlı Quiz: Futbol')).toBeTruthy();

    await user.clear(search);
    await user.type(search, 'olmayan');
    expect(screen.getByText('Sonuç bulunamadı')).toBeTruthy();
  });
});
