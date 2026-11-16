import { describe, expect, it } from 'vitest'
import { EYE_HEIGHT } from './layout'
import {
  canStand, corridorStand, corridorTargets, corridorThrough, corridorWalk, CORRIDOR_START, DESKS, deskAisle, deskSeat, HALL, HALL_PER_ROW, HALL_SEATS,
  HALL_TOP, hallGround, hallPlan, nearest, ROOM, roomPlan, ROOM_START, roomTargets, roomWalk, routeToDesk, SEAT_EYE, slide, stride, Walker,
} from './walk'
import { CORRIDOR_WIDTH } from './layout'

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

describe('gəzinti: qapıdan keçid', () => {
  it('dəhlizdən keçid nöqtəsi divarın o tayındadır, qapının düz qarşısında', () => {
    for (const id of ['0', '1', '4']) {
      const s = corridorStand(id, 5), th = corridorThrough(id, 5)
      expect(Math.abs(th.x)).toBeGreaterThan(CORRIDOR_WIDTH / 2 + 0.5)
      expect(Math.sign(th.x)).toBe(Math.sign(s.x))
      expect(th.z).toBe(s.z)
    }
    expect(corridorThrough('hall', 5).z).toBeLessThan(corridorStand('hall', 5).z - 2)
  })
  it('sinfə qapının içindən girir və boş yerdə dayanır; çıxış nöqtəsi divarın o tayındadır', () => {
    const p = roomPlan()
    expect(p.door.z).toBeGreaterThan(p.start.z)
    expect(canStand(p.start.x, p.start.z, p.walk.areas, p.walk.blocks)).toBe(true)
    expect(p.outside.z).toBeGreaterThan(ROOM.back)
    const w = new Walker(p.door, p.walk.areas, p.walk.blocks)
    let inRoom = false
    w.walkTo([p.start], p.start.yaw, () => { inRoom = true }, Walker.DOOR_SPEED)
    run(w, 3)
    expect(inRoom).toBe(true)
    expect(w.mode).toBe('walk')
  })
})

describe('gəzinti: oxu zalı (pilləli auditoriya)', () => {
  const p = hallPlan()
  it('döşəmə səhnədə 0-dır, hər sıra bir pillə qalxır, meydança ən yuxarıdadır', () => {
    expect(hallGround(0, HALL.front + 2)).toBe(0)
    expect(hallGround(0, HALL.z0 + 0.1)).toBe(0)
    expect(hallGround(0, HALL.z0 + HALL.depth + 0.1)).toBeCloseTo(HALL.rise)
    expect(hallGround(0, HALL.back - 1)).toBeCloseTo(HALL_TOP)
    expect(hallGround(p.start.x, p.start.z)).toBeCloseTo(HALL_TOP)
  })
  it('zal 120 nəfərlik tutumu qarşılayır, yerlər sıra-sıra qalxır və keçidləri boşdur', () => {
    expect(HALL_SEATS.length).toBeGreaterThanOrEqual(120)
    expect(HALL_SEATS[0]!.y).toBe(0)
    expect(HALL_SEATS[HALL_PER_ROW]!.y).toBeCloseTo(HALL.rise)
    expect(HALL_SEATS[HALL_PER_ROW]!.z).toBeGreaterThan(HALL_SEATS[0]!.z)
    for (const d of HALL_SEATS) {
      expect(canStand(d.aisle.x, d.aisle.z, p.walk.areas, p.walk.blocks), `yer ${d.no} keçidi`).toBe(true)
      expect(hallGround(d.x, d.z), `yer ${d.no} hündürlüyü`).toBeCloseTo(d.y)
      expect(Math.abs(d.x)).toBeLessThan(HALL.halfW - 1)
    }
    // Eyni sırada yerlər üst-üstə düşmür.
    const row = HALL_SEATS.slice(0, HALL_PER_ROW).map((d) => d.x)
    for (let i = 1; i < row.length; i++) expect(row[i]! - row[i - 1]!).toBeGreaterThan(0.9)
  })
  it('yuxarıdan girir, keçidlə enib ön sıradakı yerə oturur: göz pillənin hündürlüyünə enir', () => {
    const w = new Walker(p.start, p.walk.areas, p.walk.blocks, p.ground)
    expect(w.floor).toBeCloseTo(HALL_TOP)
    const d = HALL_SEATS[5]! // ön sıra, orta blok
    let seated = false
    w.walkTo(p.route(w, d), undefined, () => w.sit(p.seatAt(d), () => { seated = true }))
    run(w, 20)
    expect(seated).toBe(true)
    expect(w.floor).toBeCloseTo(0, 1)
    expect(w.eye).toBeCloseTo(SEAT_EYE)
    // Arxa sıradakı yer daha yuxarıdadır.
    const top = HALL_SEATS[HALL_SEATS.length - 1]!
    w.stand(d.aisle)
    run(w, 2)
    w.walkTo(p.route(w, top), undefined, () => w.sit(p.seatAt(top)))
    run(w, 25)
    expect(w.mode).toBe('seated')
    expect(w.floor).toBeCloseTo(top.y, 1)
  })
  it('joystiklə keçiddən kənara (sıraların içinə) çıxmaq olmur', () => {
    const d = HALL_SEATS[HALL_PER_ROW * 3]!
    const w = new Walker({ ...d.aisle, yaw: Math.PI / 2 }, p.walk.areas, p.walk.blocks, p.ground)
    w.stick.y = -1 // sola, divara doğru
    run(w, 3)
    expect(canStand(w.x, w.z, p.walk.areas, p.walk.blocks)).toBe(true)
    expect(Math.abs(w.x - d.aisle.x)).toBeLessThan(0.6)
  })
})

