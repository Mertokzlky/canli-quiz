import { Router } from 'express';
import { quickQuizSchema } from '@canli-quiz/shared';
import { currentUserId, requireAuth } from '../auth/middleware';
import { BankError, buildQuickQuiz, listCategories } from '../bank';
import { prisma } from '../db';
import { HttpError } from '../errors';
import { createQuizData } from './quizzes';

export const bankRouter = Router();

bankRouter.get('/categories', (_req, res) => {
  res.json(listCategories());
});

/** Soru bankasından rastgele bir quiz oluşturup kullanıcının hesabına ekler. */
bankRouter.post('/quick-quiz', requireAuth, async (req, res) => {
  const input = quickQuizSchema.parse(req.body);

  let quiz;
  try {
    quiz = buildQuickQuiz(input);
  } catch (error) {
    if (error instanceof BankError) throw new HttpError(400, error.message);
    throw error;
  }

  const created = await prisma.quiz.create({
    data: createQuizData(quiz, currentUserId(req)),
    select: { id: true },
  });
  res.status(201).json(created);
});
