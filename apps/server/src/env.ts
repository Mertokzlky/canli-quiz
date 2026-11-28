import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL gerekli'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Sunucunun önündeki güvenilir ara sunucu sayısı (Render, Railway vb. için genelde 1).
  // Doğru ayarlanmazsa deneme sınırları kişi başına değil tüm site için tek bir IP'ye uygulanır.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Geçersiz ortam değişkenleri:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
