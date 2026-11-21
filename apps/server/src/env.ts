import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  // Veritabanı 2. haftada devreye girecek; o zamana kadar zorunlu değil.
  DATABASE_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Geçersiz ortam değişkenleri:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
