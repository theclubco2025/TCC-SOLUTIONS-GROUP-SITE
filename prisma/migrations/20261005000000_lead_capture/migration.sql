-- Phase 3: the bridge from an anonymous analysis to a lead someone can work.
--
-- Additive only. Both unique indexes are safe to create now because "leads" and
-- "opportunities" have never been written to - nothing in the application has
-- ever created either. If that turns out to be wrong the index creation fails
-- loudly, the Vercel build fails with it, and the previous deployment keeps
-- serving, which is the intended failure mode.
--
--   leads(organizationId, email)  one lead per person. Emails are stored
--                                 lowercased; NULLs never collide in Postgres.
--   opportunities(analysisSessionId)  one opportunity per analysis, so
--                                 submitting the same report twice cannot
--                                 create two.

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "consultationRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "analysisSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "leads_organizationId_email_key" ON "leads"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_analysisSessionId_key" ON "opportunities"("analysisSessionId");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_analysisSessionId_fkey" FOREIGN KEY ("analysisSessionId") REFERENCES "analysis_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

