import { ROI_ASSUMPTIONS } from '@/lib/analysis/config'
import type { RoiInputs } from '@/lib/types'

/**
 * Every number in the report is produced here, in application code, from
 * numbers the visitor typed. The model never does arithmetic — it is given
 * these figures as fact and may explain them.
 *
 * The rule that matters: when the inputs are not there, this returns a figure
 * marked unavailable with the missing fields named. It never estimates, never
 * substitutes a plausible default, and never rounds a guess into a fact. A
 * business owner who is shown an invented number and later works out it was
 * invented has learned something true about the company that showed it.
 */

export type RoiFigure = {
  id: string
  label: string
  unit: 'currency' | 'hours'
  available: boolean
  /** Present only when `available`. */
  value?: number
  /** The exact inputs used, so the reader can check the arithmetic. */
  inputs: Record<string, number>
  /** Stated in the report next to the number, never hidden. */
  assumptions: string[]
  formula: string
  /** Human-readable names of what was missing, when unavailable. */
  missing: string[]
}

export type RoiResults = {
  figures: RoiFigure[]
  /** The largest single figure we can stand behind, or null. */
  headline: { id: string; label: string; value: number } | null
  anyAvailable: boolean
}

const NAMES: Record<string, string> = {
  hoursPerWeek: 'hours per week on repetitive work',
  peopleInvolved: 'how many people are involved',
  hourlyValue: 'the cost of an hour of that time',
  monthlyLeads: 'enquiries per month',
  conversionRate: 'the percentage that become customers',
  averageCustomerValue: 'what an average customer is worth',
}

function has(inputs: RoiInputs, key: string): boolean {
  return typeof inputs[key] === 'number' && Number.isFinite(inputs[key])
}

function missingOf(inputs: RoiInputs, required: string[]): string[] {
  return required.filter((k) => !has(inputs, k)).map((k) => NAMES[k] ?? k)
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** Annual cost of the time currently going into repetitive work. */
function labourFigure(inputs: RoiInputs): RoiFigure {
  const required = ['hoursPerWeek', 'hourlyValue']
  const missing = missingOf(inputs, required)

  // People is the one input that carries a default, because "one person" is the
  // conservative reading and it is stated below rather than assumed silently.
  const people = has(inputs, 'peopleInvolved') ? inputs.peopleInvolved : 1
  const assumptions = [`${ROI_ASSUMPTIONS.weeksPerYear} working weeks in a year.`]
  if (!has(inputs, 'peopleInvolved')) {
    assumptions.push('Assumes one person is involved, since you did not say otherwise.')
  }

  if (missing.length > 0) {
    return {
      id: 'labour',
      label: 'Annual cost of that repetitive work',
      unit: 'currency',
      available: false,
      inputs: {},
      assumptions,
      formula: 'hours per week × people × hourly cost × 52',
      missing,
    }
  }

  const value = inputs.hoursPerWeek * people * inputs.hourlyValue * ROI_ASSUMPTIONS.weeksPerYear

  return {
    id: 'labour',
    label: 'Annual cost of that repetitive work',
    unit: 'currency',
    available: true,
    value: round(value),
    inputs: {
      hoursPerWeek: inputs.hoursPerWeek,
      peopleInvolved: people,
      hourlyValue: inputs.hourlyValue,
      weeksPerYear: ROI_ASSUMPTIONS.weeksPerYear,
    },
    assumptions,
    formula: `${inputs.hoursPerWeek} × ${people} × ${inputs.hourlyValue} × ${ROI_ASSUMPTIONS.weeksPerYear}`,
    missing: [],
  }
}

/** Hours a system could realistically give back — not all of them. */
function timeFigure(inputs: RoiInputs): RoiFigure {
  const missing = missingOf(inputs, ['hoursPerWeek'])
  const people = has(inputs, 'peopleInvolved') ? inputs.peopleInvolved : 1
  const assumptions = [
    `Assumes ${Math.round(ROI_ASSUMPTIONS.recoveryRate * 100)}% of that time is recoverable. Automation rarely removes all of it.`,
  ]

  if (missing.length > 0) {
    return {
      id: 'time',
      label: 'Hours a year that could come back',
      unit: 'hours',
      available: false,
      inputs: {},
      assumptions,
      formula: 'hours per week × people × 52 × recovery rate',
      missing,
    }
  }

  const value =
    inputs.hoursPerWeek * people * ROI_ASSUMPTIONS.weeksPerYear * ROI_ASSUMPTIONS.recoveryRate

  return {
    id: 'time',
    label: 'Hours a year that could come back',
    unit: 'hours',
    available: true,
    value: round(value),
    inputs: {
      hoursPerWeek: inputs.hoursPerWeek,
      peopleInvolved: people,
      weeksPerYear: ROI_ASSUMPTIONS.weeksPerYear,
      recoveryRate: ROI_ASSUMPTIONS.recoveryRate,
    },
    assumptions,
    formula: `${inputs.hoursPerWeek} × ${people} × ${ROI_ASSUMPTIONS.weeksPerYear} × ${ROI_ASSUMPTIONS.recoveryRate}`,
    missing: [],
  }
}

/** What a small conversion improvement would be worth. Illustrative, and labelled so. */
function revenueFigure(inputs: RoiInputs): RoiFigure {
  const required = ['monthlyLeads', 'conversionRate', 'averageCustomerValue']
  const missing = missingOf(inputs, required)
  const uplift = ROI_ASSUMPTIONS.conversionUpliftPoints
  const assumptions = [
    `Illustrates a ${uplift} percentage point improvement in conversion. This is an assumption for comparison, not a forecast.`,
  ]

  if (missing.length > 0) {
    return {
      id: 'revenue',
      label: 'What a small conversion improvement could be worth',
      unit: 'currency',
      available: false,
      inputs: {},
      assumptions,
      formula: 'enquiries a year × improvement in conversion × average customer value',
      missing,
    }
  }

  const annualLeads = inputs.monthlyLeads * 12
  const value = annualLeads * (uplift / 100) * inputs.averageCustomerValue

  return {
    id: 'revenue',
    label: 'What a small conversion improvement could be worth',
    unit: 'currency',
    available: true,
    value: round(value),
    inputs: {
      monthlyLeads: inputs.monthlyLeads,
      annualLeads,
      currentConversionRate: inputs.conversionRate,
      improvedConversionRate: inputs.conversionRate + uplift,
      averageCustomerValue: inputs.averageCustomerValue,
    },
    assumptions,
    formula: `${annualLeads} × ${uplift}% × ${inputs.averageCustomerValue}`,
    missing: [],
  }
}

export function calculateRoi(inputs: RoiInputs | null | undefined): RoiResults {
  const safe = inputs ?? {}
  const figures = [labourFigure(safe), timeFigure(safe), revenueFigure(safe)]

  // The headline is the largest single figure we can defend, not a total.
  // Adding labour cost to revenue upside would double-count the same problem.
  const money = figures.filter((f) => f.available && f.unit === 'currency')
  const best = money.reduce<RoiFigure | null>(
    (acc, f) => (acc === null || (f.value ?? 0) > (acc.value ?? 0) ? f : acc),
    null,
  )

  return {
    figures,
    headline: best ? { id: best.id, label: best.label, value: best.value ?? 0 } : null,
    anyAvailable: figures.some((f) => f.available),
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatFigure(figure: RoiFigure): string {
  if (!figure.available || figure.value === undefined) return 'Not enough information'
  if (figure.unit === 'hours') {
    return `${Math.round(figure.value).toLocaleString('en-US')} hours`
  }
  return formatCurrency(figure.value)
}
