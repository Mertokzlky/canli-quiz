import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './env';
import { createSocketServer } from './socket';

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`Sunucu http://localhost:${env.PORT} adresinde çalışıyor`);
});

function shutdown() {
  console.log('Kapatılıyor...');
  io.close();
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
