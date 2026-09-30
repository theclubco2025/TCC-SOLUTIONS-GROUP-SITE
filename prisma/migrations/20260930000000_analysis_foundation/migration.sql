-- Phase 2A: the analysis foundation.
--
-- publicId and updatedAt are added NOT NULL with no default. That is safe here
-- because analysis_sessions has never been written to - the table was scaffolded
-- in the init migration and no code path has ever created a row. If that turns
-- out to be wrong this migration fails loudly, the Vercel build fails with it,
-- and the previous deployment keeps serving. That is the intended failure mode.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AnalysisStatus" ADD VALUE 'ANALYZING';
ALTER TYPE "AnalysisStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "analysis_sessions" ADD COLUMN     "analyzingStartedAt" TIMESTAMP(3),
ADD COLUMN     "cookieId" TEXT,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "publicId" TEXT NOT NULL,
ADD COLUMN     "questionnaireVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "roiInputs" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userAgentHash" TEXT;

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" TEXT NOT NULL,
    "analysisSessionId" TEXT NOT NULL,
    "businessSummary" TEXT NOT NULL,
    "technologyEnvironment" TEXT NOT NULL,
    "overallAssessment" TEXT NOT NULL,
    "recommendedNextStep" TEXT NOT NULL,
    "roiResults" JSONB,
    "estimatedAnnualValue" DECIMAL(12,2),
    "model" TEXT NOT NULL,
    "effort" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technology_opportunities" (
    "id" TEXT NOT NULL,
    "analysisResultId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "complexity" TEXT NOT NULL,
    "implementationLow" DECIMAL(12,2) NOT NULL,
    "implementationHigh" DECIMAL(12,2) NOT NULL,
    "existingSoftwarePossible" BOOLEAN NOT NULL DEFAULT false,
    "customDevelopmentPotential" BOOLEAN NOT NULL DEFAULT false,
    "confidence" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technology_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analysis_results_analysisSessionId_key" ON "analysis_results"("analysisSessionId");

-- CreateIndex
CREATE INDEX "technology_opportunities_analysisResultId_rank_idx" ON "technology_opportunities"("analysisResultId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_sessions_publicId_key" ON "analysis_sessions"("publicId");

-- CreateIndex
CREATE INDEX "analysis_sessions_cookieId_startedAt_idx" ON "analysis_sessions"("cookieId", "startedAt");

-- CreateIndex
CREATE INDEX "analysis_sessions_ipHash_startedAt_idx" ON "analysis_sessions"("ipHash", "startedAt");

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_analysisSessionId_fkey" FOREIGN KEY ("analysisSessionId") REFERENCES "analysis_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technology_opportunities" ADD CONSTRAINT "technology_opportunities_analysisResultId_fkey" FOREIGN KEY ("analysisResultId") REFERENCES "analysis_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

