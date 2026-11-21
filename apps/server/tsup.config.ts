import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Ortak paket kaynak olarak (TypeScript) geldiği için çıktıya gömülür.
  noExternal: ['@canli-quiz/shared'],
});
