-- Bootstrap rows, not schema.
--
-- The app needs an Organization to hang leads and partners off, and at least
-- one ACTIVE partner or every referral link 404s and the system cannot be
-- tested at all. The demo store's three partners exist only when there is no
-- database, so they disappear the moment this one is connected.
--
-- Idempotent: re-running a deploy must not duplicate or overwrite rows a human
-- has since edited.

INSERT INTO "organizations" ("id", "slug", "name", "legalName", "attributionRule", "defaultCommissionRate", "createdAt", "updatedAt")
VALUES ('org_tccsg', 'tccsg', 'TCC Solutions Group', 'TCC Solutions Group LLC', 'FIRST_VERIFIED', 0.1, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- An internal slug for verifying the chain end to end. Not a real business:
-- real partners get created deliberately, with terms agreed first.
INSERT INTO "partners" ("id", "organizationId", "product", "slug", "name", "status", "approvedAt", "createdAt", "updatedAt")
SELECT 'partner_tccsg_test', "id", 'TCCSG', 'tccsg-test', 'TCCSG Internal Test', 'ACTIVE', NOW(), NOW(), NOW()
FROM "organizations" WHERE "slug" = 'tccsg'
ON CONFLICT ("slug") DO NOTHING;
