import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateTime, fmtWhen } from './dates'

describe('tarix formatı (az)', () => {
  const d = new Date(2026, 10, 5, 17, 9) // yerli vaxt: 5 noyabr 2026, cümə axşamı
  it('ay adları ilə', () => {
    expect(fmtDate(d)).toBe('5 noyabr 2026')
    expect(fmtDateTime(d)).toBe('5 noyabr 2026, 17:09')
    expect(fmtWhen(d)).toBe('cümə axşamı, 5 noyabr, 17:09')
  })
  it('ISO sətri və yanlış dəyər', () => {
    expect(fmtDate(d.toISOString())).toBe('5 noyabr 2026')
    expect(fmtDate('zibil')).toBe('—')
  })
})
