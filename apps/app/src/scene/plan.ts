/**
 * 2.5D məktəb səhnəsinin saf məntiqi (React-siz, testlənir).
 *
 * Səhnə SVG ilə çəkilir, "kamera" isə qatların transformudur: hər qat təxmini bir dərinlikdədir
 * və kamera irəli gedəndə (dz), yana keçəndə (cx) və oturanda (göz enəndə) qat perspektivə uyğun
 * böyüyür və sürüşür. WebGL lazım deyil: hər telefonda (native driver ilə) axıcı işləyir.
 *
 * Koordinatlar: səhnə 800×800 vahidlik kvadratdır (viewBox), ekranı "slice" ilə örtür.
 * Dünya: X sağa, Y yuxarı (metr), Z kameradan irəli (metr). Göz hündürlüyü EYE.
 */

export const VB = 800
export const VP = { x: 400, y: 380 } as const
/** Fokus məsafəsi (viewBox vahidi). */
export const FOCAL = 360
export const EYE = 1.6
export const SIT_EYE = 1.18

export interface Pt { x: number; y: number }

/** Dünya nöqtəsinin viewBox-dakı yeri (kamera başlanğıcda: X=0, göz EYE, Z=0). */
export function project(X: number, Y: number, Z: number, eye = EYE): Pt {
  const z = Math.max(Z, 0.05)
  return { x: VP.x + (FOCAL * X) / z, y: VP.y - (FOCAL * (Y - eye)) / z }
}

/** Dörd küncü olan səth (divardakı qapı, döşəmə zolağı) üçün SVG nöqtələri. */
export function quad(points: [number, number, number][], eye = EYE): string {
  return points.map(([X, Y, Z]) => { const p = project(X, Y, Z, eye); return `${r1(p.x)},${r1(p.y)}` }).join(' ')
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** viewBox → ekran: "slice" (örtmə) rejimində miqyas və sürüşmə. */
export function fit(w: number, h: number) {
  const s = Math.max(w / VB, h / VB)
  return { s, ox: (w - VB * s) / 2, oy: (h - VB * s) / 2 }
}

export interface Cam { dz: number; cx: number; drop: number }

/**
 * Kamera `cam` vəziyyətində olanda `zl` dərinliyindəki qatın transformu (ekran pikseli ilə).
 * RN miqyası görünüşün mərkəzi ətrafında edir; perspektiv isə qaçış nöqtəsi ətrafındadır, fərqi tərcümə düzəldir.
 */
export function layerAt(zl: number, cam: Cam, w: number, h: number): { k: number; tx: number; ty: number } {
  const { s, ox, oy } = fit(w, h)
  const depth = Math.max(zl - cam.dz, 0.12)
  const k = zl / depth
  const vpx = ox + VP.x * s
  const vpy = oy + VP.y * s
  const tx = (1 - k) * (vpx - w / 2) - (FOCAL * s * cam.cx) / depth
  const ty = (1 - k) * (vpy - h / 2) - (FOCAL * s * cam.drop) / depth
  return { k, tx, ty }
}

/** Yumşaq başlanğıc və bitiş (easeInOutCubic). */
export const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2)
/** Sürətlə başlayıb yumşaq dayanan hərəkət (easeOutCubic). */
export const easeOut = (p: number) => 1 - (1 - p) ** 3

/**
 * Kameranın yolu (0..1 → Cam): `walk` hissəsində irəli yeriyir (yüngül addım yırğalanması ilə),
 * sonra oturur (göz enir). Interpolyasiya nöqtələri Animated üçün nümunələnir.
 */
export function cameraPath(to: { dz: number; cx: number; sit: boolean }, walk = 0.78): (p: number) => Cam {
  return (p) => {
    const a = ease(Math.min(1, p / walk))
    const steps = 6
    const bob = p < walk ? Math.sin(a * Math.PI * steps) ** 2 * 0.035 * (1 - a) : 0
    const sitP = to.sit && p > walk ? easeOut((p - walk) / (1 - walk)) : 0
    return { dz: to.dz * a, cx: to.cx * a, drop: bob + (to.sit ? (EYE - SIT_EYE) * sitP : 0) }
  }
}

