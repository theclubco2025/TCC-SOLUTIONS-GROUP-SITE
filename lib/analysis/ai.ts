import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import {
  ANALYSIS_LIMITS,
  COMPLEXITY_BANDS,
  CONFIDENCE_LEVELS,
  IMPLEMENTATION_RANGES,
  OPPORTUNITY_CATEGORIES,
  QUESTIONNAIRE,
} from '@/lib/analysis/config'
import { formatFigure, type RoiResults } from '@/lib/analysis/roi'
import type { AnalysisAnswers } from '@/lib/types'

/**
 * The model call. Server-side only — ANTHROPIC_API_KEY is read here and never
 * reaches the browser.
 *
 * Two rules shape everything below. The model returns *structure*, never prose
 * we have to parse. And it never returns a number: money ranges come from
 * config via the complexity band it picks, and ROI arithmetic already happened
 * in lib/analysis/roi.ts before this is called.
 */

export const ANALYSIS_MODEL = 'claude-sonnet-5-5'

/**
 * Low to start. The site runs on a Vercel Hobby function, so the call has to
 * finish inside a tight window — and this is a judgement task on a short
 * document, not long-horizon agentic work. First thing to raise if the
 * assessments read shallow.
 */
export const ANALYSIS_EFFORT = 'low'

const OpportunitySchema = z.object({
  title: z.string().max(120),
  category: z.enum(OPPORTUNITY_CATEGORIES),
  problem: z.string().max(600),
  solution: z.string().max(600),
  impact: z.string().max(400),
  complexity: z.enum(COMPLEXITY_BANDS),
  existingSoftwarePossible: z.boolean(),
  customDevelopmentPotential: z.boolean(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  reasoning: z.string().max(600),
})

const AnalysisSchema = z.object({
  businessSummary: z.string().max(900),
  technologyEnvironment: z.string().max(900),
  overallAssessment: z.string().max(1200),
  recommendedNextStep: z.string().max(600),
  opportunities: z.array(OpportunitySchema).min(1).max(ANALYSIS_LIMITS.maxOpportunities),
})

export type AnalysisPayload = z.infer<typeof AnalysisSchema>
export type AnalysisOpportunity = z.infer<typeof OpportunitySchema>

const SYSTEM = `You are a technology advisor for TCC Solutions Group (TCCSG), a firm that becomes the technology department for small businesses that cannot keep up with technology themselves.

You are reading a business owner's own description of how their business runs. Your job is to identify where technology could genuinely create leverage, and to be straight with them about it.

WHAT MAKES THIS USEFUL RATHER THAN SALES COPY

You are explicitly allowed — and expected — to conclude any of these when they are true:
- the business does not need custom software
- the software they already pay for is sufficient, and the problem is that nobody has configured it
- a simple automation solves it
- a change to how they work would help more than any software
- an off-the-shelf third-party tool is the better answer
- you do not have enough information to recommend anything yet

TCCSG sells development. That is exactly why recommending it when it is not warranted destroys the value of this assessment. Set "existingSoftwarePossible" to true whenever an existing product plausibly covers the need, even if that means TCCSG builds nothing.

HOW TO WRITE

Write to a business owner, not a developer. Plain English. Concrete and specific to what they actually told you — quote their own words back where it helps. No jargon, no "AI-powered", "cutting-edge", "digital transformation", "revolutionary", or "seamless". Do not flatter the business. Do not create urgency.

Identify between ${ANALYSIS_LIMITS.minOpportunities} and ${ANALYSIS_LIMITS.maxOpportunities} opportunities, ordered most important first. Fewer, well-reasoned opportunities beat a long list. If they described only one real problem, return one or two — do not pad.

COMPLEXITY BANDS

Pick the band by the work involved, not by what you think it is worth:
- QUICK_WIN: configuration, a small automation, connecting two tools that already have an integration. Days.
- WORKFLOW: a system or a connected workflow spanning several steps or tools. Weeks.
- CUSTOM: software built around how this specific business works. Months.

NUMBERS

Never state a price, a cost, a saving, a percentage, or a timeframe in money terms. Financial figures are calculated by the application from numbers the owner supplied and are shown separately. If ROI figures are given to you below, you may refer to them in your assessment, but never invent, adjust or extrapolate from them. If they are absent, say nothing about money at all.`

function renderAnswers(answers: AnalysisAnswers): string {
  const lines: string[] = []
  for (const section of QUESTIONNAIRE) {
    const answered = section.questions.filter((q) => {
      const v = answers[q.id]
      return v !== undefined && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== '')
    })
    if (answered.length === 0) continue

    lines.push(`## ${section.title}`)
    for (const q of answered) {
      const v = answers[q.id]
      lines.push(`${q.label}\n${Array.isArray(v) ? v.join(', ') : v}\n`)
    }
  }
  return lines.join('\n')
}

function renderRoi(roi: RoiResults): string {
  if (!roi.anyAvailable) {
    return 'The owner did not supply enough numbers to calculate anything. Do not refer to money, savings or value in figures anywhere in your response.'
  }

  const lines = ['These figures were calculated by the application. Treat them as fact. Do not recalculate, adjust or extrapolate from them.']
  for (const f of roi.figures) {
    if (!f.available) continue
    lines.push(`- ${f.label}: ${formatFigure(f)} (${f.formula})`)
  }
  return lines.join('\n')
}

export type AnalysisOutcome =
  | { ok: true; payload: AnalysisPayload; inputTokens: number; outputTokens: number }
  | { ok: false; reason: string }

export async function runAnalysis(
  answers: AnalysisAnswers,
  roi: RoiResults,
): Promise<AnalysisOutcome> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: 'ANTHROPIC_API_KEY is not set' }
  }

  const client = new Anthropic()

  const userContent = `A business owner completed TCCSG's technology questionnaire. Here is what they said.

${renderAnswers(answers)}

## Calculated figures

${renderRoi(roi)}

Assess this business.`

  try {
    const response = await client.messages.parse({
      model: ANALYSIS_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      output_config: {
        effort: ANALYSIS_EFFORT,
        format: zodOutputFormat(AnalysisSchema),
      },
    })

    // A safety decline returns HTTP 200 with no usable content. Check before
    // reading anything, or this surfaces as a confusing parse failure.
    if (response.stop_reason === 'refusal') {
      return { ok: false, reason: `declined: ${response.stop_details?.category ?? 'unspecified'}` }
    }
    if (response.stop_reason === 'max_tokens') {
      return { ok: false, reason: 'response was cut off before it finished' }
    }

    // Null when the output did not satisfy the schema. Storing a half-formed
    // report would be worse than failing loudly.
    if (!response.parsed_output) {
      return { ok: false, reason: 'the response did not match the expected structure' }
    }

    return {
      ok: true,
      payload: response.parsed_output,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { ok: false, reason: 'rate limited upstream' }
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, reason: 'the API key was rejected' }
    }
    if (e instanceof Anthropic.APIError) {
      return { ok: false, reason: `API error ${e.status}: ${e.message}` }
    }
    return { ok: false, reason: e instanceof Error ? e.message : 'unknown error' }
  }
}

/** The model picks a band; the money comes from config. */
export function rangeFor(complexity: AnalysisOpportunity['complexity']) {
  return IMPLEMENTATION_RANGES[complexity]
}
