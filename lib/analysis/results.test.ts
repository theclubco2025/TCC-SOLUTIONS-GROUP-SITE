import { describe, expect, it } from 'vitest'
import { asDetail } from '@/lib/analysis/results'

describe('reading a stored proposal', () => {
  it('drops blank entries (seen from the model in production)', () => {
    const d = asDetail({ today: ['a', ' '], withIt: ['b'], questions: [''] })
    expect(d).toEqual({ today: ['a'], withIt: ['b'], questions: [] })
  })

  it('reads a report from before proposals existed as no detail', () => {
    expect(asDetail(null)).toBeNull()
    expect(asDetail({})).toBeNull()
  })
})
