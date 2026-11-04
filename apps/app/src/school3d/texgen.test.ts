import { describe, expect, it } from 'vitest'
import { ceilingTiles, chalkboard, fbm, marbleTiles, plaster, plate, runner, tileNoise, woodGrain, woodPlanks, type Pixels } from './texgen'

const px = (p: Pixels, x: number, y: number) => Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4))
const lum = (p: Pixels, x: number, y: number) => { const [r, g, b] = px(p, x, y); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! }

describe('prosedur teksturalar', () => {
  it('küy plitəlidir: period sonunda başlanğıca qayıdır', () => {
    const n = tileNoise(4, 4, 1)
    expect(n(4, 2.5)).toBeCloseTo(n(0, 2.5), 6)
    expect(n(1.3, 4)).toBeCloseTo(n(1.3, 0), 6)
    const f = fbm(2, 2, 3, 5)
    expect(f(1, 0.3)).toBeCloseTo(f(0, 0.3), 6)
    for (let i = 0; i < 50; i++) { const v = f(i / 50, (i * 7 % 50) / 50); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) }
  })

  it('deterministikdir və ölçüsü düzgündür', () => {
    const a = woodPlanks(64, 3), b = woodPlanks(64, 3), c = woodPlanks(64, 4)
    expect(a.color.data.length).toBe(64 * 64 * 4)
    expect(Buffer.from(a.color.data).equals(Buffer.from(b.color.data))).toBe(true)
    expect(Buffer.from(a.color.data).equals(Buffer.from(c.color.data))).toBe(false)
    expect(a.bump!.data.length).toBe(64 * 64 * 4)
  })

  it('bütün piksellər qeyri-şəffafdır və rəng müxtəlifliyi var (düz rəng deyil)', () => {
    for (const s of [woodPlanks(64), plaster(64), woodGrain(64), marbleTiles(64), runner(32, 64), ceilingTiles(64), chalkboard(64, 36)]) {
      const p = s.color
      let min = 255, max = 0
      for (let i = 0; i < p.width * p.height; i++) {
        expect(p.data[i * 4 + 3]).toBe(255)
        const l = lum(p, i % p.width, Math.floor(i / p.width))
        min = Math.min(min, l); max = Math.max(max, l)
      }
      expect(max - min).toBeGreaterThan(8)
    }
  })

  it('kənarlar uyğun gəlir (təkrarlananda tikiş görünmür)', () => {
    const p = plaster(128).color
    let diff = 0
    for (let y = 0; y < 128; y++) diff += Math.abs(lum(p, 0, y) - lum(p, 127, y))
    expect(diff / 128).toBeLessThan(6)
  })

  it('parketdə lövhə araları bump xəritəsində çökükdür', () => {
    const s = woodPlanks(128)
    expect(px(s.bump!, 40, 0)[0]).toBe(0) // sətir 0 lövhə arasıdır
    expect(px(s.bump!, 40, 8)[0]).toBe(255)
  })

  it('lövhəcikdə yazı aydın görünür, boş mətn yazısızdır', () => {
    const count = (p: Pixels) => { let n = 0; for (let y = 6; y < p.height - 6; y++) for (let x = 6; x < p.width - 6; x++) if (lum(p, x, y) < 50) n++; return n }
    expect(count(plate('101').color)).toBeGreaterThan(100)
    expect(count(plate('').color)).toBe(0)
    expect(count(plate('ZAL').color)).toBeGreaterThan(100)
    // Rəqəm "1"-in üst ucu yazının yuxarı hissəsindədir (sətirlər aşağıdan yuxarı yazılıb, şəkil tərs deyil).
    const p = plate('1', 64, 48).color
    let topDark = 0, bottomDark = 0
    // Hündürlük 48, xana 4 piksel: glif yuxarıdan 10..37-ci sətirlərdədir → aşağıdan sayanda üst sıra y≈36, alt sıra y≈11.
    for (let x = 8; x < 56; x++) { if (lum(p, x, 36) < 50) topDark++; if (lum(p, x, 11) < 50) bottomDark++ }
    // "1"-in altında enli oturacaq var (0x0e), üstündə dar uc: alt sətirlərdə daha çox tünd piksel.
    expect(bottomDark).toBeGreaterThan(topDark)
  })
})
