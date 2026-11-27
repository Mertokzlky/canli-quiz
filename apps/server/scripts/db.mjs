// Yerel geliştirme veritabanı: npm paketi olarak gelen gerçek PostgreSQL (embedded-postgres).
// Kurulum, Docker veya yönetici izni gerekmez.
//
//   node scripts/db.mjs start    → gerekirse oluşturur ve arka planda başlatır (açıksa dokunmaz)
//   node scripts/db.mjs stop     → düzgünce durdurur
//   node scripts/db.mjs status   → çalışıyor mu?
//
// `npm run dev` ilk iş olarak `start` çalıştırır. Bilgisayar düzgün kapanmasa bile PostgreSQL bir
// sonraki açılışta kendi kurtarma mekanizmasıyla toparlanır.
//
// Veriler ve PostgreSQL programları işletim sisteminin uygulama verisi klasöründe durur
// (Windows: %LOCALAPPDATA%\canli-quiz). Proje klasöründe tutulamaz: Windows'ta PostgreSQL,
// "canlı-quiz" gibi Türkçe karakter içeren yollarda çalışamıyor. Bu yüzden programlar da
// gerekirse node_modules'tan bir kez oraya kopyalanır.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(SERVER_DIR, '.env');

/** İşletim sisteminin uygulama verisi klasörü. */
function appDataDir() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
  }
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support');
  return process.env.XDG_DATA_HOME ?? path.join(home, '.local', 'share');
}

/** Yalnızca ASCII karakterlerden mi oluşuyor? (PostgreSQL Windows'ta başkasını okuyamıyor.) */
const isAscii = (text) => [...text].every((ch) => ch.charCodeAt(0) < 128);

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

// CANLI_QUIZ_PGDATA ile başka bir klasör seçilebilir.
const ROOT_DIR = process.env.CANLI_QUIZ_PGDATA ?? path.join(appDataDir(), 'canli-quiz');
const DATA_DIR = path.join(ROOT_DIR, 'postgres');
const LOG_FILE = path.join(ROOT_DIR, 'postgres.log');

const url = new URL(
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/canli_quiz',
);
const host = url.hostname || 'localhost';
const port = Number(url.port || 5432);
const user = decodeURIComponent(url.username || 'postgres');
const password = decodeURIComponent(url.password || 'postgres');
const database = decodeURIComponent(url.pathname.slice(1)) || 'canli_quiz';
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);

/**
 * Klasörü dosya dosya kopyalar. fs.cpSync kullanılmıyor: Node 24'te Windows'ta Türkçe karakterli
 * yollarda hata vermeden süreci sonlandırıyor.
 */
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else if (entry.isFile()) copyFileSync(src, dest);
  }
}

/** İşletim sistemine uygun PostgreSQL programlarının (pg_ctl, initdb) yolları. */
async function binaries() {
  const names = { win32: 'windows', darwin: 'darwin', linux: 'linux' };
  const platform = names[process.platform];
  if (!platform) throw new Error(`Desteklenmeyen işletim sistemi: ${process.platform}`);
  const pkg = `@embedded-postgres/${platform}-${process.arch}`;
  let bins;
  try {
    bins = await import(pkg);
  } catch {
    throw new Error(
      `Bu sistem için PostgreSQL paketi bulunamadı (${pkg}). "npm install" çalıştırın.`,
    );
  }
  if (isAscii(bins.pg_ctl)) return bins;

  // Programlar Türkçe karakterli bir yolda: ASCII bir klasöre (sürüm başına bir kez) kopyalanır.
  const nativeDir = path.dirname(path.dirname(bins.pg_ctl));
  const { version } = JSON.parse(readFileSync(path.join(nativeDir, '..', 'package.json'), 'utf8'));
  const target = path.join(ROOT_DIR, `pg-${version}`);
  const marker = path.join(target, '.tamam');
  if (!existsSync(marker)) {
    console.log(`PostgreSQL programları kopyalanıyor (bir kerelik): ${target}`);
    rmSync(target, { recursive: true, force: true });
    copyDir(nativeDir, target);
    writeFileSync(marker, version);
  }
  const ext = process.platform === 'win32' ? '.exe' : '';
  return {
    pg_ctl: path.join(target, 'bin', `pg_ctl${ext}`),
    initdb: path.join(target, 'bin', `initdb${ext}`),
  };
}

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

