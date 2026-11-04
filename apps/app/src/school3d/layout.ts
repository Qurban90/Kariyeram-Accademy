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
