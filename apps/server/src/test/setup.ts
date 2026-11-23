import { existsSync } from 'node:fs';

// Yerelde .env'deki DATABASE_URL kullanılır; CI'da değişkenler workflow'dan gelir.
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';
