import { describe, expect, it } from 'vitest'
import { ALL_QUESTIONS } from '@/lib/analysis/config'
import { toggleSuggestion } from '@/lib/analysis/flow'
import { GENERAL_GUIDE, INDUSTRY_GUIDE, guideFor } from '@/lib/analysis/industries'
import { fixableCount, noteFor, noticings, suggestionsFor, terminalLines } from '@/lib/analysis/insights'
import { calculateRoi } from '@/lib/analysis/roi'
import type { AnalysisAnswers } from '@/lib/types'

const industryQ = ALL_QUESTIONS.find((q) => q.id === 'industry')!
const repetitiveQ = ALL_QUESTIONS.find((q) => q.id === 'repetitiveWork')!

describe('industry guide', () => {
  it('covers every industry a visitor can pick', () => {
    for (const option of industryQ.options!) expect(INDUSTRY_GUIDE[option]).toBeDefined()
  })

  it('gives three leaks for each, every one with a fix', () => {
    for (const guide of Object.values(INDUSTRY_GUIDE)) {
      expect(guide.leaks).toHaveLength(3)
      for (const l of guide.leaks) {
        expect(l.problem.length).toBeGreaterThan(0)
        expect(l.fix.length).toBeGreaterThan(0)
      }
    }
  })

  it('contains no statistics', () => {
    // The site makes no numeric claims it cannot source. A digit or percent sign
    // in this content is almost certainly one.
    const all = JSON.stringify(INDUSTRY_GUIDE)
    expect(all).not.toMatch(/[0-9%]/)
  })

  it('falls back to the general guide', () => {
    expect(guideFor('Not a real industry')).toBe(GENERAL_GUIDE)
    expect(guideFor(undefined)).toBe(GENERAL_GUIDE)
  })
})

describe('tailored suggestions', () => {
  it('puts the industry first and keeps the general ones', () => {
    const s = suggestionsFor(repetitiveQ, { industry: 'Trades and construction' })!
    expect(s[0]).toBe('Writing up quotes after site visits')
    expect(s).toContain('Following up with enquiries')
  })

  it('drops a general suggestion the industry one already covers', () => {
    const s = suggestionsFor(repetitiveQ, { industry: 'Trades and construction' })!
    expect(s).toContain('Chasing invoices and deposits')
    expect(s).not.toContain('Chasing invoices, deposits or payments')
  })

  it('is the general list when no industry is picked', () => {
    expect(suggestionsFor(repetitiveQ, {})).toEqual(repetitiveQ.suggestions)
  })

  it('every industry set still fits the answer box when all are tapped', () => {
    for (const industry of industryQ.options!) {
      let all = ''
      for (const s of suggestionsFor(repetitiveQ, { industry })!) {
        all = toggleSuggestion(all, s, repetitiveQ.suggestionSeparator, repetitiveQ.maxLength)
      }
      expect(all.length).toBeLessThanOrEqual(repetitiveQ.maxLength ?? 1500)
    }
  })
})

describe('what we are noticing', () => {
  const answers = {
    industry: 'Restaurant, café or bar',
    repetitiveWork: 'Taking orders over the phone. Chasing invoices, deposits or payments',
    manualTools: ['Spreadsheets', 'Text messages'],
    currentSoftware: 'Square, QuickBooks',
    systemsConnected: 'Not at all — everything is separate',
    oneThingToEliminate: 'Paperwork and admin',
  }

  it('reflects their own answers back', () => {
    const n = noticings(answers)
    expect(n).toContainEqual({ label: 'by hand', text: 'Taking orders over the phone' })
    expect(n).toContainEqual({ label: 'outside software', text: 'spreadsheets, text messages' })
    expect(n).toContainEqual({ label: 'connected', text: 'none of them talk to each other' })
    expect(n).toContainEqual({ label: 'first to go', text: 'Paperwork and admin' })
  })

  it('counts what a system could take off their hands', () => {
    expect(fixableCount(answers)).toBe(3)
  })

  it('is empty before they have said anything', () => {
    expect(noticings({})).toEqual([])
  })

  it('does not count "all in software" as a problem', () => {
    expect(noticings({ manualTools: ['Nothing — it is all in software'] })).toEqual([])
  })
})

describe('notes after an answer', () => {
  it('appear only once there is an answer to respond to', () => {
    expect(noteFor('systemsConnected', {})).toBeNull()
    expect(noteFor('systemsConnected', { systemsConnected: 'Not at all — everything is separate' })).toBeTruthy()
  })

  it('make no numeric claims', () => {
    const cases: AnalysisAnswers[] = [
      { employees: 'Just me' },
      { repetitiveWork: 'x' },
      { manualTools: ['Text messages'] },
      { manualTools: ['Spreadsheets'] },
      { manualTools: ['Paper or printouts'] },
      { manualTools: ['Nothing — it is all in software'] },
      { currentSoftware: 'A, B' },
      ...['Not at all — everything is separate', 'A couple are connected, most are not', 'Mostly connected', 'I honestly do not know'].map(
        (systemsConnected) => ({ systemsConnected }),
      ),
    ]
    for (const answers of cases) {
      for (const q of ALL_QUESTIONS) {
        const note = noteFor(q.id, answers)
        if (note) expect(note).not.toMatch(/[0-9%]/)
      }
    }
  })
})

describe('the waiting screen', () => {
  it('prints their specifics and their own number', () => {
    const lines = terminalLines(
      {
        industry: 'Retail',
        repetitiveWork: 'Counting and re-ordering stock',
        currentSoftware: 'Shopify, Square',
        systemsConnected: 'Not at all — everything is separate',
      },
      calculateRoi({ hoursPerWeek: 10, peopleInvolved: 2, hourlyValue: 35 }),
    )
    expect(lines[0]).toBe('reading your answers: retail')
    expect(lines[1]).toBe('found 1 thing done by hand')
    expect(lines[2]).toBe('checking Shopify, Square: not connected')
    expect(lines[3]).toBe('your numbers: $36,400 a year on repeated work')
  })

  it('never invents a number when none were given', () => {
    const lines = terminalLines({}, calculateRoi({}))
    expect(lines.join(' ')).not.toMatch(/\$/)
  })

  it('keeps every line short enough for one row', () => {
    const lines = terminalLines({ currentSoftware: 'x'.repeat(200) }, null)
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(64)
  })
})
