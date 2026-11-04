import { describe, expect, it } from 'vitest'
import { totp } from './totp.mjs'

describe('TOTP (RFC 6238 test vektorları, SHA-1)', () => {
  // RFC 6238 Əlavə B: açar "12345678901234567890" (ASCII), 8 rəqəmli kodların son 6 rəqəmi.
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
  it.each([[59, '287082'], [1111111109, '081804'], [1234567890, '005924'], [2000000000, '279037']])('t=%i', (t, code) => {
    expect(totp(secret, t * 1000)).toBe(code)
  })
})
