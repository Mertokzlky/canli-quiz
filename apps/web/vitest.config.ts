import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Arayüz testleri tarayıcı yerine jsdom'da çalışır; Tailwind eklentisi testlerde gerekmez.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
