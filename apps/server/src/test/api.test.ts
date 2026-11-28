import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { QuizDetail, QuizInput } from '@canli-quiz/shared';
import { createApp } from '../app';
import { prisma } from '../db';

const app = createApp();
const RUN_ID = randomUUID().slice(0, 8);
const emailFor = (name: string) => `test-${RUN_ID}-${name}@example.com`;

async function registerUser(name: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: emailFor(name), password: 'gizli-sifre-123', displayName: name });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

const sampleQuiz = (overrides: Partial<QuizInput> = {}): QuizInput => ({
  title: 'Test Quizi',
  description: 'Açıklama',
  isPublic: false,
  questions: [
    {
      text: '2 + 2 kaçtır?',
      timeLimitSec: 20,
      choices: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
    },
  ],
  ...overrides,
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `test-${RUN_ID}-` } } });
  await prisma.$disconnect();
});

describe('kimlik doğrulama', () => {
  it('kayıt, giriş ve /me akışı çalışır', async () => {
    const token = await registerUser('ayse');

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: emailFor('ayse'), displayName: 'ayse' });
    expect(me.body.passwordHash).toBeUndefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: emailFor('ayse').toUpperCase(), password: 'gizli-sifre-123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTypeOf('string');
  });

  it('aynı e-postayla ikinci kayda izin vermez', async () => {
    await registerUser('mehmet');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: emailFor('mehmet'), password: 'baska-sifre-123', displayName: 'Mehmet' });
    expect(res.status).toBe(409);
  });

  it('aynı anda gelen iki kayıt isteğinden biri 409 döner, sunucu hatası olmaz', async () => {
    const body = { email: emailFor('ayni-anda'), password: 'gizli-sifre-123', displayName: 'Can' };
    const statuses = (
      await Promise.all([
        request(app).post('/api/auth/register').send(body),
        request(app).post('/api/auth/register').send(body),
      ])
    )
      .map((r) => r.status)
      .sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('görünen addaki görünmez karakterleri temizler', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: emailFor('gorunmez'),
        password: 'gizli-sifre-123',
        displayName: '​Deniz‏  Yılmazㅤ',
      });
    expect(res.status).toBe(201);
    expect(res.body.user.displayName).toBe('Deniz Yılmaz');
  });

  it('hatalı şifrede ve olmayan kullanıcıda aynı hatayı verir', async () => {
    await registerUser('zeynep');
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: emailFor('zeynep'), password: 'yanlis-sifre' });
    const noUser = await request(app)
      .post('/api/auth/login')
      .send({ email: emailFor('olmayan'), password: 'yanlis-sifre' });

    expect(wrongPassword.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPassword.body.error).toBe(noUser.body.error);
  });

  it('geçersiz kayıt bilgilerinde alan bazlı hata döner', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'eposta-degil', password: '123', displayName: 'A' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(
      expect.arrayContaining(['email', 'password', 'displayName']),
    );
  });

  it('token olmadan veya geçersiz token ile korumalı adrese izin vermez', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer sahte-token');
    expect(bad.status).toBe(401);
  });
});

