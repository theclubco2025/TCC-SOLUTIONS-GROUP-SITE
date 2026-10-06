import { describe, expect, it } from 'vitest'
import { ALL_QUESTIONS, FLOW, QUESTIONNAIRE_VERSION } from '@/lib/analysis/config'
import {
  firstStepMissingRequired,
  hasSuggestion,
  isAnswered,
  minutesLeft,
  missingOnStep,
  resumeStep,
  toggleSuggestion,
} from '@/lib/analysis/flow'
import { normaliseAnswers, validateAnswers } from '@/lib/analysis/sessions'

describe('the flow covers the questionnaire', () => {
  it('shows every question exactly once', () => {
    // A required question left out of the flow could never be answered, and
    // completion would be refused forever with no way for the visitor to fix it.
    const shown = FLOW.flatMap((s) => s.questions).sort()
    const defined = ALL_QUESTIONS.map((q) => q.id).sort()
    expect(shown).toEqual(defined)
  })

  it('references only questions that exist', () => {
    const ids = new Set(ALL_QUESTIONS.map((q) => q.id))
    for (const step of FLOW) for (const id of step.questions) expect(ids.has(id)).toBe(true)
  })

  it('opens with a tap, not typing', () => {
    const first = ALL_QUESTIONS.find((q) => q.id === FLOW[0].questions[0])!
    expect(['select', 'multiselect']).toContain(first.type)
  })

  it('gives a heading to every step that asks more than one thing', () => {
    // A single question is its own heading; two need one that covers both.
    for (const step of FLOW) if (step.questions.length > 1) expect(step.title).toBeTruthy()
  })

  it('asks for the business name last', () => {
    expect(FLOW[FLOW.length - 1].questions).toContain('businessName')
  })

  it('did not change the stored data, so the version did not need bumping', () => {
    // Suggestions only write into text boxes. If this fails because a question
    // id or type changed, QUESTIONNAIRE_VERSION must be bumped too.
    expect(QUESTIONNAIRE_VERSION).toBe(1)
    expect(ALL_QUESTIONS.map((q) => `${q.id}:${q.type}`)).toMatchSnapshot()
  })
})

describe('suggestions stay plain text the server accepts', () => {
  it('a suggestion-filled answer passes normalisation untouched', () => {
    const text = toggleSuggestion('', 'Chasing invoices, deposits or payments')
    const out = normaliseAnswers({ repetitiveWork: text })
    expect(out.repetitiveWork).toBe('Chasing invoices, deposits or payments')
  })

  it('every suggestion fits inside its question’s length limit', () => {
    for (const q of ALL_QUESTIONS) {
      if (!q.suggestions) continue
      let all = ''
      for (const s of q.suggestions) all = toggleSuggestion(all, s, q.suggestionSeparator, q.maxLength)
      expect(all.length).toBeLessThanOrEqual(q.maxLength ?? 1500)
    }
  })

  it('only free-text questions carry suggestions', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.suggestions) expect(['text', 'textarea']).toContain(q.type)
    }
  })
})

describe('toggleSuggestion', () => {
  it('adds, then removes on a second tap', () => {
    const once = toggleSuggestion('', 'Paperwork and admin')
    expect(once).toBe('Paperwork and admin')
    expect(toggleSuggestion(once, 'Paperwork and admin')).toBe('')
  })

  it('appends after what the visitor typed, and keeps their words', () => {
    const out = toggleSuggestion('Mostly the phone', 'Chasing payments')
    expect(out).toBe('Mostly the phone. Chasing payments')
    expect(toggleSuggestion(out, 'Chasing payments')).toBe('Mostly the phone')
  })

  it('uses commas for tool lists', () => {
    const out = toggleSuggestion(toggleSuggestion('', 'Square', ', '), 'QuickBooks', ', ')
    expect(out).toBe('Square, QuickBooks')
    expect(hasSuggestion(out, 'quickbooks', ', ')).toBe(true)
  })

  it('never exceeds the length limit', () => {
    expect(toggleSuggestion('x'.repeat(1499), 'Chasing payments', '. ', 1500)).toHaveLength(1500)
  })
})

describe('progress and resume', () => {
  it('starts a new visitor at the beginning', () => {
    expect(resumeStep({})).toBe(0)
  })

  it('puts a returning visitor just after the furthest step they answered', () => {
    expect(resumeStep({ industry: 'Retail', improvementGoals: ['Save time'] })).toBe(3)
  })

  it('never resumes past the last step', () => {
    expect(resumeStep({ businessName: 'X' })).toBe(FLOW.length - 1)
  })

  it('finds the first step still missing a required answer', () => {
    const repetitiveIndex = FLOW.findIndex((s) => s.questions.includes('repetitiveWork'))
    expect(firstStepMissingRequired({ industry: 'Retail' })).toBe(repetitiveIndex)
    expect(missingOnStep(FLOW[repetitiveIndex], {})).toHaveLength(1)
  })

  it('agrees with the server about what "complete" means', () => {
    const answers = {
      industry: 'Retail',
      repetitiveWork: 'x',
      oneThingToEliminate: 'y',
      businessName: 'Z',
    }
    expect(firstStepMissingRequired(answers)).toBe(-1)
    expect(validateAnswers(answers)).toEqual([])
  })

  it('treats whitespace and empty lists as unanswered', () => {
    expect(isAnswered('  ')).toBe(false)
    expect(isAnswered([])).toBe(false)
    expect(isAnswered(['a'])).toBe(true)
  })

  it('estimates a short, finite time', () => {
    expect(minutesLeft(0)).toBeGreaterThanOrEqual(1)
    expect(minutesLeft(0)).toBeLessThanOrEqual(5)
    expect(minutesLeft(FLOW.length - 1)).toBe(1)
  })
})
