/**
 * Birinci şəxs gəzintisi (FR-050): tələbə özü yeriyir, qapıya yaxınlaşır, partaya oturur.
 * Saf məntiqdir (render və React-dən asılı deyil, test olunur). Vahid: metr, bucaq: radian.
 * Baxış istiqaməti: yaw = 0 olanda -Z (lövhəyə doğru), müsbət yaw sola dönür.
 */
import { angleDelta, CORRIDOR_WIDTH, corridorLength, doorSpots, EYE_HEIGHT } from './layout'

/** Düzbucaqlı [x0, x1, z0, z1]: gəzmək olan sahə və ya maneə. */
export type Rect = readonly [number, number, number, number]
export interface Point { x: number; z: number }
export interface Pose extends Point { yaw: number }
export type WalkMode = 'walk' | 'auto' | 'tween' | 'seated'
/** Ekrandakı nöqtədən (NDC) baxanda dəyən əşyanın əməli (`userData.act`); divar arxasındakı əşya seçilmir. */
export type PickFn = (nx: number, ny: number) => string | null

export const SEAT_EYE = 1.2
/** Sakit baxış: bir az aşağı (şaquli telefonda kadrın yarısını tavan tutmasın). */
export const REST_PITCH = -0.1
const SPEED = 2.2, AUTO_SPEED = 2.8, TURN = 1.7
const LOOK_X = 0.0042, LOOK_Y = 0.0034
const inside = (x: number, z: number, r: Rect) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]

/** Nöqtədə dayanmaq olarmı: ən azı bir sahənin içində və heç bir maneənin içində deyil. */
export function canStand(x: number, z: number, areas: readonly Rect[], blocks: readonly Rect[]): boolean {
  return areas.some((r) => inside(x, z, r)) && !blocks.some((r) => inside(x, z, r))
}

/** Addım: maneəyə dəyəndə dayanmır, divar boyu sürüşür (əvvəl hər iki ox, sonra yalnız X, sonra yalnız Z). */
export function slide(p: Point, dx: number, dz: number, areas: readonly Rect[], blocks: readonly Rect[]): Point {
  if (canStand(p.x + dx, p.z + dz, areas, blocks)) return { x: p.x + dx, z: p.z + dz }
  if (canStand(p.x + dx, p.z, areas, blocks)) return { x: p.x + dx, z: p.z }
  if (canStand(p.x, p.z + dz, areas, blocks)) return { x: p.x, z: p.z + dz }
  return p
}

/** Joystik (irəli, yana) → dünya koordinatında yerdəyişmə. */
export function stride(fwd: number, side: number, yaw: number, dist: number): { dx: number; dz: number } {
  let f = fwd, s = side
  const m = Math.hypot(f, s)
  if (m > 1) { f /= m; s /= m }
  return { dx: (-Math.sin(yaw) * f + Math.cos(yaw) * s) * dist, dz: (-Math.cos(yaw) * f - Math.sin(yaw) * s) * dist }
}

export interface Target extends Point { id: string; reach: number }

/**
 * Yaxındakı hədəf (qapı, parta): məsafə və baxış istiqaməti birlikdə nəzərə alınır,
 * ona görə üzbəüz iki qapının arasında dayananda baxdığın qapı seçilir.
 */
export function nearest(p: Pose, targets: readonly Target[]): Target | null {
  let best: Target | null = null, bestScore = Infinity
  for (const t of targets) {
    const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz)
    if (d > t.reach) continue
    const facing = d < 0.01 ? 1 : (-Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz) / d
    const score = d - facing * 0.9
    if (score < bestScore) { best = t; bestScore = score }
  }
  return best
}

interface Tween { t: number; dur: number; from: { x: number; z: number; eye: number; yaw: number; pitch: number }; to: { x: number; z: number; eye: number; yaw: number; pitch: number }; then: WalkMode; done?: () => void }

/** Oyunçunun vəziyyəti və hərəkəti. Hər kadrda `update(dt)` çağırılır, kamera bu dəyərlərdən qurulur. */
export class Walker {
  x: number; z: number; yaw: number
  pitch = REST_PITCH
  eye = EYE_HEIGHT
  mode: WalkMode = 'walk'
  /** Joystik: x sağa, y aşağı (ekran koordinatı), [-1, 1]. */
  stick = { x: 0, y: 0 }
  /** Klaviatura: irəli/geri, sağa/sola, dönmə. */
  keys = { fwd: 0, side: 0, turn: 0 }
  /** Pəncərə açıq olanda hərəkət dayanır. */
  frozen = false
  /** Addım fazası (yeriyəndə kameranın yüngül yırğalanması üçün). */
  phase = 0
  moving = 0
  private path: { pts: Point[]; i: number; yaw?: number; done?: () => void } | null = null
  private tw: Tween | null = null

  constructor(start: Pose, public areas: readonly Rect[], public blocks: readonly Rect[]) {
    this.x = start.x; this.z = start.z; this.yaw = start.yaw
  }

  get pose(): Pose { return { x: this.x, z: this.z, yaw: this.yaw } }

