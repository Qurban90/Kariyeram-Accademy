/**
 * Görünüş seçimi: 3D məktəb (defolt) və ya sadə (2D) görünüş. Seçim cihazda saxlanılır və bütün ekranlar üçün ortaqdır.
 * 3D açılmayan cihazda (WebGL xətası) seçim yalnız bu sessiya üçün 2D-yə keçir, yaddaşa yazılmır.
 */
import { useEffect, useState } from 'react'
import { secureStorage } from './storage'

const KEY = 'karyeram.view3d'
let current: boolean | null = null
let loading: Promise<void> | null = null
const subs = new Set<(v: boolean | null) => void>()

function emit(v: boolean) {
  current = v
  subs.forEach((f) => f(v))
}

export function setView3d(v: boolean, persist = true) {
  emit(v)
  if (persist) secureStorage.setItem(KEY, v ? '1' : '0').catch(() => {})
}

/** null: seçim hələ oxunur. */
export function useView3d(): [boolean | null, (v: boolean, persist?: boolean) => void] {
  const [v, set] = useState(current)
  useEffect(() => {
    subs.add(set)
    set(current)
    if (current === null) {
      loading ??= secureStorage.getItem(KEY).then((s) => { if (current === null) emit(s !== '0') }).catch(() => { if (current === null) emit(true) })
    }
    return () => { subs.delete(set) }
  }, [])
  return [v, setView3d]
}
