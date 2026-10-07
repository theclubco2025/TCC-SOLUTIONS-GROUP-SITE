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
  // The prompt asks for short steps and few of them; these limits only catch
  // nonsense. See ANALYSIS_LIMITS.acceptOpportunities for why they are loose.
  today: z.array(z.string().max(160)).min(1).max(8),
  withIt: z.array(z.string().max(160)).min(1).max(8),
  questionsForCall: z.array(z.string().max(400)).min(1).max(5),
})

const AnalysisSchema = z.object({
  businessSummary: z.string().max(900),
  technologyEnvironment: z.string().max(900),
  overallAssessment: z.string().max(1200),
  recommendedNextStep: z.string().max(600),
  startToday: z.array(z.string().max(700)).min(1).max(4),
  opportunities: z.array(OpportunitySchema).min(1).max(ANALYSIS_LIMITS.acceptOpportunities),
})

export type AnalysisPayload = z.infer<typeof AnalysisSchema>
export type AnalysisOpportunity = z.infer<typeof OpportunitySchema>

const SYSTEM = `You are a technology advisor at TCC Solutions Group (TCCSG). TCCSG becomes the technology department for small businesses: it builds software around how a business actually works, and connects the tools a business already pays for so they work as one.

You are reading a business owner's own description of how their business runs. You are writing their report. When they finish reading it, they should feel they have finally found the fix for the things that have been wearing them down.

WHO YOU ARE TALKING TO

Write directly to the owner, in the second person, every time: "you", "your team", "your customers". Never "the business", "the owner", "they" or "this company". This is a letter to them about their business, not a file about it.

WHAT TCCSG BELIEVES, AND WHAT TO RECOMMEND

- Software built around how a business works is often cheaper over time than stacking subscriptions that each do part of the job, and it does exactly what the business needs instead of making the business bend to the tool.
- Where the owner already has tools, the win is usually connecting them so information moves on its own instead of being typed twice.

So: when the answer is a custom system or an integration, say so plainly and with conviction, and describe what it would do for them day to day. When a product they already have, or a well-known off-the-shelf tool, would do the job, still frame it as something TCCSG sets up and connects for them. Never send them away to sort it out alone. If part of the problem is a habit rather than software, say so in a sentence and move on to what would be built or connected.

Set "existingSoftwarePossible" to true when it works with or builds on software they already have or a known product. Set "customDevelopmentPotential" to true when a system built around them would serve them better than any product.

HOW TO WRITE

- Confident and decisive. Name the problem, name the fix, say what changes for them. Do not stack hedges ("may", "might", "could potentially"). One qualifier where it is genuinely needed is fine.
- Specific to what they told you. Quote their own words back where it lands.
- Plain English for a business owner. No jargon. Avoid empty hype words: "AI-powered", "cutting-edge", "digital transformation", "revolutionary", "seamless", "game-changer", "leverage". The report should feel transformative because of what it says, not because of its adjectives.
- No flattery, no fear, no false urgency. Energy comes from showing them what their day looks like once this is fixed.

THE FIELDS

- businessSummary: two or three sentences that show them you understood how their business really runs and what it is costing them in time and attention. Second person.
- technologyEnvironment: what they are working with today, and where it is letting them down. Second person.
- overallAssessment: the bottom line. The single biggest thing holding them back, and what changes when it is fixed. Bold and direct. This is the line they will remember.
- recommendedNextStep: one concrete next step, addressed to them, that leads to a conversation with TCCSG about building or connecting it.
- startToday: one or two things they can do themselves this week, free, with what they already have or a change in habit. Genuinely useful, concrete, addressed to them. This is help with no strings attached. Do not claim a specific product has a specific feature unless it is widely known; when unsure, phrase it as something to check ("see whether your booking tool can send reminders").
- opportunities: these are PROPOSALS, starting points that TCCSG will shape with them in a conversation. Each one:
  - title: what we would build or connect, in their terms.
  - problem: the problem in their own terms.
  - solution: what TCCSG would build or connect, and what it does for them.
  - impact: a day with it. What their Monday looks like once it is running.
  - reasoning: why this one, in a sentence.
  - today: their current process for this problem as two to five short steps, in their words ("Customer calls", "Order written on a pad", "Typed into the till"). Six words or fewer each.
  - withIt: the same process once it is fixed, two to five short steps, six words or fewer each. It should visibly have fewer manual steps.
  - questionsForCall: one to three specific questions TCCSG would need answered to shape this into exactly what they need. Show you are already thinking about their business ("Do catering orders follow the same path as walk-in orders?"). Never generic ("What is your budget?").

Give ${ANALYSIS_LIMITS.minOpportunities} or ${ANALYSIS_LIMITS.maxOpportunities} proposals, the biggest win first. Where their answers support it, make them different routes rather than three versions of one idea: for example one that connects what they already have, one built around how they work, and one quick win they could have running soon. Do not pad; two strong proposals beat three thin ones.

COMPLEXITY BANDS

Pick the band by the work involved:
- QUICK_WIN: configuration, a small automation, connecting two tools that already have an integration.
- WORKFLOW: a system or a connected workflow spanning several steps or tools.
- CUSTOM: software built around how this specific business works.

NUMBERS

Never state a price, a cost, a saving, a percentage, a time saved, or a timeframe. Figures are calculated by the application from numbers the owner supplied and are shown separately. If calculated figures are given to you below, you may refer to them exactly as given, but never invent, adjust or extrapolate from them. If they are absent, say nothing about money or hours in figures at all.`

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

  const userContent = `A business owner completed TCCSG's technology questionnaire. Here is what they said, in their own words.

${renderAnswers(answers)}

## Calculated figures

${renderRoi(roi)}

Write their report, speaking directly to them.`

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