  /** Barmağın/siçanın sürüşməsi (piksel) ilə baxış. Oturanda baxış bucağı məhduddur. */
  look(dxPx: number, dyPx: number) {
    if (this.frozen || this.mode === 'auto' || this.mode === 'tween') return
    this.yaw -= dxPx * LOOK_X
    this.pitch -= dyPx * LOOK_Y
    if (this.mode === 'seated') {
      this.yaw = Math.max(-0.9, Math.min(0.9, this.yaw))
      this.pitch = Math.max(-0.7, Math.min(0.4, this.pitch))
    } else this.pitch = Math.max(-1, Math.min(1, this.pitch))
  }

  /** Nöqtələr üzrə özü yeriyir (qapıya, partaya), sonda istəyə görə üzünü `yaw`-a çevirir. */
  walkTo(pts: Point[], yaw?: number, done?: () => void) {
    this.tw = null
    this.path = { pts, i: 0, yaw, done }
    this.mode = 'auto'
  }

  /** Hamar keçid (oturmaq, qalxmaq, üzünü çevirmək). */
  tweenTo(dur: number, to: Partial<Tween['to']>, then: WalkMode, done?: () => void) {
    const from = { x: this.x, z: this.z, eye: this.eye, yaw: this.yaw, pitch: this.pitch }
    this.path = null
    this.tw = { t: 0, dur, from, to: { ...from, ...to }, then, done }
    this.mode = 'tween'
  }

  /** Partaya oturur: göz səviyyəsi enir, üz lövhəyə çevrilir. */
  sit(seat: Point, done?: () => void) {
    this.tweenTo(1.0, { x: seat.x, z: seat.z, eye: SEAT_EYE, yaw: 0, pitch: -0.14 }, 'seated', done)
  }

  /** Ayağa qalxır və partanın yanındakı keçidə çıxır. */
  stand(to: Point, done?: () => void) {
    this.tweenTo(0.8, { x: to.x, z: to.z, eye: EYE_HEIGHT, pitch: REST_PITCH }, 'walk', done)
  }

  /** Dərhal yerləşdirmə (otağa giriş). */
  place(p: Pose) {
    this.path = null; this.tw = null
    this.x = p.x; this.z = p.z; this.yaw = p.yaw; this.pitch = REST_PITCH; this.eye = EYE_HEIGHT; this.mode = 'walk'
  }

  update(dt: number) {
    this.moving = 0
    if (this.tw) {
      const tw = this.tw
      tw.t = Math.min(1, tw.t + dt / tw.dur)
      const k = tw.t * tw.t * (3 - 2 * tw.t)
      this.x = tw.from.x + (tw.to.x - tw.from.x) * k
      this.z = tw.from.z + (tw.to.z - tw.from.z) * k
      this.eye = tw.from.eye + (tw.to.eye - tw.from.eye) * k
      this.yaw = tw.from.yaw + angleDelta(tw.from.yaw, tw.to.yaw) * k
      this.pitch = tw.from.pitch + (tw.to.pitch - tw.from.pitch) * k
      if (tw.t >= 1) { this.tw = null; this.mode = tw.then; tw.done?.() }
      return
    }
    if (this.path) {
      const path = this.path
      const p = path.pts[path.i]
      if (!p) { this.finishPath(); return }
      const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz), step = AUTO_SPEED * dt
      if (dist > 0.05) {
        this.yaw += angleDelta(this.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 6)
        this.pitch += (REST_PITCH - this.pitch) * Math.min(1, dt * 4)
      }
      if (dist <= step) { this.x = p.x; this.z = p.z; path.i++; if (path.i >= path.pts.length) this.finishPath() }
      else { this.x += (dx / dist) * step; this.z += (dz / dist) * step }
      this.moving = 1
      this.phase += dt * 8.5
      return
    }
    if (this.mode !== 'walk' || this.frozen) return
    this.yaw += this.keys.turn * TURN * dt
    const fwd = this.keys.fwd - this.stick.y, side = this.keys.side + this.stick.x
    const m = Math.min(1, Math.hypot(fwd, side))
    if (m < 0.05) return
    const { dx, dz } = stride(fwd, side, this.yaw, SPEED * dt)
    const n = slide(this, dx, dz, this.areas, this.blocks)
    if (n.x !== this.x || n.z !== this.z) { this.moving = m; this.phase += dt * 8.5 * m }
    this.x = n.x; this.z = n.z
  }

  private finishPath() {
    const path = this.path
    this.path = null
    this.mode = 'walk'
    if (!path) return
    if (path.yaw !== undefined) this.tweenTo(0.4, { yaw: path.yaw, pitch: REST_PITCH }, 'walk', path.done)
    else path.done?.()
  }
}

/* ───────────── Dəhliz ───────────── */

/** Dəhlizin girişi (arxa divar) və oyunçunun başladığı yer. */
export const CORRIDOR_BACK = 6
export const CORRIDOR_START: Pose = { x: 0, z: 4.2, yaw: 0 }

