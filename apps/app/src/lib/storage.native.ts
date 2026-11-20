/**
 * Native: SecureStore (iOS Keychain, Android Keystore ilə şifrələnmiş).
 * SecureStore bir dəyər üçün ~2 KB tövsiyə edir; Supabase sessiyası daha böyük ola bilər,
 * ona görə dəyəri hissələrə bölürük: key.n = hissə sayı, key.0..key.(n-1) = hissələr.
 *
 * Yazı ardıcıllığı: hissələr əvvəl yazılır, `.n` ən sonda (commit nişanı). Köhnə hissələr silinmir əvvəl —
 * yarımçıq yazı zamanı köhnə sessiya oxuna bilən qalır. Eyni açar üçün oxu/yazılar növbəyə alınır.
 */
import * as SecureStore from 'expo-secure-store'
import type { KV } from './storage'

const CHUNK = 1800
const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_')
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

/** Eyni açar üzrə əməliyyatlar serialdır: paralel setItem/getItem sessiyanı zədələmir. */
const locks = new Map<string, Promise<unknown>>()
function serialized<T>(base: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(base) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  locks.set(base, next.then(() => undefined, () => undefined))
  return next
}

export const secureStorage: KV = {
  getItem(key) {
    const base = safe(key)
    return serialized(base, async () => {
      const n = Number(await SecureStore.getItemAsync(`${base}.n`, opts))
      if (!n) return null
      const parts: string[] = []
      for (let i = 0; i < n; i++) {
        const p = await SecureStore.getItemAsync(`${base}.${i}`, opts)
        if (p === null) return null // yarımçıq yazı: sessiya yoxdur kimi qəbul et
        parts.push(p)
      }
      return parts.join('')
    })
  },
  setItem(key, value) {
    const base = safe(key)
    return serialized(base, async () => {
      const oldN = Number(await SecureStore.getItemAsync(`${base}.n`, opts)) || 0
      const n = Math.max(1, Math.ceil(value.length / CHUNK))
      for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${base}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), opts)
      await SecureStore.setItemAsync(`${base}.n`, String(n), opts) // commit
      // Artıq qalan köhnə hissələri commit-dən sonra təmizlə (uğursuzluq məlumatı pozmur).
      for (let i = n; i < oldN; i++) await SecureStore.deleteItemAsync(`${base}.${i}`, opts).catch(() => {})
    })
  },
  removeItem(key) {
    const base = safe(key)
    return serialized(base, async () => {
      const n = Number(await SecureStore.getItemAsync(`${base}.n`, opts)) || 0
      await SecureStore.deleteItemAsync(`${base}.n`, opts).catch(() => {})
      for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${base}.${i}`, opts).catch(() => {})
    })
  },
}