import { describe, expect, it } from 'vitest'
import { cameraPath, classmates, doorSlots, fit, HALL, layerAt, mySeat, project, ROOM, sampleLayer, seatCamera, VP } from './plan'

describe('2.5D səhnə: proyeksiya', () => {
  it('göz hündürlüyündəki mərkəz nöqtəsi qaçış nöqtəsinə düşür', () => {
    const p = project(0, 1.6, 10)
    expect(p.x).toBeCloseTo(VP.x)
    expect(p.y).toBeCloseTo(VP.y)
  })
  it('uzaqdakı əşya kiçikdir, sağdakı sağda, döşəmə aşağıdadır', () => {
    expect(project(1, 1.6, 2).x - VP.x).toBeGreaterThan(project(1, 1.6, 8).x - VP.x)
    expect(project(1, 1.6, 4).x).toBeGreaterThan(VP.x)
    expect(project(0, 0, 4).y).toBeGreaterThan(VP.y)
  })
  it('slice rejimi ekranı tam örtür', () => {
    for (const [w, h] of [[390, 844], [1280, 720], [800, 800]] as const) {
      const f = fit(w, h)
      expect(800 * f.s).toBeGreaterThanOrEqual(Math.max(w, h) - 0.001)
      expect(f.ox).toBeLessThanOrEqual(0)
      expect(f.oy).toBeLessThanOrEqual(0)
    }
  })
})

describe('2.5D səhnə: kamera qatları', () => {
  it('kamera yerində olanda qat dəyişmir', () => {
    const t = layerAt(6, { dz: 0, cx: 0, drop: 0 }, 390, 844)
    expect(t.k).toBeCloseTo(1)
    expect(t.tx).toBeCloseTo(0)
    expect(t.ty).toBeCloseTo(0)
  })
  it('irəli gedəndə yaxın qat uzaqdakından çox böyüyür (paralaks)', () => {
    const cam = { dz: 2, cx: 0, drop: 0 }
    expect(layerAt(4, cam, 390, 844).k).toBeGreaterThan(layerAt(10, cam, 390, 844).k)
  })
  it('qatın transformu dünya nöqtəsini yeni kameranın proyeksiyasına aparır', () => {
    const w = 390, h = 844, zl = 6, X = 1.2, Y = 0.8
    const cam = { dz: 2.5, cx: 0.9, drop: 0.3 }
    const { s, ox, oy } = fit(w, h)
    const before = project(X, Y, zl)
    const sx = ox + before.x * s, sy = oy + before.y * s
    const t = layerAt(zl, cam, w, h)
    const ax = w / 2 + t.k * (sx - w / 2) + t.tx
    const ay = h / 2 + t.k * (sy - h / 2) + t.ty
    const after = project(X - cam.cx, Y, zl - cam.dz, 1.6 - cam.drop)
    expect(ax).toBeCloseTo(ox + after.x * s, 3)
    expect(ay).toBeCloseTo(oy + after.y * s, 3)
  })
  it('kamera yolu başlanğıcdan sona çatır və oturanda göz enir', () => {
    const path = cameraPath({ dz: 3, cx: 1, sit: true })
    expect(path(0)).toEqual({ dz: 0, cx: 0, drop: 0 })
    const end = path(1)
    expect(end.dz).toBeCloseTo(3)
    expect(end.cx).toBeCloseTo(1)
    expect(end.drop).toBeGreaterThan(0.3)
  })
  it('nümunələr artan girişlə gəlir (Animated.interpolate tələbi)', () => {
    const s = sampleLayer(cameraPath({ dz: 2, cx: 0, sit: false }), 6, 390, 844)
    expect(s.input[0]).toBe(0)
    expect(s.input.at(-1)).toBe(1)
    expect(s.input.every((v, i) => i === 0 || v > s.input[i - 1]!)).toBe(true)
    expect([s.k, s.tx, s.ty].every((a) => a.length === s.input.length && a.every(Number.isFinite))).toBe(true)
  })
})

describe('2.5D səhnə: sinif və dəhliz', () => {
  it('tələbənin partası ən yaxın sıradadır, sütun nömrəyə görə dəyişir', () => {
    expect(mySeat(1)).toMatchObject({ row: 0, col: 0, no: 1 })
    expect(mySeat(6)).toMatchObject({ col: 1, no: 2 })
    expect(mySeat(null).col).toBe(0)
    expect(mySeat(-3).col).toBe(0)
    const s = mySeat(4)
    expect(s.x).toBe(ROOM.cols[3])
    expect(seatCamera(s).dz).toBeLessThan(s.z)
  })
  it('sinif yoldaşları sabit toxumla eyni çıxır', () => {
    expect(classmates(42, 11)).toEqual(classmates(42, 11))
    expect(classmates(42, 11)).not.toEqual(classmates(43, 11))
    expect(classmates(7, 11)).toHaveLength(11)
  })
  it('dəhliz qapıları növbə ilə iki divarda, dəhlizin içində', () => {
    const d = doorSlots(5)
    expect(d.map((x) => x.side)).toEqual([-1, 1, -1, 1, -1])
    expect(d.every((x, i) => i === 0 || x.z > d[i - 1]!.z)).toBe(true)
    expect(d.at(-1)!.z + HALL.doorW).toBeLessThan(HALL.end)
  })
})
