import cors from 'cors';
import express from 'express';
import { env } from './env';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  return app;
}
