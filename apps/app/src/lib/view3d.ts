/**
 * Görünüş seçimi (cihazda saxlanılır, bütün ekranlar üçün ortaqdır):
 * - 'scene': 2.5D məktəb səhnəsi (defolt, hər yerdə): avtomatik giriş, dəhliz, sinif, parta. WebGL lazım deyil.
 * - '3d': joystiklə 3D gəzinti (WebGL; telefonda sınaq).
 * - 'simple': animasiyasız siyahı (ekran oxuyucusu və zəif cihaz üçün).
 *
 * Qoruma (yalnız native): 3D səhnə açılmazdan əvvəl "açılır" nişanı yazılır və səhnə sabit işləyəndə silinir.
 * Tətbiq 3D açılarkən donub bağlanarsa nişan qalır; növbəti açılışda tətbiq 2.5D səhnəyə qayıdır, yoxsa hər açılışda yenə donardı.
 */
import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { secureStorage } from './storage'

export type ViewMode = 'scene' | '3d' | 'simple'
const KEY = 'karyeram.view3d'
const PENDING = 'karyeram.view3d.pending'
const native = Platform.OS !== 'web'
const CODE: Record<ViewMode, string> = { scene: 's', '3d': '1', simple: '0' }
const parse = (v: string | null): ViewMode => (v === '1' ? '3d' : v === '0' ? 'simple' : 'scene')
let current: ViewMode | null = null
let loading: Promise<void> | null = null
/** Əvvəlki açılışda 3D yarımçıq qalıb (donma və ya bağlanma): istifadəçiyə bir dəfə bildirilir. */
let fellBack = false
const subs = new Set<(v: ViewMode | null) => void>()

function emit(v: ViewMode) {
  current = v
  subs.forEach((f) => f(v))
}

export function setViewMode(v: ViewMode, persist = true) {
  emit(v)
  if (persist) secureStorage.setItem(KEY, CODE[v]).catch(() => {})
}

/** Köhnə API: true → 3D gəzinti, false → sadə görünüş. */
export function setView3d(v: boolean, persist = true) {
  setViewMode(v ? '3d' : 'simple', persist)
}

async function load() {
  try {
    const [saved, pending] = await Promise.all([secureStorage.getItem(KEY), native ? secureStorage.getItem(PENDING) : Promise.resolve(null)])
    if (current !== null) return
    if (pending === '1') {
      // 3D açılarkən donub: WebGL-siz 2.5D səhnəyə qayıdırıq.
      fellBack = true
      await secureStorage.setItem(KEY, CODE.scene).catch(() => {})
      await secureStorage.removeItem(PENDING).catch(() => {})
      emit('scene')
      return
    }
    emit(parse(saved))
  } catch {
    if (current === null) emit('scene')
  }
}

/** null: seçim hələ oxunur. */
export function useViewMode(): [ViewMode | null, (v: ViewMode, persist?: boolean) => void] {
  const [v, set] = useState(current)
  useEffect(() => {
    subs.add(set)
    set(current)
    if (current === null) loading ??= load()
    return () => { subs.delete(set) }
  }, [])
  return [v, setViewMode]
}

/** Köhnə API: 3D gəzinti seçilibmi (null: hələ oxunur). */
export function useView3d(): [boolean | null, (v: boolean, persist?: boolean) => void] {
  const [m] = useViewMode()
  return [m === null ? null : m === '3d', setView3d]
}

/** Əvvəlki açılışda 3D yarımçıq qalıbsa bir dəfə true qaytarır (bildiriş göstərmək üçün). */
export function take3dFallback(): boolean {
  const f = fellBack
  fellBack = false
  return f
}

/**
 * 3D səhnənin qoruması. `armed` true olandan sonra səhnəni qur (nişan artıq yazılıb); səhnə sabit işləyəndə `settle()` çağır.
 * Vebdə nişan yazılmır (səhifəni yükləmə zamanı bağlamaq donma sayılmamalıdır).
 */
export function use3dGuard(): { armed: boolean; settle: () => void } {
  const [armed, setArmed] = useState(!native)
  useEffect(() => {
    if (!native) return
    let alive = true
    secureStorage.setItem(PENDING, '1').catch(() => {}).then(() => { if (alive) setArmed(true) })
    return () => { alive = false }
  }, [])
  const settle = useCallback(() => { if (native) secureStorage.removeItem(PENDING).catch(() => {}) }, [])
  return { armed, settle }
}
