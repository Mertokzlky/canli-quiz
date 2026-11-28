import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Her testten sonra ekranı ve tarayıcı depolamasını temizle.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// jsdom'da olmayan tarayıcı özellikleri (animasyon kütüphanesi "hareketi azalt" ayarını okur).
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