describe('quizler', () => {
  it('oluşturma, listeleme, güncelleme ve silme çalışır', async () => {
    const token = await registerUser('ogretmen');
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app).post('/api/quizzes').set(auth).send(sampleQuiz());
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const list = await request(app).get('/api/quizzes').set(auth);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id, questionCount: 1, isOwner: true });

    const updated = await request(app)
      .put(`/api/quizzes/${id}`)
      .set(auth)
      .send(
        sampleQuiz({
          title: 'Yeni Başlık',
          questions: [
            ...sampleQuiz().questions,
            {
              text: 'Gökyüzü ne renktir?',
              timeLimitSec: 10,
              choices: [
                { text: 'Mavi', isCorrect: true },
                { text: 'Yeşil', isCorrect: false },
                { text: 'Kırmızı', isCorrect: false },
              ],
            },
          ],
        }),
      );
    expect(updated.status).toBe(200);

    const detail = await request(app).get(`/api/quizzes/${id}`).set(auth);
    const body = detail.body as QuizDetail;
    expect(body.title).toBe('Yeni Başlık');
    expect(body.questions.map((q) => q.text)).toEqual(['2 + 2 kaçtır?', 'Gökyüzü ne renktir?']);
    expect(body.questions[1]?.choices.map((c) => c.isCorrect)).toEqual([true, false, false]);

    expect((await request(app).delete(`/api/quizzes/${id}`).set(auth)).status).toBe(204);
    expect((await request(app).get(`/api/quizzes/${id}`).set(auth)).status).toBe(404);
  });

  it('tam olarak bir doğru cevap olmayan soruyu reddeder', async () => {
    const token = await registerUser('hatali');
    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${token}`)
      .send(
        sampleQuiz({
          questions: [
            {
              text: 'Doğru cevabı yok',
              timeLimitSec: 20,
              choices: [
                { text: 'A', isCorrect: false },
                { text: 'B', isCorrect: false },
              ],
            },
          ],
        }),
      );
    expect(res.status).toBe(400);
    expect(res.body.fields['questions.0.choices']).toBe('Tam olarak bir doğru cevap seçilmeli');
  });

  it('başkasının gizli quizini göstermez, herkese açık quizde doğru cevapları gizler', async () => {
    const owner = { Authorization: `Bearer ${await registerUser('sahip')}` };
    const other = { Authorization: `Bearer ${await registerUser('diger')}` };

    const { body } = await request(app).post('/api/quizzes').set(owner).send(sampleQuiz());
    const id = body.id as string;

    expect((await request(app).get(`/api/quizzes/${id}`).set(other)).status).toBe(404);
    expect((await request(app).get(`/api/quizzes/${id}`)).status).toBe(404);

    await request(app)
      .put(`/api/quizzes/${id}`)
      .set(owner)
      .send(sampleQuiz({ isPublic: true }));

    const seenByOther = await request(app).get(`/api/quizzes/${id}`).set(other);
    expect(seenByOther.status).toBe(200);
    expect(seenByOther.body.isOwner).toBe(false);
    for (const choice of seenByOther.body.questions[0].choices) {
      expect(choice.isCorrect).toBeUndefined();
    }

    const publicList = await request(app).get('/api/quizzes/public');
    expect(publicList.body.map((q: { id: string }) => q.id)).toContain(id);
  });

  it('başkasının quizini değiştirmeye veya silmeye izin vermez', async () => {
    const owner = { Authorization: `Bearer ${await registerUser('sahip2')}` };
    const other = { Authorization: `Bearer ${await registerUser('saldirgan')}` };
    const { body } = await request(app)
      .post('/api/quizzes')
      .set(owner)
      .send(sampleQuiz({ isPublic: true }));

    const put = await request(app).put(`/api/quizzes/${body.id}`).set(other).send(sampleQuiz());
    const del = await request(app).delete(`/api/quizzes/${body.id}`).set(other);
    expect(put.status).toBe(403);
    expect(del.status).toBe(403);
  });

  it('herkese açık bir quizi kendi hesabına doğru cevaplarıyla kopyalar', async () => {
    const owner = { Authorization: `Bearer ${await registerUser('yazar')}` };
    const other = { Authorization: `Bearer ${await registerUser('kopyalayan')}` };
    const { body } = await request(app)
      .post('/api/quizzes')
      .set(owner)
      .send(sampleQuiz({ isPublic: true }));

    const copy = await request(app).post(`/api/quizzes/${body.id}/copy`).set(other);
    expect(copy.status).toBe(201);

    const detail = await request(app).get(`/api/quizzes/${copy.body.id}`).set(other);
    expect(detail.body).toMatchObject({
      title: 'Test Quizi (kopya)',
      isOwner: true,
      isPublic: false,
    });
    expect(
      detail.body.questions[0].choices.map((c: { isCorrect: boolean }) => c.isCorrect),
    ).toEqual([false, true]);
  });
});

describe('hızlı quiz', () => {
  it('kategorileri listeler', async () => {
    const res = await request(app).get('/api/bank/categories');
    expect(res.status).toBe(200);
    expect(res.body.map((c: { slug: string }) => c.slug)).toEqual(
      expect.arrayContaining(['futbol', 'cs2', 'lol', 'turkce-muzik']),
    );
  });

  it('giriş yapmış kullanıcıya bankadan quiz oluşturur', async () => {
    const auth = { Authorization: `Bearer ${await registerUser('hizli')}` };
    const created = await request(app)
      .post('/api/bank/quick-quiz')
      .set(auth)
      .send({ categories: ['sinema', 'dizi'], questionCount: 5, difficulty: 'karisik' });
    expect(created.status).toBe(201);

    const detail = await request(app).get(`/api/quizzes/${created.body.id}`).set(auth);
    const body = detail.body as QuizDetail;
    expect(body).toMatchObject({
      title: 'Hızlı Quiz: Sinema, Dizi',
      isOwner: true,
      isPublic: false,
    });
    expect(body.questions).toHaveLength(5);
  });

  it('giriş yapmadan veya geçersiz seçimle quiz oluşturmaz', async () => {
    const noAuth = await request(app)
      .post('/api/bank/quick-quiz')
      .send({ categories: ['futbol'], questionCount: 5 });
    expect(noAuth.status).toBe(401);

    const auth = { Authorization: `Bearer ${await registerUser('hizli2')}` };
    const empty = await request(app)
      .post('/api/bank/quick-quiz')
      .set(auth)
      .send({ categories: [], questionCount: 5 });
    expect(empty.status).toBe(400);
    const unknown = await request(app)
      .post('/api/bank/quick-quiz')
      .set(auth)
      .send({ categories: ['yok'], questionCount: 5 });
    expect(unknown.status).toBe(400);
  });
});
