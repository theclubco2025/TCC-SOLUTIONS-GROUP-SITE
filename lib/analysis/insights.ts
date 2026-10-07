import type { Question } from '@/lib/analysis/config'
import { guideFor } from '@/lib/analysis/industries'
import { formatCurrency, formatFigure, type RoiResults } from '@/lib/analysis/roi'
import type { AnalysisAnswers } from '@/lib/types'

/**
 * What the visitor gets back while they answer, before any model is called:
 * a running list of what we are noticing, a short note after the answers that
 * say the most, suggestions in their industry's terms, and the lines the
 * waiting screen prints. All of it is rules over their own answers, so it is
 * instant, free, and says nothing they did not tell us.
 *
 * No statistics and no claims about specific products (insights.test.ts checks
 * for digits): this is the visitor's own picture, reflected back.
 */

const NO_SOFTWARE = 'Nothing — it is all in software'

function text(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v.trim() : ''
}

function list(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : []
}

/** Splits a text answer the way tap-to-fill joins it. */
function parts(v: string | string[] | undefined, separator = '.'): string[] {
  return text(v)
    .split(separator)
    .map((p) => p.trim())
    .filter(Boolean)
}

function clip(s: string, max = 72): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

// ---------------------------------------------------------------------------

const firstWord = (s: string) => s.toLowerCase().split(/\s+/)[0]

/**
 * Their industry's suggestions first, then the general ones. A general one is
 * dropped when an industry one already covers it ("Chasing invoices and
 * deposits" makes "Chasing invoices, deposits or payments" a repeat), judged by
 * the opening verb, which is how these are written.
 */
export function suggestionsFor(q: Question, answers: AnalysisAnswers): string[] | undefined {
  if (!q.suggestions) return undefined
  if (q.id !== 'repetitiveWork') return q.suggestions
  const tailored = guideFor(answers.industry).repetitive
  const covered = new Set(tailored.map(firstWord))
  const general = q.suggestions.filter((s) => !covered.has(firstWord(s)))
  return [...tailored, ...general].slice(0, 9)
}

// ---------------------------------------------------------------------------

export type Noticing = { label: string; text: string }

/** The picture forming as they answer, in their own words. */
export function noticings(answers: AnalysisAnswers): Noticing[] {
  const out: Noticing[] = []

  for (const p of parts(answers.repetitiveWork).slice(0, 3)) {
    out.push({ label: 'by hand', text: clip(p) })
  }
  for (const p of parts(answers.manualTransfer).slice(0, 2)) {
    out.push({ label: 'typed twice', text: clip(p) })
  }
  const offline = list(answers.manualTools).filter((t) => t !== NO_SOFTWARE)
  if (offline.length > 0) {
    out.push({ label: 'outside software', text: clip(offline.join(', ').toLowerCase()) })
  }
  for (const p of parts(answers.customerFriction).slice(0, 2)) {
    out.push({ label: 'customers wait', text: clip(p) })
  }
  const tools = parts(answers.currentSoftware, ',')
  if (tools.length > 0) {
    out.push({ label: 'your tools', text: clip(tools.join(', ')) })
  }
  const connected: Record<string, string> = {
    'Not at all — everything is separate': 'none of them talk to each other',
    'A couple are connected, most are not': 'most of them work alone',
    'I honestly do not know': 'unknown, so we will check',
  }
  const link = connected[text(answers.systemsConnected)]
  if (link) out.push({ label: 'connected', text: link })
  const first = text(answers.oneThingToEliminate)
  if (first) out.push({ label: 'first to go', text: clip(first) })

  return out
}

/** How many of those are things a system could take off their hands. */
export function fixableCount(answers: AnalysisAnswers): number {
  const fixable = new Set(['by hand', 'typed twice', 'outside software', 'customers wait'])
  return noticings(answers).filter((n) => fixable.has(n.label)).length
}

// ---------------------------------------------------------------------------

/**
 * A line of real help after the answers that say the most. Written as what is
 * generally true and what we will check, never as a promise about a product.
 */
export function noteFor(questionId: string, answers: AnalysisAnswers): string | null {
  switch (questionId) {
    case 'employees':
      return text(answers.employees) === 'Just me'
        ? 'Then every hour a system takes off your plate is an hour of yours back.'
        : null

    case 'repetitiveWork':
      return text(answers.repetitiveWork)
        ? 'This is the answer your report is built around. Everything else adds detail to it.'
        : null

    case 'manualTools': {
      const tools = list(answers.manualTools)
      if (tools.length === 0) return null
      if (tools.includes(NO_SOFTWARE)) {
        return 'Good. Then the question is whether those tools share information, which comes up shortly.'
      }
      if (tools.includes('Text messages') || tools.includes('Email threads')) {
        return 'Work that lives in texts and email threads slips when someone is busy or away. A shared place for it fixes that without changing how customers reach you.'
      }
      if (tools.includes('Spreadsheets')) {
        return 'A spreadsheet doing a real job is a sign the process has outgrown its tools. It is also a gift: it shows exactly what a proper system needs to do.'
      }
      return 'Paper and whiteboards work until someone is off or the business grows. The same information on a screen your whole team sees keeps working when you are not in the room.'
    }

    case 'currentSoftware':
      return parts(answers.currentSoftware, ',').length >= 2
        ? 'Tools like these often have connections built in that nobody has switched on. We will check yours.'
        : null

    case 'systemsConnected': {
      const notes: Record<string, string> = {
        'Not at all — everything is separate':
          'This is very fixable. When tools share information, something entered once shows up everywhere it is needed, and nobody retypes it.',
        'A couple are connected, most are not':
          'You have already started. The gaps between the rest are usually where the retyping happens.',
        'Mostly connected': 'Then the wins are likely in the steps people still do between them.',
        'I honestly do not know': 'That is fine. It is one of the first things we will check for you.',
      }
      return notes[text(answers.systemsConnected)] ?? null
    }

    default:
      return null
  }
}

// ---------------------------------------------------------------------------

/**
 * What the waiting screen prints. Built from their answers and their own
 * numbers, so they watch their report being put together from what they said.
 */
export function terminalLines(answers: AnalysisAnswers, roi: RoiResults | null): string[] {
  const lines: string[] = []

  const industry = text(answers.industry)
  lines.push(
    industry && industry !== 'Something else'
      ? `reading your answers: ${industry.toLowerCase()}`
      : 'reading your answers',
  )

  const n = fixableCount(answers)
  lines.push(n > 0 ? `found ${n} thing${n === 1 ? '' : 's'} done by hand` : 'mapping how your day runs')

  const tools = parts(answers.currentSoftware, ',').slice(0, 3)
  if (tools.length > 0) {
    const none = text(answers.systemsConnected) === 'Not at all — everything is separate'
    lines.push(`checking ${tools.join(', ')}${none ? ': not connected' : ''}`)
  } else {
    lines.push('checking the software you already have')
  }

  if (roi?.headline) {
    lines.push(`your numbers: ${formatCurrency(roi.headline.value)} a year on repeated work`)
  } else {
    const hours = roi?.figures.find((f) => f.id === 'time' && f.available)
    lines.push(hours ? `your numbers: ${formatFigure(hours)} a year to win back` : 'matching each problem to a fix')
  }

  lines.push('shaping your proposals')
  return lines.map((l) => clip(l, 64))
}
