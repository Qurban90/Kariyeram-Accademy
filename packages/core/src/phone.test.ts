import { describe, expect, it } from 'vitest'
import { isEmail, maskPhone, normalizeAzPhone } from './phone.ts'

describe('normalizeAzPhone', () => {
  it('müxtəlif yazılışları E.164-ə gətirir', () => {
    for (const s of ['050 123 45 67', '(050) 123-45-67', '501234567', '+994 50 123 45 67', '00994501234567', '994501234567']) {
      const r = normalizeAzPhone(s)
      expect(r, s).toEqual({ ok: true, e164: '+994501234567', display: '+994 50 123 45 67' })
    }
  })
  it('yanlış formatı və prefiksi rədd edir', () => {
    expect(normalizeAzPhone('')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeAzPhone('+7 900 123 45 67')).toEqual({ ok: false, reason: 'format' })
    expect(normalizeAzPhone('05012345')).toEqual({ ok: false, reason: 'format' })
    expect(normalizeAzPhone('012 123 45 67')).toEqual({ ok: false, reason: 'prefix' }) // Bakı stasionar
    expect(normalizeAzPhone('050abc4567')).toEqual({ ok: false, reason: 'format' })
  })
  it('maskalayır və e-poçtu yoxlayır', () => {
    expect(maskPhone('+994501234567')).toBe('+994 50 *** ** 67')
    expect(isEmail('ad@karyeram.az')).toBe(true)
    expect(isEmail('ad@karyeram')).toBe(false)
    expect(isEmail('a d@x.az')).toBe(false)
  })
})
