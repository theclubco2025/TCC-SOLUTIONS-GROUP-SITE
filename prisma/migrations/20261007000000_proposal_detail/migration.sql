-- Proposals: the extra shape each opportunity now carries on the report, and
-- the "start this week" list on the result.
--
-- Additive and nullable. Reports generated before this have NULL here and the
-- report renders them as before, without the flow, the questions or the list.

-- AlterTable
ALTER TABLE "analysis_results" ADD COLUMN     "startToday" JSONB;

-- AlterTable
ALTER TABLE "technology_opportunities" ADD COLUMN     "detail" JSONB;
