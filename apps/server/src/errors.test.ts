import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler, isDatabaseUnavailable } from './errors';

function run(err: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(err, {} as Request, res as unknown as Response, vi.fn());
  return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
}

describe('errorHandler', () => {
  it('veritabanına ulaşılamayınca 503 ve anlaşılır bir mesaj döner', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at localhost:5433",
      '6.19.0',
    );
    expect(isDatabaseUnavailable(err)).toBe(true);
    const { status, body } = run(err);
    expect(status).toBe(503);
    expect(body.error).toContain('Veritabanına şu an ulaşılamıyor');
  });

  it('bağlantı kodlu Prisma hatalarını da veritabanı kesintisi sayar', () => {
    const err = new Prisma.PrismaClientKnownRequestError("Can't reach database server", {
      code: 'P1001',
      clientVersion: '6.19.0',
    });
    expect(isDatabaseUnavailable(err)).toBe(true);
  });

  it('diğer Prisma hatalarını kesinti saymaz', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.0',
    });
    expect(isDatabaseUnavailable(err)).toBe(false);
  });

  it('bilinmeyen hatalarda 500 döner', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = run(new Error('beklenmedik'));
    expect(status).toBe(500);
    expect(body.error).toBe('Beklenmeyen bir hata oluştu');
  });
});
