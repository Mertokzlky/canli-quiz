import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import type {
  GameHistoryDetail,
  GameHistorySummary,
  GameStats,
  QuestionStat,
} from '@canli-quiz/shared';
import { currentUserId, requireAuth } from '../auth/middleware';
import { prisma } from '../db';
import { notFound } from '../errors';

const HISTORY_PAGE_SIZE = 50;

const summaryInclude = {
  results: { orderBy: { rank: 'asc' } },
} satisfies Prisma.GameSessionInclude;

type SessionRow = Prisma.GameSessionGetPayload<{ include: typeof summaryInclude }>;

/** Veritabanındaki JSON alanı dışarıdan gelmiş gibi ele alınır: beklenen şekle uymayanlar atlanır. */
function parseStats(value: Prisma.JsonValue): QuestionStat[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is QuestionStat & Prisma.JsonObject =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Record<string, unknown>).text === 'string' &&
      typeof (s as Record<string, unknown>).answered === 'number' &&
      typeof (s as Record<string, unknown>).correct === 'number',
  );
}

function toSummary(row: SessionRow): GameHistorySummary {
  const stats = parseStats(row.questionStats);
  const answered = stats.reduce((sum, s) => sum + s.answered, 0);
  const correct = stats.reduce((sum, s) => sum + s.correct, 0);
  const winner = row.results[0];
  const durationSec =
    row.startedAt && row.endedAt
      ? Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 1000)
      : null;

  return {
    id: row.id,
    quizTitle: row.quizTitle || 'İsimsiz quiz',
    quizId: row.quizId,
    endedAt: (row.endedAt ?? row.createdAt).toISOString(),
    durationSec,
    playerCount: row.results.length,
    questionCount: row.questionCount,
    playedQuestionCount: stats.length,
    accuracy: answered === 0 ? null : correct / answered,
    winner: winner ? { nickname: winner.nickname, score: winner.score } : null,
  };
}

export const gamesRouter = Router();

/** Giriş yapan kullanıcının sunucu olduğu biten oyunlar, en yeniden eskiye. */
gamesRouter.get('/', requireAuth, async (req, res) => {
  const rows = await prisma.gameSession.findMany({
    where: { hostId: currentUserId(req), status: 'FINISHED' },
    include: summaryInclude,
    orderBy: { endedAt: 'desc' },
    take: HISTORY_PAGE_SIZE,
  });
  res.json(rows.map(toSummary));
});

/** Paneldeki istatistikler için tüm biten oyunların toplamları. */
gamesRouter.get('/stats', requireAuth, async (req, res) => {
  const hostId = currentUserId(req);
  const [gameCount, playerCount] = await Promise.all([
    prisma.gameSession.count({ where: { hostId, status: 'FINISHED' } }),
    prisma.playerResult.count({ where: { session: { hostId, status: 'FINISHED' } } }),
  ]);
  res.json({ gameCount, playerCount } satisfies GameStats);
});

gamesRouter.get('/:id', requireAuth, async (req, res) => {
  const row = await prisma.gameSession.findUnique({
    where: { id: req.params.id as string },
    include: summaryInclude,
  });
  // Başkasının oyunu da "bulunamadı" döner: varlığı sızmasın.
  if (!row || row.hostId !== currentUserId(req)) throw notFound('Oyun');

  const body: GameHistoryDetail = {
    ...toSummary(row),
    results: row.results.map((r) => ({
      rank: r.rank,
      nickname: r.nickname,
      score: r.score,
      correctCount: r.correctCount,
    })),
    questionStats: parseStats(row.questionStats),
  };
  res.json(body);
});

gamesRouter.delete('/:id', requireAuth, async (req, res) => {
  const { count } = await prisma.gameSession.deleteMany({
    where: { id: req.params.id as string, hostId: currentUserId(req) },
  });
  if (count === 0) throw notFound('Oyun');
  res.status(204).end();
});
