// Yerel veritabanını (prisma dev) başlatır. Veritabanı zaten çalışıyorsa hiçbir şey yapmaz;
// "prisma dev" zaten açık bir veritabanında "Port ... is not available" hatası verip çıkıyor.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';

if (existsSync('.env')) process.loadEnvFile('.env');

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost:51214');
const host = url.hostname || 'localhost';
const port = Number(url.port || 5432);

/** Bu adreste bağlantı kabul eden bir sunucu var mı? */
function isListening() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

if (await isListening()) {
  console.log(`Veritabanı zaten çalışıyor (${host}:${port}).`);
  process.exit(0);
}

// Uzak bir veritabanı (ör. bulut) kullanılıyorsa yerelde başlatılacak bir şey yok.
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`Veritabanına ulaşılamıyor: ${host}:${port}`);
  process.exit(1);
}

// Veritabanı az önce kapatıldıysa kilit dosyası birkaç saniye tutulu kalabiliyor; tekrar dene.
for (let attempt = 1; attempt <= 3; attempt++) {
  console.log('Yerel veritabanı başlatılıyor...');
  const result = spawnSync('npx', ['prisma', 'dev', '--name', 'canli-quiz', '--detach'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status === 0 || (await isListening())) process.exit(0);
  if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
}
console.error('Veritabanı başlatılamadı. "npx prisma dev ls" ile durumuna bakabilirsiniz.');
process.exit(1);
