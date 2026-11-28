import { Router } from 'express';
import { QUICK_QUIZ_KEEP, quickQuizSchema } from '@canli-quiz/shared';
import { currentUserId, requireAuth } from '../auth/middleware';
import { BankError, buildQuickQuiz, listCategories } from '../bank';
import { prisma } from '../db';
import { HttpError } from '../errors';
import { createQuizData } from './quizzes';

export const bankRouter = Router();

bankRouter.get('/categories', (_req, res) => {
  res.json(listCategories());
});

/**
 * Soru bankasından rastgele bir quiz oluşturup kullanıcının hesabına geçici olarak ekler.
 * Panel dolmasın diye en son QUICK_QUIZ_KEEP hızlı quiz saklanır, daha eskileri silinir.
 * Oynanmış oyunların sonuçları silinen quizden bağımsız saklandığı için geçmiş kaybolmaz.
 */
bankRouter.post('/quick-quiz', requireAuth, async (req, res) => {
  const input = quickQuizSchema.parse(req.body);

  let quiz;
  try {
    quiz = buildQuickQuiz(input);
  } catch (error) {
    if (error instanceof BankError) throw new HttpError(400, error.message);
    throw error;
  }

  const userId = currentUserId(req);
  const created = await prisma.quiz.create({
    data: { ...createQuizData(quiz, userId), origin: 'QUICK' },
    select: { id: true },
  });

  const old = await prisma.quiz.findMany({
    where: { ownerId: userId, origin: 'QUICK' },
    orderBy: { createdAt: 'desc' },
    skip: QUICK_QUIZ_KEEP,
    select: { id: true },
  });
  if (old.length > 0) {
    await prisma.quiz.deleteMany({ where: { id: { in: old.map((q) => q.id) } } });
  }
  res.status(201).json(created);
});
