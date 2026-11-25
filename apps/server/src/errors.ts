import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiError } from '@canli-quiz/shared';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Kayıt') => new HttpError(404, `${what} bulunamadı`);

/** Prisma'nın "veritabanına ulaşılamıyor" türündeki hata kodları. */
const DB_UNREACHABLE_CODES = new Set(['P1001', 'P1002', 'P1017']);

export function isDatabaseUnavailable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  return err instanceof Prisma.PrismaClientKnownRequestError && DB_UNREACHABLE_CODES.has(err.code);
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    const body: ApiError = { error: 'Gönderilen bilgiler geçersiz', fields };
    res.status(400).json(body);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message } satisfies ApiError);
    return;
  }

  // express.json() bozuk JSON'da 400 hatası fırlatır.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Geçersiz JSON' } satisfies ApiError);
    return;
  }

  if (isDatabaseUnavailable(err)) {
    console.error(
      'Veritabanına bağlanılamadı. Yerelde çalışıyorsanız "npm run db:start -w @canli-quiz/server" ile başlatın.',
    );
    res.status(503).json({
      error: 'Veritabanına şu an ulaşılamıyor. Lütfen biraz sonra tekrar deneyin.',
    } satisfies ApiError);
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Beklenmeyen bir hata oluştu' } satisfies ApiError);
};