/**
 * Programı çalıştırır. `quiet`: çıktı kanalları devredilmez. pg_ctl start için şart; arka planda
 * kalan PostgreSQL bu kanalları devralırsa, çıktıyı okuyan taraf (ör. bir IDE) hiç bitmez.
 * LC_ALL=C: PostgreSQL mesajları İngilizce gelir; Türkçesi Windows terminalinde bozuk görünüyor.
 */
function run(bin, args, { quiet = false } = {}) {
  const result = spawnSync(bin, args, {
    stdio: quiet ? 'ignore' : 'inherit',
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/** Veri klasörünü ilk kez oluşturur. */
async function initialise() {
  if (!isAscii(DATA_DIR)) {
    throw new Error(
      `Veri klasörünün yolunda Türkçe/özel karakter var (${DATA_DIR}). CANLI_QUIZ_PGDATA ile başka bir klasör seçin.`,
    );
  }
  const { initdb } = await binaries();
  mkdirSync(ROOT_DIR, { recursive: true });
  console.log(`Yerel veritabanı ilk kez oluşturuluyor: ${DATA_DIR}`);
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'canli-quiz-'));
  const pwFile = path.join(tmp, 'pw');
  writeFileSync(pwFile, password);
  try {
    const status = run(initdb, [
      '-D',
      DATA_DIR,
      '-U',
      user,
      `--pwfile=${pwFile}`,
      '--auth=scram-sha-256',
      '--encoding=UTF8',
      '--locale=C',
    ]);
    if (status !== 0) throw new Error('Veritabanı oluşturulamadı (initdb).');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Uygulamanın veritabanı yoksa oluşturur. */
async function ensureDatabase() {
  const client = new pg.Client({ host, port, user, password, database: 'postgres' });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
      console.log(`"${database}" veritabanı oluşturuldu.`);
    }
  } finally {
    await client.end();
  }
}

async function start() {
  if (!isLocal) {
    console.log(`Uzak veritabanı kullanılıyor (${host}); yerel veritabanı başlatılmadı.`);
    return 0;
  }
  if (await isListening()) {
    console.log(`Veritabanı zaten çalışıyor (${host}:${port}).`);
    return 0;
  }
  if (!existsSync(path.join(DATA_DIR, 'PG_VERSION'))) await initialise();

  const { pg_ctl } = await binaries();
  console.log(`Yerel veritabanı başlatılıyor (${host}:${port})...`);
  const status = run(
    pg_ctl,
    [
      'start',
      '-D',
      DATA_DIR,
      '-l',
      LOG_FILE,
      '-w',
      '-t',
      '60',
      '-o',
      `-p ${port} -c listen_addresses=localhost`,
    ],
    { quiet: true },
  );
  if (status !== 0 || !(await isListening())) {
    console.error(`Veritabanı başlatılamadı. Ayrıntılar: ${LOG_FILE}`);
    return 1;
  }
  await ensureDatabase();
  console.log(`Veritabanı hazır (${host}:${port}).`);
  return 0;
}

async function stop() {
  if (!existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    console.log('Yerel veritabanı henüz oluşturulmamış.');
    return 0;
  }
  if (!(await isListening())) {
    console.log('Veritabanı zaten kapalı.');
    return 0;
  }
  const { pg_ctl } = await binaries();
  return run(pg_ctl, ['stop', '-D', DATA_DIR, '-m', 'fast', '-w']);
}

async function status() {
  const up = await isListening();
  console.log(up ? `Veritabanı çalışıyor (${host}:${port}).` : 'Veritabanı kapalı.');
  return up ? 0 : 1;
}

const commands = { start, stop, status };
const command = commands[process.argv[2] ?? 'start'];
if (!command) {
  console.error('Kullanım: node scripts/db.mjs start|stop|status');
  process.exit(1);
}
try {
  process.exit(await command());
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
