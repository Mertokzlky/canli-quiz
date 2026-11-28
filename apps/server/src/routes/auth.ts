import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  loginSchema,
  registerSchema,
  type AuthResponse,
  type PublicUser,
} from '@canli-quiz/shared';
import { currentUserId, requireAuth } from '../auth/middleware';
import { signToken } from '../auth/token';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from '../errors';

const BCRYPT_ROUNDS = 10;

// Kaba kuvvet denemelerine karşı: IP başına 15 dakikada 20 deneme.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Çok fazla deneme yaptınız, lütfen biraz sonra tekrar deneyin' },
});

const toPublicUser = (u: { id: string; email: string; displayName: string }): PublicUser => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, 'Bu e-posta ile kayıtlı bir hesap zaten var');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  let user;
  try {
    user = await prisma.user.create({
      data: { email: input.email, displayName: input.displayName, passwordHash },
    });
  } catch (error) {
    // Aynı e-postayla aynı anda iki istek gelirse yukarıdaki kontrol ikisini de geçirebilir.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'Bu e-posta ile kayıtlı bir hesap zaten var');
    }
    throw error;
  }

  const body: AuthResponse = { token: signToken(user.id), user: toPublicUser(user) };
  res.status(201).json(body);
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Kullanıcı olsa da olmasa da aynı mesaj: hangi e-postaların kayıtlı olduğu sızmasın.
  const valid = user && (await bcrypt.compare(input.password, user.passwordHash));
  if (!user || !valid) throw new HttpError(401, 'E-posta veya şifre hatalı');

  const body: AuthResponse = { token: signToken(user.id), user: toPublicUser(user) };
  res.json(body);
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
  if (!user) throw new HttpError(401, 'Oturum geçersiz, lütfen tekrar giriş yapın');
  res.json(toPublicUser(user));
});
