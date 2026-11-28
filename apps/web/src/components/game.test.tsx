import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CountdownBadge, Leaderboard } from './game';

const entries = [
  { playerId: 'a', nickname: 'Ayşe', score: 2400, rank: 1 },
  { playerId: 'b', nickname: 'Mehmet', score: 1800, rank: 2 },
  { playerId: 'c', nickname: 'Can', score: 1800, rank: 2 },
  { playerId: 'd', nickname: 'Zeynep', score: 900, rank: 4 },
];

describe('Leaderboard', () => {
  it('ilk üç sıraya madalya, sonrakilere sıra numarası gösterir', () => {
    render(<Leaderboard entries={entries} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(within(rows[0]!).getByText('🥇')).toBeTruthy();
    // Eşit puanlılar aynı sırayı (ve madalyayı) paylaşır.
    expect(within(rows[1]!).getByText('🥈')).toBeTruthy();
    expect(within(rows[2]!).getByText('🥈')).toBeTruthy();
    expect(within(rows[3]!).getByText('4')).toBeTruthy();
    expect(within(rows[0]!).getByText('2.400')).toBeTruthy();
  });
});

describe('CountdownBadge', () => {
  it('kalan saniyeyi yukarı yuvarlar ve ekran okuyucuya söyler', () => {
    render(<CountdownBadge remainingMs={4200} totalSec={20} />);
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('5 saniye kaldı');
    expect(screen.getByText('5')).toBeTruthy();
  });
});
