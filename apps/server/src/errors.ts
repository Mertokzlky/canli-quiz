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

  console.error(err);
  res.status(500).json({ error: 'Beklenmeyen bir hata oluştu' } satisfies ApiError);
};
