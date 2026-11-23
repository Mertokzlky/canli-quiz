import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  quizInputSchema,
  type QuizDetail,
  type QuizInputParsed,
  type QuizSummary,
} from '@canli-quiz/shared';
import { currentUserId, optionalAuth, requireAuth } from '../auth/middleware';
import { prisma } from '../db';
import { HttpError, notFound } from '../errors';

const summarySelect = {
  id: true,
  title: true,
  description: true,
  isPublic: true,
  updatedAt: true,
  ownerId: true,
  owner: { select: { displayName: true } },
  _count: { select: { questions: true } },
} satisfies Prisma.QuizSelect;

type SummaryRow = Prisma.QuizGetPayload<{ select: typeof summarySelect }>;

const toSummary = (q: SummaryRow, userId?: string): QuizSummary => ({
  id: q.id,
  title: q.title,
  description: q.description,
  isPublic: q.isPublic,
  questionCount: q._count.questions,
  ownerName: q.owner.displayName,
  isOwner: q.ownerId === userId,
  updatedAt: q.updatedAt.toISOString(),
});

const detailInclude = {
  questions: {
    orderBy: { order: 'asc' },
    include: { choices: { orderBy: { order: 'asc' } } },
  },
} satisfies Prisma.QuizInclude;

/** Soruları ve şıkları, sıralarıyla birlikte iç içe oluşturma verisine çevirir. */
const questionsCreateData = (input: QuizInputParsed) => ({
  create: input.questions.map((q, qi) => ({
    order: qi,
    text: q.text,
    imageUrl: q.imageUrl ?? null,
    timeLimitSec: q.timeLimitSec,
    choices: {
      create: q.choices.map((c, ci) => ({ order: ci, text: c.text, isCorrect: c.isCorrect })),
    },
  })),
});

/** Quizi bulur; sahibi değilse ve quiz gizliyse 404 döner (varlığı sızmasın). */
async function findReadableQuiz(id: string, userId?: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id }, include: detailInclude });
  if (!quiz || (!quiz.isPublic && quiz.ownerId !== userId)) throw notFound('Quiz');
  return quiz;
}

async function assertOwner(id: string, userId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id }, select: { ownerId: true } });
  if (!quiz) throw notFound('Quiz');
  if (quiz.ownerId !== userId) throw new HttpError(403, 'Bu quiz üzerinde yetkiniz yok');
}

export const quizzesRouter = Router();

/** Giriş yapan kullanıcının quizleri. */
quizzesRouter.get('/', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const rows = await prisma.quiz.findMany({
    where: { ownerId: userId },
    select: summarySelect,
    orderBy: { updatedAt: 'desc' },
  });
  res.json(rows.map((q) => toSummary(q, userId)));
});

/** Herkese açık quizler (hazır demo quizler dahil). */
quizzesRouter.get('/public', optionalAuth, async (req, res) => {
  const rows = await prisma.quiz.findMany({
    where: { isPublic: true },
    select: summarySelect,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  res.json(rows.map((q) => toSummary(q, req.userId)));
});

quizzesRouter.get('/:id', optionalAuth, async (req, res) => {
  const quiz = await findReadableQuiz(req.params.id as string, req.userId);
  const isOwner = quiz.ownerId === req.userId;

  const body: QuizDetail = {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    isPublic: quiz.isPublic,
    isOwner,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      imageUrl: q.imageUrl,
      timeLimitSec: q.timeLimitSec,
      // Doğru cevaplar sadece sahibine gider.
      choices: q.choices.map((c) =>
        isOwner ? { id: c.id, text: c.text, isCorrect: c.isCorrect } : { id: c.id, text: c.text },
      ),
    })),
  };
  res.json(body);
});

quizzesRouter.post('/', requireAuth, async (req, res) => {
  const input = quizInputSchema.parse(req.body);
  const quiz = await prisma.quiz.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      isPublic: input.isPublic,
      ownerId: currentUserId(req),
      questions: questionsCreateData(input),
    },
    select: { id: true },
  });
  res.status(201).json(quiz);
});

/** Quizi bütün olarak günceller: eski sorular silinip yenileri yazılır. */
quizzesRouter.put('/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string;
  await assertOwner(id, currentUserId(req));
  const input = quizInputSchema.parse(req.body);

  await prisma.$transaction([
    prisma.question.deleteMany({ where: { quizId: id } }),
    prisma.quiz.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description ?? null,
        isPublic: input.isPublic,
        questions: questionsCreateData(input),
      },
    }),
  ]);
  res.json({ id });
});

quizzesRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string;
  await assertOwner(id, currentUserId(req));
  await prisma.quiz.delete({ where: { id } });
  res.status(204).end();
});

/** Okunabilen bir quizi (ör. herkese açık demo) kullanıcının hesabına gizli kopya olarak ekler. */
quizzesRouter.post('/:id/copy', requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const source = await findReadableQuiz(req.params.id as string, userId);

  const copy = await prisma.quiz.create({
    data: {
      title: `${source.title} (kopya)`.slice(0, 100),
      description: source.description,
      isPublic: false,
      ownerId: userId,
      questions: {
        create: source.questions.map((q) => ({
          order: q.order,
          text: q.text,
          imageUrl: q.imageUrl,
          timeLimitSec: q.timeLimitSec,
          choices: {
            create: q.choices.map((c) => ({
              order: c.order,
              text: c.text,
              isCorrect: c.isCorrect,
            })),
          },
        })),
      },
    },
    select: { id: true },
  });
  res.status(201).json(copy);
});
