import { describe, expect, it } from 'vitest'
import { canEnter, deskCount, initials, parseLocal, parseMeta, seatMap } from './model'

describe('canlı zal modeli', () => {
  it('metadata: etibarsız JSON-a dözümlü, rol dəyişəndə yer saxlanılır', () => {
    expect(parseMeta('{"role":"audience","seat":3}')).toEqual({ role: 'audience', seat: 3 })
    expect(parseMeta('{"role":"speaker"}', { role: 'audience', seat: 3 })).toEqual({ role: 'speaker', seat: 3 })
    expect(parseMeta('not json', { role: 'cohost', seat: null })).toEqual({ role: 'cohost', seat: null })
    expect(parseMeta('{"role":"admin","seat":-1}')).toEqual({ role: 'audience', seat: null })
    expect(parseMeta(undefined)).toEqual({ role: 'audience', seat: null })
  })
  it('parta sayı tutumu aşmır və tutulmuş yerləri göstərir', () => {
    expect(deskCount(50, [])).toBe(12)
    expect(deskCount(8, [])).toBe(8)
    expect(deskCount(120, [1, 2, 15])).toBe(20)
    expect(deskCount(10, [12])).toBe(12) // tutum azaldılıbsa da oturan görünür
  })
  it('oturacaq xəritəsi', () => {
    const m = seatMap([{ id: 'a', seat: 2 }, { id: 'h', seat: null }, { id: 'b', seat: 2 }], 3)
    expect(m.map((s) => s.peer?.id ?? null)).toEqual([null, 'a', null])
  })
  it('baş hərflər və giriş vaxtı', () => {
    expect(initials('aysel məmmədova')).toBe('AM')
    expect(initials('  ilkin ')).toBe('İ')
    expect(initials('')).toBe('?')
    const now = Date.parse('2026-11-04T10:00:00Z')
    expect(canEnter('2026-11-04T10:14:00Z', 'scheduled', now)).toBe(true)
    expect(canEnter('2026-11-04T10:16:00Z', 'scheduled', now)).toBe(false)
    expect(canEnter('2026-11-04T09:00:00Z', 'ended', now)).toBe(false)
    expect(canEnter('2026-11-04T12:00:00Z', 'live', now)).toBe(true)
  })
  it('yerli tarix formatı', () => {
    expect(parseLocal('2026-11-04 18:30')?.getHours()).toBe(18)
    expect(parseLocal('2026-02-30 10:00')).toBeNull()
    expect(parseLocal('04.11.2026 18:30')).toBeNull()
  })
})
