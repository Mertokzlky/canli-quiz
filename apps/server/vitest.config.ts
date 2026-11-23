import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    // Testler aynı veritabanını kullandığı için dosyalar sırayla çalışır.
    fileParallelism: false,
    // Yerel veritabanı (prisma dev) tek bağlantıyla çalıştığı için sorgular yavaş olabilir.
    testTimeout: 20_000,
  },
});
