import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    // Testler aynı veritabanını kullandığı için dosyalar sırayla çalışır.
    fileParallelism: false,
  },
});
