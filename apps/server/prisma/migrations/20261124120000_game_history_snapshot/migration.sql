-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_quizId_fkey";

-- DropIndex
DROP INDEX "GameSession_hostId_idx";

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "questionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "questionStats" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "quizTitle" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "quizId" DROP NOT NULL;

-- Mevcut oyun kayıtlarına quiz başlığını ve soru sayısını kopyala
UPDATE "GameSession" AS gs
SET "quizTitle" = q."title",
    "questionCount" = (SELECT COUNT(*) FROM "Question" qq WHERE qq."quizId" = q."id")
FROM "Quiz" AS q
WHERE gs."quizId" = q."id";

-- CreateIndex
CREATE INDEX "GameSession_hostId_endedAt_idx" ON "GameSession"("hostId", "endedAt");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

