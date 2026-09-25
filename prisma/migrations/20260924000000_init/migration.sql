-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Product" AS ENUM ('TCCSG', 'PLATEHAVEN', 'NAVITAP');

-- CreateEnum
CREATE TYPE "AttributionRule" AS ENUM ('FIRST_VERIFIED', 'LAST_TOUCH');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "TouchType" AS ENUM ('FIRST', 'LAST');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('STARTED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ASSIGNED', 'WORKING', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES_MANAGER', 'SALES_REP');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'USER', 'PARTNER', 'VISITOR');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "attributionRule" "AttributionRule" NOT NULL DEFAULT 'FIRST_VERIFIED',
    "defaultCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SALES_REP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "product" "Product" NOT NULL DEFAULT 'TCCSG',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "commissionRate" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_sessions" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "product" "Product" NOT NULL DEFAULT 'TCCSG',
    "cookieId" TEXT NOT NULL,
    "landedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "landingPath" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrerUrl" TEXT,
    "userAgentHash" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_sessions" (
    "id" TEXT NOT NULL,
    "referralSessionId" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'STARTED',
    "answers" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "analysis_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "analysisSessionId" TEXT,
    "firstTouchPartnerId" TEXT,
    "lastTouchPartnerId" TEXT,
    "ownerUserId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "leadId" TEXT,
    "referralSessionId" TEXT,
    "touchType" "TouchType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'DISCOVERY',
    "amount" DECIMAL(12,2),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "basis" "AttributionRule" NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorType" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "verb" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "partners_slug_key" ON "partners"("slug");

-- CreateIndex
CREATE INDEX "partners_organizationId_status_idx" ON "partners"("organizationId", "status");

-- CreateIndex
CREATE INDEX "referral_sessions_cookieId_landedAt_idx" ON "referral_sessions"("cookieId", "landedAt");

-- CreateIndex
CREATE INDEX "referral_sessions_partnerId_landedAt_idx" ON "referral_sessions"("partnerId", "landedAt");

-- CreateIndex
CREATE INDEX "analysis_sessions_referralSessionId_idx" ON "analysis_sessions"("referralSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_analysisSessionId_key" ON "leads"("analysisSessionId");

-- CreateIndex
CREATE INDEX "leads_organizationId_status_idx" ON "leads"("organizationId", "status");

-- CreateIndex
CREATE INDEX "leads_firstTouchPartnerId_idx" ON "leads"("firstTouchPartnerId");

-- CreateIndex
CREATE INDEX "leads_ownerUserId_idx" ON "leads"("ownerUserId");

-- CreateIndex
CREATE INDEX "referrals_partnerId_occurredAt_idx" ON "referrals"("partnerId", "occurredAt");

-- CreateIndex
CREATE INDEX "referrals_leadId_touchType_idx" ON "referrals"("leadId", "touchType");

-- CreateIndex
CREATE INDEX "opportunities_leadId_idx" ON "opportunities"("leadId");

-- CreateIndex
CREATE INDEX "opportunities_ownerUserId_stage_idx" ON "opportunities"("ownerUserId", "stage");

-- CreateIndex
CREATE INDEX "commissions_partnerId_status_idx" ON "commissions"("partnerId", "status");

-- CreateIndex
CREATE INDEX "activity_events_subjectType_subjectId_createdAt_idx" ON "activity_events"("subjectType", "subjectId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_sessions" ADD CONSTRAINT "referral_sessions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_sessions" ADD CONSTRAINT "analysis_sessions_referralSessionId_fkey" FOREIGN KEY ("referralSessionId") REFERENCES "referral_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_analysisSessionId_fkey" FOREIGN KEY ("analysisSessionId") REFERENCES "analysis_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_firstTouchPartnerId_fkey" FOREIGN KEY ("firstTouchPartnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_lastTouchPartnerId_fkey" FOREIGN KEY ("lastTouchPartnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referralSessionId_fkey" FOREIGN KEY ("referralSessionId") REFERENCES "referral_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

