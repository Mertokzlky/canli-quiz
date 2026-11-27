// Yerel geliştirme veritabanını (prisma dev) güvenle başlatır. `npm run dev` bunu ilk iş olarak çalıştırır.
//
// prisma dev'in bilinen sorunlarına karşı:
// - Veritabanı zaten açıkken tekrar başlatmak "Port ... is not available" hatası veriyor
//   → sunucu çalışıyor ve portu cevap veriyorsa yeniden başlatılmaz.
// - Portları ilk açılışta kendisi seçip server.json'a kaydediyor; .env ise sabit port bekliyor
//   → gerçek port server.json'dan okunur ve .env'deki DATABASE_URL buna göre güncellenir.
// - Bilgisayar düzgün kapanmazsa kilit dosyaları kalıyor ve sonraki açılışta "Aborted()" ile çöküyor
//   → kilitleri tutan süreç artık yaşamıyorsa bu eski kilitler silinir (veriye dokunulmaz).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const NAME = 'canli-quiz';
const ENV_FILE = '.env';

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const envUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost:51214');
const host = envUrl.hostname || 'localhost';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bu portta bağlantı kabul eden bir sunucu var mı? */
function isListening(port) {
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

async function waitFor(predicate, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await predicate()) return true;
    await sleep(500);
  }
  return false;
}

/** prisma dev'in veri klasörü (env-paths kütüphanesinin "data" yolu). */
function dataDir() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'),
      'prisma-dev-nodejs',
      'Data',
    );
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'prisma-dev-nodejs');
  }
  return path.join(
    process.env.XDG_DATA_HOME ?? path.join(home, '.local', 'share'),
    'prisma-dev-nodejs',
  );
}

/** prisma dev'in kaydettiği sunucu bilgisi: süreç kimliği ve veritabanı portu. */
function serverInfo() {
  try {
    const info = JSON.parse(readFileSync(path.join(dataDir(), NAME, 'server.json'), 'utf8'));
    return {
      pid: typeof info.pid === 'number' ? info.pid : null,
      dbPort: typeof info.databasePort === 'number' ? info.databasePort : null,
    };
  } catch {
    return { pid: null, dbPort: null };
  }
}

function isProcessAlive(pid) {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/** .env'deki DATABASE_URL'in portunu veritabanının gerçek portuna eşitler. */
function syncEnvPort(port) {
  if (Number(envUrl.port) === port || !existsSync(ENV_FILE)) return;
  const text = readFileSync(ENV_FILE, 'utf8');
  const updated = text.replace(
    /^(DATABASE_URL=.*?@(?:localhost|127\.0\.0\.1):)\d+/m,
    (_, prefix) => `${prefix}${port}`,
  );
  if (updated !== text) {
    writeFileSync(ENV_FILE, updated);
    console.log(`Veritabanı portu değişmiş; .env güncellendi (${envUrl.port} → ${port}).`);
  }
}

async function ready(port) {
  syncEnvPort(port);
  console.log(`Veritabanı hazır (${host}:${port}).`);
  process.exit(0);
}

// Uzak bir veritabanı (ör. bulut) kullanılıyorsa yerelde başlatılacak bir şey yok.
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.log(`Uzak veritabanı kullanılıyor (${host}); yerel veritabanı başlatılmadı.`);
  process.exit(0);
}

const before = serverInfo();
if (isProcessAlive(before.pid) && before.dbPort && (await isListening(before.dbPort))) {
  await ready(before.dbPort);
}

if (!isProcessAlive(before.pid)) {
  // Düzgün kapanmamış bir oturumdan kalan kilitler. Sadece kilit dosyaları silinir, veri değil.
  const staleLocks = [
    path.join(dataDir(), NAME, '.pglite', 'postmaster.pid'),
    path.join(dataDir(), NAME, '.lock'),
    path.join(dataDir(), 'durable-streams', NAME, 'server.lock.lock'),
  ].filter((p) => existsSync(p));
  for (const lock of staleLocks) rmSync(lock, { recursive: true, force: true });
  if (staleLocks.length > 0) console.log('Önceki oturumdan kalan kilit dosyaları temizlendi.');
}

for (let attempt = 1; attempt <= 3; attempt++) {
  console.log('Yerel veritabanı başlatılıyor...');
  try {
    execSync(`npx prisma dev --name ${NAME} --detach`, { stdio: 'inherit' });
  } catch {
    // Aşağıda port kontrolüyle değerlendirilir.
  }
  const started = await waitFor(async () => {
    const { pid, dbPort } = serverInfo();
    return isProcessAlive(pid) && dbPort !== null && (await isListening(dbPort));
  }, 15_000);
  if (started) await ready(serverInfo().dbPort);
  if (attempt < 3) await sleep(3000);
}

console.error(
  'Veritabanı başlatılamadı. Durumuna "npx prisma dev ls" ile bakabilirsiniz (apps/server klasöründe).',
);
process.exit(1);
