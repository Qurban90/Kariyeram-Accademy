/**
 * Native: SecureStore (iOS Keychain, Android Keystore ilə şifrələnmiş).
 * SecureStore bir dəyər üçün ~2 KB tövsiyə edir; Supabase sessiyası daha böyük ola bilər,
 * ona görə dəyəri hissələrə bölürük: key.n = hissə sayı, key.0..key.(n-1) = hissələr.
 */
import * as SecureStore from 'expo-secure-store'
import type { KV } from './storage'

const CHUNK = 1800
const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_')
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

async function removeChunks(base: string) {
  const n = Number(await SecureStore.getItemAsync(`${base}.n`, opts)) || 0
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${base}.${i}`, opts)
  await SecureStore.deleteItemAsync(`${base}.n`, opts)
}

export const secureStorage: KV = {
  async getItem(key) {
    const base = safe(key)
    const n = Number(await SecureStore.getItemAsync(`${base}.n`, opts))
    if (!n) return null
    const parts: string[] = []
    for (let i = 0; i < n; i++) {
      const p = await SecureStore.getItemAsync(`${base}.${i}`, opts)
      if (p === null) return null // yarımçıq yazı: sessiya yoxdur kimi qəbul et
      parts.push(p)
    }
    return parts.join('')
  },
  async setItem(key, value) {
    const base = safe(key)
    await removeChunks(base)
    const n = Math.max(1, Math.ceil(value.length / CHUNK))
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${base}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), opts)
    await SecureStore.setItemAsync(`${base}.n`, String(n), opts)
  },
  async removeItem(key) {
    await removeChunks(safe(key))
  },
}
