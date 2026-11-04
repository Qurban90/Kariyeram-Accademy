/** 3D dəhlizin saf həndəsəsi (render-dən asılı deyil, test olunur). Vahid: metr. Dəhliz -Z istiqamətində uzanır. */
export const CORRIDOR_WIDTH = 4
export const DOOR_SPACING = 4.5
export const EYE_HEIGHT = 1.6

export interface DoorSpot { index: number; side: -1 | 1; x: number; z: number; rotY: number }

/** Qapılar növbə ilə sağ (+1) və sol (-1) divarda, cüt-cüt irəli. */
export function doorSpots(n: number): DoorSpot[] {
  return Array.from({ length: n }, (_, i) => {
    const side = (i % 2 === 0 ? 1 : -1) as -1 | 1
    const z = -3 - Math.floor(i / 2) * DOOR_SPACING
    return { index: i, side, x: side * (CORRIDOR_WIDTH / 2 - 0.02), z, rotY: side === 1 ? -Math.PI / 2 : Math.PI / 2 }
  })
}

/** Dəhlizin uzunluğu: son qapılardan sonra oxu zalının qapısına qədər. */
export function corridorLength(n: number): number {
  return 6 + Math.ceil(Math.max(n, 1) / 2) * DOOR_SPACING
}

/** Qapıya yaxınlaşanda kameranın dayanacağı nöqtə və baxış istiqaməti (yaw). */
export function standBefore(d: { x: number; z: number; side: -1 | 1 }): { x: number; z: number; yaw: number } {
  return { x: d.side * 0.4, z: d.z, yaw: d.side === 1 ? -Math.PI / 2 : Math.PI / 2 }
}

/** Kameranı hədəfə doğru hamar aparır (çərçivə sürətindən asılı olmayan eksponensial yaxınlaşma). */
export function approach(cur: number, target: number, dt: number, speed = 3): number {
  return target + (cur - target) * Math.exp(-speed * dt)
}

/** Bucaq fərqi [-π, π] aralığında (qısa yolla dönmək üçün). */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return d
}

/** Sinif: lövhə -Z tərəfdə (z = -4.5), partalar sıra-sıra arxaya. Yer nömrəsi 1-dən: ön sıra soldan sağa. */
export const CLASS_PER_ROW = 6
export function classroomSeat(seat: number, perRow = CLASS_PER_ROW): { x: number; z: number } {
  const i = Math.max(0, seat - 1)
  const row = Math.floor(i / perRow), col = i % perRow
  const gap = 1.3
  return { x: (col - (perRow - 1) / 2) * gap, z: -1.5 + row * 1.5 }
}

function hashOf(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

/** İştirakçı rəngi: identity-dən sabit (eyni tələbə hər dəfə eyni rəngdə). */
export function colorFor(id: string): string {
  return `hsl(${hashOf(id) % 360}, 45%, 55%)`
}

const SKIN = ['#f1d3b3', '#e6bf98', '#d3a27a', '#b9845d', '#f5dcc6'] as const
const HAIR = ['#2b1d14', '#4a3121', '#6b4423', '#17130f', '#8a6a3e', '#3b2b22'] as const

/** Avatarın görünüşü identity-dən sabit seçilir: köynək, dəri və saç rəngi. Şəxsi məlumat istifadə olunmur. */
export function paletteFor(id: string): { shirt: string; skin: string; hair: string } {
  // Qısa identity-lərdə xam hash kiçik olur və yuxarı bitləri sıfırdır; murmur3 "fmix" bitləri qarışdırır.
  let h = hashOf(id)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return { shirt: colorFor(id), skin: SKIN[(h >>> 9) % SKIN.length]!, hair: HAIR[(h >>> 13) % HAIR.length]! }
}
