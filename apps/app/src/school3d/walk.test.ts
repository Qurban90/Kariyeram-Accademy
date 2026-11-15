import { describe, expect, it } from 'vitest'
import { EYE_HEIGHT } from './layout'
import {
  canStand, corridorStand, corridorTargets, corridorWalk, CORRIDOR_START, DESKS, deskAisle, deskSeat, nearest, ROOM_START,
  roomTargets, roomWalk, routeToDesk, SEAT_EYE, slide, stride, Walker,
} from './walk'

const run = (w: Walker, seconds: number) => { for (let i = 0; i < seconds * 60; i++) w.update(1 / 60) }

describe('gəzinti: toqquşma və addım', () => {
  const areas = [[-1, 1, -5, 5]] as const, blocks = [[-0.5, 0.5, -1, 0]] as const
  it('sahədən kənarda və maneənin içində dayanmaq olmur', () => {
    expect(canStand(0, 2, areas, blocks)).toBe(true)
    expect(canStand(1.2, 2, areas, blocks)).toBe(false)
    expect(canStand(0, -0.5, areas, blocks)).toBe(false)
  })
  it('divara çəp gedəndə divar boyu sürüşür', () => {
    const p = slide({ x: 0.95, z: 2 }, 0.2, -0.2, areas, blocks)
    expect(p.x).toBe(0.95)
    expect(p.z).toBeCloseTo(1.8)
  })
  it('irəli addım baxış istiqamətindədir', () => {
    const a = stride(1, 0, 0, 1)
    expect(a.dx).toBeCloseTo(0); expect(a.dz).toBeCloseTo(-1)
    const b = stride(1, 0, Math.PI / 2, 1) // sola baxır
    expect(b.dx).toBeCloseTo(-1); expect(b.dz).toBeCloseTo(0)
    const c = stride(1, 1, 0, 1) // çəp gedəndə sürət artmır
    expect(Math.hypot(c.dx, c.dz)).toBeCloseTo(1)
  })
})

describe('gəzinti: dəhliz', () => {
  it('joystiklə irəli gedir, dəhlizin sonunda dayanır', () => {
    const { areas, blocks } = corridorWalk(5)
    const w = new Walker(CORRIDOR_START, areas, blocks)
    w.stick.y = -1
    run(w, 1)
    expect(w.z).toBeLessThan(CORRIDOR_START.z - 1.5)
    run(w, 30)
    expect(w.z).toBeCloseTo(areas[0]![2], 1)
    expect(canStand(w.x, w.z, areas, blocks)).toBe(true)
  })
  it('üzbəüz iki qapının arasında baxdığın qapı seçilir', () => {
    const targets = corridorTargets(4)
    const z = targets[0]!.z
    expect(nearest({ x: 0, z, yaw: -Math.PI / 2 }, targets)?.id).toBe('0') // sağa baxır
    expect(nearest({ x: 0, z, yaw: Math.PI / 2 }, targets)?.id).toBe('1') // sola baxır
    expect(nearest({ x: 0, z: z + 2.2, yaw: 0 }, targets.filter((t) => t.id !== 'board'))).toBeNull()
  })
  it('qapıya özü yeriyir və üzünü qapıya çevirir', () => {
    const { areas, blocks } = corridorWalk(5)
    const w = new Walker(CORRIDOR_START, areas, blocks)
    const s = corridorStand('2', 5)
    let done = false
    w.walkTo([s], s.yaw, () => { done = true })
    expect(w.mode).toBe('auto')
    run(w, 8)
    expect(done).toBe(true)
    expect(w.mode).toBe('walk')
    expect(w.x).toBeCloseTo(s.x); expect(w.z).toBeCloseTo(s.z); expect(w.yaw).toBeCloseTo(s.yaw)
  })
  it('pəncərə açıq olanda hərəkət etmir', () => {
    const { areas, blocks } = corridorWalk(5)
    const w = new Walker(CORRIDOR_START, areas, blocks)
    w.frozen = true; w.stick.y = -1
    run(w, 1)
    expect(w.z).toBe(CORRIDOR_START.z)
  })
})

describe('gəzinti: fənn otağı', () => {
  const { areas, blocks } = roomWalk()
  it('giriş nöqtəsi və bütün partaların keçidi boşdur, stulun yeri maneədir', () => {
    expect(canStand(ROOM_START.x, ROOM_START.z, areas, blocks)).toBe(true)
    expect(DESKS).toHaveLength(12)
    for (const d of DESKS) {
      const a = deskAisle(d), s = deskSeat(d)
      expect(canStand(a.x, a.z, areas, blocks), `parta ${d.no} keçidi`).toBe(true)
      expect(canStand(s.x, s.z, areas, blocks), `parta ${d.no} stulu`).toBe(false)
    }
  })
  it('hər partanın yanında həmin parta seçilir', () => {
    const targets = roomTargets()
    for (const d of DESKS) {
      const a = deskAisle(d)
      // Üzü partaya tərəf.
      expect(nearest({ ...a, yaw: d.x < a.x ? Math.PI / 2 : -Math.PI / 2 }, targets)?.id).toBe(`desk:${d.no}`)
    }
  })
  it('seçilən partaya gedir, oturur (göz enir, üz lövhəyə), sonra qalxır', () => {
    const w = new Walker(ROOM_START, areas, blocks)
    const d = DESKS[1]!
    let seated = false
    w.walkTo(routeToDesk(w, d), undefined, () => w.sit(deskSeat(d), () => { seated = true }))
    run(w, 12)
    expect(seated).toBe(true)
    expect(w.mode).toBe('seated')
    expect(w.eye).toBeCloseTo(SEAT_EYE)
    expect(w.yaw).toBeCloseTo(0)
    expect(w.x).toBeCloseTo(d.x)
    // Oturanda baxış məhduddur, joystik yerindən tərpətmir.
    w.look(-2000, 0); w.stick.y = -1
    run(w, 1)
    expect(w.yaw).toBeLessThanOrEqual(0.9)
    expect(w.x).toBeCloseTo(d.x)
    w.stick.y = 0
    w.stand(deskAisle(d))
    run(w, 2)
    expect(w.mode).toBe('walk')
    expect(w.eye).toBeCloseTo(EYE_HEIGHT)
    expect(canStand(w.x, w.z, areas, blocks)).toBe(true)
  })
})
