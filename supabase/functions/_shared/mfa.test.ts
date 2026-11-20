import { describe, expect, it } from 'vitest'
import { jwtClaims, mfaGate } from './mfa.ts'

const tok = (claims: Record<string, unknown>) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`

describe('MFA qapısı', () => {
  it('JWT claim-ləri oxunur, pozuq token boş obyektdir', () => {
    expect(jwtClaims(tok({ aal: 'aal2', sub: 'x' }))).toMatchObject({ aal: 'aal2' })
    expect(jwtClaims('zibil')).toEqual({})
    expect(jwtClaims('a.###.b')).toEqual({})
  })
  it('admin marşrutları həmişə aal2', () => {
    expect(mfaGate('admin/users/find', { aal: 'aal1', hasMfa: false }, false)).toMatchObject({ code: 'mfa_required', status: 403 })
    expect(mfaGate('admin/users/find', { aal: 'aal2', hasMfa: true }, false)).toBeNull()
  })
  it('müəllim marşrutları: MFA qoşubsa və ya məcburidirsə aal2', () => {
    expect(mfaGate('staff/codes', { aal: 'aal1', hasMfa: false }, false)).toBeNull()
    expect(mfaGate('staff/codes', { aal: 'aal1', hasMfa: true }, false)).toMatchObject({ code: 'mfa_required' })
    expect(mfaGate('live/create', { aal: 'aal1', hasMfa: false }, true)).toMatchObject({ code: 'mfa_required' })
    expect(mfaGate('staff/codes', { aal: 'aal2', hasMfa: true }, true)).toBeNull()
  })
  it('tələbə marşrutlarına təsir etmir', () => {
    expect(mfaGate('answer', { aal: 'aal1', hasMfa: true }, true)).toBeNull()
    expect(mfaGate('account/export', { aal: 'aal1', hasMfa: true }, true)).toBeNull()
  })
  it('defolt fail-closed: staffMfaRequired verilməyəndə məcburi sayılır', () => {
    expect(mfaGate('staff/codes', { aal: 'aal1', hasMfa: false })).toMatchObject({ code: 'mfa_required', status: 403 })
    expect(mfaGate('staff/codes', { aal: 'aal2', hasMfa: false })).toBeNull()
    expect(mfaGate('answer', { aal: 'aal1', hasMfa: false })).toBeNull()
  })
})
