/**
 * Görünüş seçimi: 3D məktəb və ya sadə (2D) görünüş. Seçim cihazda saxlanılır və bütün ekranlar üçün ortaqdır.
 * Defolt: vebdə 3D; telefonda (native) sadə görünüş, çünki 3D real cihazlarda hələ yoxlanılır və zəif telefonu dondura bilir.
 *
 * Qoruma (yalnız native): 3D səhnə açılmazdan əvvəl "açılır" nişanı yazılır və səhnə sabit işləyəndə silinir.
 * Tətbiq 3D açılarkən donub bağlanarsa nişan qalır; növbəti açılışda tətbiq sadə görünüşə qayıdır, yoxsa hər açılışda yenə donardı.
 */
import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { secureStorage } from './storage'

const KEY = 'karyeram.view3d'
const PENDING = 'karyeram.view3d.pending'
const native = Platform.OS !== 'web'
let current: boolean | null = null
let loading: Promise<void> | null = null
/** Əvvəlki açılışda 3D yarımçıq qalıb (donma və ya bağlanma): istifadəçiyə bir dəfə bildirilir. */
let fellBack = false
const subs = new Set<(v: boolean | null) => void>()

function emit(v: boolean) {
  current = v
  subs.forEach((f) => f(v))
}

export function setView3d(v: boolean, persist = true) {
  emit(v)
  if (persist) secureStorage.setItem(KEY, v ? '1' : '0').catch(() => {})
}

async function load() {
  try {
    const [saved, pending] = await Promise.all([secureStorage.getItem(KEY), native ? secureStorage.getItem(PENDING) : Promise.resolve(null)])
    if (current !== null) return
    if (pending === '1') {
      fellBack = true
      await secureStorage.setItem(KEY, '0').catch(() => {})
      await secureStorage.removeItem(PENDING).catch(() => {})
      emit(false)
      return
    }
    emit(saved === null ? !native : saved === '1')
  } catch {
    if (current === null) emit(!native)
  }
}

/** null: seçim hələ oxunur. */
export function useView3d(): [boolean | null, (v: boolean, persist?: boolean) => void] {
  const [v, set] = useState(current)
  useEffect(() => {
    subs.add(set)
    set(current)
    if (current === null) loading ??= load()
    return () => { subs.delete(set) }
  }, [])
  return [v, setView3d]
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
