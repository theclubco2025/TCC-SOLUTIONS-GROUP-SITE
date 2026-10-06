import { describe, expect, it } from 'vitest'
import { applicationReplyLink, firstName, fmtDate, leadReplyLink, mailto } from '@/lib/admin/format'

function parse(link: string) {
  const [head, query] = link.replace('mailto:', '').split('?')
  const params = new URLSearchParams(query)
  return { to: decodeURIComponent(head), subject: params.get('subject'), body: params.get('body') }
}

describe('reply links', () => {
  it('addresses the lead and names the business', () => {
    const link = leadReplyLink({
      email: 'sarah@maplestreet.example',
      contactName: 'Sarah Chen',
      businessName: 'Maple Street Bakery',
      reportUrl: 'https://tccsolutionsgroup.com/analyze/abc/results',
    })
    const { to, subject, body } = parse(link)
    expect(to).toBe('sarah@maplestreet.example')
    expect(subject).toContain('Maple Street Bakery')
    expect(body).toContain('Hi Sarah,')
    expect(body).toContain('https://tccsolutionsgroup.com/analyze/abc/results')
  })

  it('survives characters that would corrupt a naive link', () => {
    // & and ? and # and newlines each end or split a mailto if left unescaped.
    const link = mailto('a@b.co', 'R&D? #1', 'line one\nline two & more = done')
    const { subject, body } = parse(link)
    expect(subject).toBe('R&D? #1')
    expect(body).toBe('line one\nline two & more = done')
    expect(link.split('?')).toHaveLength(2)
  })

  it('cannot be turned into a second header by a hostile business name', () => {
    const link = leadReplyLink({
      email: 'a@b.co',
      contactName: 'A',
      businessName: 'Evil&bcc=attacker@example.com',
      reportUrl: null,
    })
    const params = new URLSearchParams(link.split('?')[1])
    expect(params.get('bcc')).toBeNull()
    expect(params.get('subject')).toContain('Evil&bcc=attacker@example.com')
  })

  it('works without a report link', () => {
    const { body } = parse(
      leadReplyLink({ email: 'a@b.co', contactName: null, businessName: 'X', reportUrl: null }),
    )
    expect(body).toContain('Hi there,')
    expect(body).not.toContain('Your report')
  })

  it('builds an application reply', () => {
    const { to, subject, body } = parse(
      applicationReplyLink({ email: 'j@x.co', name: 'John Smith', organization: 'El Dorado Network' }),
    )
    expect(to).toBe('j@x.co')
    expect(subject).toBe('Your TCCSG partner application')
    expect(body).toContain('El Dorado Network')
  })
})

describe('helpers', () => {
  it('takes a first name, or falls back', () => {
    expect(firstName('Sarah Chen')).toBe('Sarah')
    expect(firstName('  ')).toBe('there')
    expect(firstName(null)).toBe('there')
  })

  it('renders missing dates as a dash, not "Invalid Date"', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
    expect(fmtDate(new Date('2026-10-05T21:00:00Z'))).toContain('2026')
  })
})
