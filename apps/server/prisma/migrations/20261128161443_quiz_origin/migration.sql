-- CreateEnum
CREATE TYPE "QuizOrigin" AS ENUM ('MANUAL', 'QUICK');

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "origin" "QuizOrigin" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE INDEX "Quiz_ownerId_origin_createdAt_idx" ON "Quiz"("ownerId", "origin", "createdAt");

-- Bu sürümden önce oluşturulmuş, hiç düzenlenmemiş hızlı quizler geçici sayılır.
-- (Oluşturulduktan sonra editörde kaydedilmiş olanlar kalıcı kalır.)
UPDATE "Quiz"
SET "origin" = 'QUICK'
WHERE "title" LIKE 'Hızlı Quiz:%'
  AND "updatedAt" - "createdAt" < INTERVAL '2 seconds';
