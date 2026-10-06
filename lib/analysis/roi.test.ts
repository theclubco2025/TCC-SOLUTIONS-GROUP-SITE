import { describe, expect, it } from 'vitest'
import { calculateRoi, formatFigure, normaliseRoiInputs } from '@/lib/analysis/roi'
import { ROI_ASSUMPTIONS } from '@/lib/analysis/config'

const figure = (inputs: Parameters<typeof calculateRoi>[0], id: string) =>
  calculateRoi(inputs).figures.find((f) => f.id === id)!

describe('labour', () => {
  it('multiplies hours by people by rate by weeks', () => {
    const f = figure({ hoursPerWeek: 10, peopleInvolved: 2, hourlyValue: 25 }, 'labour')
    expect(f.available).toBe(true)
    expect(f.value).toBe(10 * 2 * 25 * 52) // 26000
  })

  it('reproduces the worked example from the brief', () => {
    const f = figure({ hoursPerWeek: 10, peopleInvolved: 1, hourlyValue: 25 }, 'labour')
    expect(f.value).toBe(13000)
  })

  it('assumes one person, and says so, when not told', () => {
    const f = figure({ hoursPerWeek: 10, hourlyValue: 25 }, 'labour')
    expect(f.value).toBe(13000)
    expect(f.assumptions.join(' ')).toContain('one person')
  })

  it('refuses to estimate without an hourly cost, and names what is missing', () => {
    const f = figure({ hoursPerWeek: 10 }, 'labour')
    expect(f.available).toBe(false)
    expect(f.value).toBeUndefined()
    expect(f.missing).toContain('the cost of an hour of that time')
  })
})

describe('time recovered', () => {
  it('applies the recovery rate rather than claiming every hour back', () => {
    const f = figure({ hoursPerWeek: 10, peopleInvolved: 1 }, 'time')
    expect(f.value).toBe(10 * 52 * ROI_ASSUMPTIONS.recoveryRate)
    expect(f.value).toBeLessThan(10 * 52)
  })
})

describe('revenue', () => {
  it('values only the uplift, not the whole book', () => {
    const f = figure(
      { monthlyLeads: 100, conversionRate: 20, averageCustomerValue: 500 },
      'revenue',
    )
    // 1200 leads a year × 2 points × $500
    expect(f.value).toBe(1200 * 0.02 * 500)
    expect(f.inputs.improvedConversionRate).toBe(22)
  })

  it('needs all three inputs — partial data produces no number', () => {
    const f = figure({ monthlyLeads: 100, averageCustomerValue: 500 }, 'revenue')
    expect(f.available).toBe(false)
    expect(f.missing).toContain('the percentage that become customers')
  })

  it('labels the uplift as an assumption, not a forecast', () => {
    const f = figure(
      { monthlyLeads: 100, conversionRate: 20, averageCustomerValue: 500 },
      'revenue',
    )
    expect(f.assumptions.join(' ')).toContain('not a forecast')
  })
})

describe('headline', () => {
  it('takes the largest single figure and never sums them', () => {
    const r = calculateRoi({
      hoursPerWeek: 10,
      peopleInvolved: 1,
      hourlyValue: 25, // labour = 13000
      monthlyLeads: 100,
      conversionRate: 20,
      averageCustomerValue: 500, // revenue = 12000
    })
    expect(r.headline?.value).toBe(13000)
    expect(r.headline?.value).not.toBe(25000)
  })

  it('is null when nothing can be calculated', () => {
    const r = calculateRoi({})
    expect(r.headline).toBeNull()
    expect(r.anyAvailable).toBe(false)
    expect(r.figures.every((f) => !f.available)).toBe(true)
  })

  it('survives no input at all', () => {
    expect(calculateRoi(null).headline).toBeNull()
    expect(calculateRoi(undefined).anyAvailable).toBe(false)
  })
})

describe('formatting', () => {
  it('never renders a number for an unavailable figure', () => {
    expect(formatFigure(figure({}, 'labour'))).toBe('Not enough information')
  })

  it('formats money without stray decimals', () => {
    expect(formatFigure(figure({ hoursPerWeek: 10, hourlyValue: 25 }, 'labour'))).toBe('$13,000')
  })
})

describe('the live calculator and the report agree', () => {
  it('reads the text a number box produces the same way the server does', () => {
    // The numbers step runs normaliseRoiInputs on what is typed, so the figure
    // shown while typing is the figure the report will show.
    const typed = normaliseRoiInputs({ hoursPerWeek: '10', hourlyValue: '35', peopleInvolved: '' })
    expect(typed).toEqual({ hoursPerWeek: 10, hourlyValue: 35 })
    expect(calculateRoi(typed).headline?.value).toBe(10 * 35 * 52)
  })

  it('drops an out-of-range number while typing, as the server will', () => {
    expect(normaliseRoiInputs({ conversionRate: '140' })).toEqual({})
  })
})
