import { describe, expect, it } from 'vitest';
import { formatDuration, formatPercent, formatRelative } from './format';

describe('formatDuration', () => {
  it('saniyeyi dakika ve saniyeye çevirir', () => {
    expect(formatDuration(45)).toBe('45 sn');
    expect(formatDuration(125)).toBe('2 dk 05 sn');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('oranı yüzde olarak gösterir, değer yoksa çizgi koyar', () => {
    expect(formatPercent(0.756)).toBe('%76');
    expect(formatPercent(0)).toBe('%0');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-11-28T12:00:00Z').getTime();
  const ago = (sec: number) => new Date(now - sec * 1000).toISOString();

  it('geçmiş zamanı Türkçe ve en uygun birimle gösterir', () => {
    expect(formatRelative(ago(20), now)).toBe('az önce');
    expect(formatRelative(ago(5 * 60), now)).toBe('5 dakika önce');
    expect(formatRelative(ago(3 * 3600), now)).toBe('3 saat önce');
    expect(formatRelative(ago(24 * 3600), now)).toBe('dün');
    expect(formatRelative(ago(3 * 24 * 3600), now)).toBe('3 gün önce');
  });
});
