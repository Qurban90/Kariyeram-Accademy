import { describe, expect, it } from 'vitest'
import { angleDelta, approach, classroomSeat, colorFor, corridorLength, doorSpots, paletteFor, standBefore } from './layout'

describe('3D dəhliz həndəsəsi', () => {
  it('qapılar növbə ilə iki tərəfdə, cüt-cüt irəli', () => {
    const d = doorSpots(4)
    expect(d.map((x) => x.side)).toEqual([1, -1, 1, -1])
    expect(d[0]!.z).toBe(d[1]!.z)
    expect(d[2]!.z).toBeLessThan(d[0]!.z)
    expect(Math.abs(d[0]!.x)).toBeLessThan(2)
  })
  it('dəhliz bütün qapıları əhatə edir', () => {
    for (const n of [0, 1, 3, 8]) {
      const last = doorSpots(n).at(-1)
      if (last) expect(corridorLength(n)).toBeGreaterThan(-last.z + 1)
    }
  })
  it('qapı qarşısında dayanıb qapıya baxır', () => {
    const s = standBefore({ x: 2, z: -3, side: 1 })
    expect(s).toEqual({ x: 0.4, z: -3, yaw: -Math.PI / 2 })
  })
  it('hamar yaxınlaşma və qısa yolla dönmə', () => {
    expect(approach(0, 10, 0)).toBe(0)
    expect(approach(0, 10, 10)).toBeCloseTo(10, 5)
    expect(angleDelta(0.1, -0.1)).toBeCloseTo(-0.2)
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6)
  })
  it('sinif: ön sıra lövhəyə yaxın, sıra simmetrik, rəng sabit', () => {
    const a = classroomSeat(1), b = classroomSeat(6), c = classroomSeat(7)
    expect(a.z).toBe(b.z)
    expect(a.x).toBeCloseTo(-b.x)
    expect(c.z).toBeGreaterThan(a.z)
    expect(colorFor('u1')).toBe(colorFor('u1'))
    expect(colorFor('u1')).not.toBe(colorFor('u2'))
  })
  it('avatar palitrası sabitdir və hex rənglərdir', () => {
    const p = paletteFor('student-42')
    expect(p).toEqual(paletteFor('student-42'))
    expect(p.skin).toMatch(/^#[0-9a-f]{6}$/)
    expect(p.hair).toMatch(/^#[0-9a-f]{6}$/)
    const skins = new Set(Array.from({ length: 40 }, (_, i) => paletteFor(`u${i}`).skin))
    expect(skins.size).toBeGreaterThan(2)
  })
})
