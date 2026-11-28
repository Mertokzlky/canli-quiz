import cors from 'cors';
import express from 'express';
import { env } from './env';
import { errorHandler } from './errors';
import { authRouter } from './routes/auth';
import { bankRouter } from './routes/bank';
import { gamesRouter } from './routes/games';
import { quizzesRouter } from './routes/quizzes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Ara sunucu arkasında gerçek istemci IP'si (deneme sınırları için) X-Forwarded-For'dan okunur.
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: '200kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/quizzes', quizzesRouter);
  app.use('/api/bank', bankRouter);
  app.use('/api/games', gamesRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Böyle bir adres yok' });
  });

  app.use(errorHandler);

  return app;
}
