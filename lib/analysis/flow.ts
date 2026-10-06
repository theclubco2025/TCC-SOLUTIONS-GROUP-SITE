import { ALL_QUESTIONS, FLOW, type FlowStep, type Question } from '@/lib/analysis/config'
import type { AnalysisAnswers } from '@/lib/types'

/**
 * The logic behind the one-question-at-a-time questionnaire, kept out of the
 * component so it can be tested. None of this changes what is stored: the
 * answers object is the same shape the server already validates.
 */

const BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]))

export function questionById(id: string): Question {
  const q = BY_ID.get(id)
  if (!q) throw new Error(`flow references unknown question "${id}"`)
  return q
}

export function stepQuestions(step: FlowStep): Question[] {
  return step.questions.map(questionById)
}

export function isAnswered(value: string | string[] | undefined): boolean {
  if (value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  return value.trim() !== ''
}

/** Required questions on this step that are still empty. */
export function missingOnStep(step: FlowStep, answers: AnalysisAnswers): Question[] {
  return stepQuestions(step).filter((q) => q.required && !isAnswered(answers[q.id]))
}

/** The first step anywhere in the flow with a required answer missing, or -1. */
export function firstStepMissingRequired(answers: AnalysisAnswers): number {
  return FLOW.findIndex((step) => missingOnStep(step, answers).length > 0)
}

/**
 * Where to put someone who comes back. Just after the furthest step they
 * answered anything on, so a returning visitor picks up where they left off
 * rather than being walked through answers they already gave.
 */
export function resumeStep(answers: AnalysisAnswers): number {
  let furthest = -1
  FLOW.forEach((step, i) => {
    if (step.questions.some((id) => isAnswered(answers[id]))) furthest = i
  })
  return Math.min(furthest + 1, FLOW.length - 1)
}

/** A rough, honest time remaining. Taps are quick; typing is not. */
export function minutesLeft(fromStep: number): number {
  let seconds = 0
  for (let i = fromStep; i < FLOW.length; i++) {
    const typing = stepQuestions(FLOW[i]).some((q) => q.type === 'textarea' || q.type === 'text')
    seconds += typing ? 25 : 8
  }
  return Math.max(1, Math.round(seconds / 60))
}

const DEFAULT_SEPARATOR = '. '

function tokens(text: string, separator: string): string[] {
  const sep = separator.trim()
  return text
    .split(sep)
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Is this suggestion already in the text box? Drives the chip's pressed state. */
export function hasSuggestion(text: string, suggestion: string, separator = DEFAULT_SEPARATOR): boolean {
  return tokens(text, separator).some((t) => t.toLowerCase() === suggestion.toLowerCase())
}

/**
 * Tapping a suggestion adds it; tapping it again takes it back out. Anything the
 * visitor typed themselves is left alone. The result is still plain text they
 * can edit, and it never exceeds the question's length limit.
 */
export function toggleSuggestion(
  text: string,
  suggestion: string,
  separator = DEFAULT_SEPARATOR,
  maxLength = 1500,
): string {
  const sep = separator.trim()
  const joiner = sep + ' '
  const current = tokens(text, separator)
  const has = current.some((t) => t.toLowerCase() === suggestion.toLowerCase())
  const next = has
    ? current.filter((t) => t.toLowerCase() !== suggestion.toLowerCase())
    : [...current, suggestion]
  return next.join(joiner).slice(0, maxLength)
}
