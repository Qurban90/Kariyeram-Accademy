import { describe, expect, it } from 'vitest'
import { compareVersions } from './version.ts'

describe('compareVersions', () => {
  it('rəqəmlə müqayisə edir', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1)
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1)
    expect(compareVersions('', '0.0.1')).toBe(-1)
    expect(compareVersions('1.0.0-beta', '0.0.0')).toBe(0)
  })
})