export function corridorWalk(doorCount: number): { areas: Rect[]; blocks: Rect[] } {
  const len = corridorLength(doorCount), half = CORRIDOR_WIDTH / 2 - 0.42
  return {
    areas: [[-half, half, -len + 0.75, CORRIDOR_BACK - 0.5]],
    // Girişdəki iki dibçək.
    blocks: [[-2, -1.2, 2.2, 3.0], [1.2, 2, 2.2, 3.0]],
  }
}

/** Dəhlizdəki hədəflər: fənn qapıları (id = sıra nömrəsi), oxu zalı ('hall'), şərəf lövhəsi ('board'). */
export function corridorTargets(doorCount: number): Target[] {
  const len = corridorLength(doorCount)
  return [
    ...doorSpots(doorCount).map((d): Target => ({ id: String(d.index), x: d.x, z: d.z, reach: 2.3 })),
    { id: 'hall', x: 0, z: -len, reach: 3 },
    { id: 'board', x: -CORRIDOR_WIDTH / 2, z: 1.2, reach: 2.1 },
  ]
}

/** Hədəfin qarşısında dayanılan yer və baxış istiqaməti. */
export function corridorStand(id: string, doorCount: number): Pose {
  const len = corridorLength(doorCount)
  if (id === 'hall') return { x: 0, z: -len + 1.9, yaw: 0 }
  if (id === 'board') return { x: -0.5, z: 1.2, yaw: Math.PI / 2 }
  const d = doorSpots(doorCount)[Number(id)]
  if (!d) return CORRIDOR_START
  return { x: d.side * 0.75, z: d.z, yaw: d.side === 1 ? -Math.PI / 2 : Math.PI / 2 }
}

/* ───────────── Fənn otağı ───────────── */

export const ROOM = { halfW: 5, front: -4.65, back: 6.2, doorX: 3.7 } as const
export const ROOM_START: Pose = { x: ROOM.doorX, z: ROOM.back - 0.9, yaw: 0.35 }

export interface Desk { no: number; x: number; z: number; aisle: number }

const DESK_COLS = [-3.2, -2.0, 2.0, 3.2] as const
const DESK_ROWS = [-1.1, 0.8, 2.7] as const
/** Partalar: 3 sıra × 4 sütun, ortada və kənarlarda keçid. Nömrə ön sıradan, soldan sağa. */
export const DESKS: readonly Desk[] = DESK_ROWS.flatMap((z, r) => DESK_COLS.map((x, c): Desk => ({
  no: r * DESK_COLS.length + c + 1, x, z,
  // Kənar sütun divar keçidindən, daxili sütun orta keçiddən yaxınlaşır.
  aisle: Math.abs(x) > 3 ? Math.sign(x) * 4.25 : Math.sign(x) * 0.95,
})))

/** Oturanda gözün yeri (stul) və ayağa qalxanda çıxılan yer (keçid). */
export const deskSeat = (d: Desk): Point => ({ x: d.x, z: d.z + 0.22 })
export const deskAisle = (d: Desk): Point => ({ x: d.aisle, z: d.z + 0.3 })

export function roomWalk(): { areas: Rect[]; blocks: Rect[] } {
  const m = 0.4
  return {
    areas: [[-ROOM.halfW + m, ROOM.halfW - m, ROOM.front + 1.0, ROOM.back - m]],
    blocks: [
      // Qoşa partalar (stulla birlikdə), müəllim masası, kitab şkafı.
      ...DESK_ROWS.flatMap((z): Rect[] => [[-3.95, -1.25, z - 0.85, z + 0.62], [1.25, 3.95, z - 0.85, z + 0.62]]),
      [1.65, 3.75, -3.8, -2.5],
      [-3.9, -1.3, ROOM.back - 0.95, ROOM.back],
    ],
  }
}

/** Otaqdakı hədəflər: partalar ('desk:N'), çıxış qapısı ('exit'), kitab şkafı ('shelf'). */
export function roomTargets(): Target[] {
  return [
    ...DESKS.map((d): Target => ({ id: `desk:${d.no}`, x: d.x, z: d.z + 0.2, reach: 1.7 })),
    { id: 'exit', x: ROOM.doorX, z: ROOM.back, reach: 1.6 },
    { id: 'shelf', x: -2.6, z: ROOM.back - 0.4, reach: 1.9 },
  ]
}

/** Partaya yol: əvvəl keçidə, sonra keçidlə partanın yanına (partaların içindən keçməmək üçün). */
export function routeToDesk(from: Point, d: Desk): Point[] {
  const a = deskAisle(d)
  const pts: Point[] = []
  // Sıraların arasındadırsa əvvəl arxadakı boş sahəyə çıxır.
  const backZ = DESK_ROWS[DESK_ROWS.length - 1]! + 1.3
  if (Math.abs(from.x - a.x) > 0.4) {
    if (from.z < backZ - 0.2) pts.push({ x: from.x, z: Math.max(from.z, backZ) })
    pts.push({ x: a.x, z: Math.max(from.z, backZ) })
  }
  pts.push(a)
  return pts
}
