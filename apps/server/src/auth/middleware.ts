import type { RequestHandler } from 'express';
import { HttpError } from '../errors';
import { verifyToken } from './token';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

function readToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/** Token varsa kullanıcıyı tanır, yoksa isteği engellemez. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req.headers.authorization);
  if (token) req.userId = verifyToken(token) ?? undefined;
  next();
};

/** Geçerli bir token olmadan isteğe izin vermez. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req.headers.authorization);
  const userId = token ? verifyToken(token) : null;
  if (!userId) {
    next(new HttpError(401, 'Bu işlem için giriş yapmalısınız'));
    return;
  }
  req.userId = userId;
  next();
};

/** requireAuth'tan sonra kullanılır; userId'nin var olduğunu tip olarak garanti eder. */
export function currentUserId(req: { userId?: string }): string {
  if (!req.userId) throw new HttpError(401, 'Bu işlem için giriş yapmalısınız');
  return req.userId;
}