/** Animated.interpolate üçün nümunələr: girişlər və hər qatın k / tx / ty çıxışları. */
export function sampleLayer(path: (p: number) => Cam, zl: number, w: number, h: number, n = 24) {
  const input: number[] = []
  const k: number[] = []
  const tx: number[] = []
  const ty: number[] = []
  for (let i = 0; i <= n; i++) {
    const p = i / n
    const t = layerAt(zl, path(p), w, h)
    input.push(p); k.push(t.k); tx.push(t.tx); ty.push(t.ty)
  }
  return { input, k, tx, ty }
}

/** Sinif: 3 sıra × 4 parta. Sıra 0 kameraya ən yaxındır. */
export const ROOM = {
  rows: [4.2, 6.0, 7.8],
  cols: [-2.7, -0.9, 0.9, 2.7],
  board: 10,
  halfW: 4,
  height: 3.2,
} as const

export interface Seat { row: number; col: number; no: number; x: number; z: number }

/** Tələbənin partası: həmişə ən yaxın sırada (kamera ora gedir), sütun tələbə nömrəsinə görə. Nömrə 1-dən başlayır. */
export function mySeat(studentNo: number | null | undefined): Seat {
  const n = Math.max(1, Math.floor(Number(studentNo) || 1))
  const col = (n - 1) % ROOM.cols.length
  return { row: 0, col, no: col + 1, x: ROOM.cols[col]!, z: ROOM.rows[0]! }
}

/** Partaya oturmaq üçün kameranın son vəziyyəti (partanın arxasında, göz oturmuş hündürlükdə). */
export function seatCamera(seat: Seat) {
  return { dz: seat.z - 0.95, cx: seat.x, sit: true }
}

export interface Figure { skin: string; hair: string; top: string; style: 0 | 1 | 2; tilt: number }

const SKIN = ['#E9C3A0', '#D9A982', '#C48E68', '#B07A57', '#EBCDB0'] as const
const HAIR = ['#1E1712', '#2C2019', '#4A3121', '#6B4A2E', '#151210', '#3A2A1E'] as const
const TOP = ['#3E5C76', '#7A4B3A', '#4E6B4F', '#5B4A6E', '#8A6A3A', '#2F4858', '#6E3E46', '#46505C'] as const

/** Sinif yoldaşları: toxumdan asılı, hər açılışda eyni (təsadüfi görünür, amma sabitdir). */
export function classmates(seed: number, count: number): Figure[] {
  let x = (seed >>> 0) || 1
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296 }
  return Array.from({ length: count }, () => ({
    skin: SKIN[Math.floor(rnd() * SKIN.length)]!,
    hair: HAIR[Math.floor(rnd() * HAIR.length)]!,
    top: TOP[Math.floor(rnd() * TOP.length)]!,
    style: Math.floor(rnd() * 3) as 0 | 1 | 2,
    tilt: Math.round((rnd() - 0.5) * 8),
  }))
}

/** Dəhliz: fənn qapıları növbə ilə sol/sağ divarda, oxu zalı dəhlizin sonundadır. */
export const HALL = { halfW: 2, height: 3.1, end: 15, first: 3.2, gap: 2.6, doorW: 1.05, doorH: 2.15 } as const

export interface DoorSlot { side: -1 | 1; z: number }

export function doorSlots(n: number): DoorSlot[] {
  return Array.from({ length: n }, (_, i) => ({ side: (i % 2 === 0 ? -1 : 1) as -1 | 1, z: HALL.first + Math.floor(i / 2) * HALL.gap + (i % 2) * 0.9 }))
}

/** Qapıya yaxınlaşma: kamera qapının qarşısına gedir və bir az o tərəfə dönür (yana sürüşmə ilə təqlid). */
export function doorCamera(slot: DoorSlot | 'end') {
  if (slot === 'end') return { dz: HALL.end - 2.4, cx: 0, sit: false }
  return { dz: slot.z - 1.6, cx: slot.side * 1.05, sit: false }
}
