/**
 * Cihaz identifikatoru: təsadüfi 32 simvol (128 bit), cihazda saxlanılır.
 * Bu, aparat ID-si deyil (IMEI və reklam ID-si toplanmır, PRIV-001). Tətbiq silinəndə yenilənir.
 * Server tək aktiv cihaz qaydasını bu ID ilə tətbiq edir (FR-008).
 */
import * as Crypto from 'expo-crypto'
import { secureStorage } from './storage'

const KEY = 'karyeram.device'
let cached: string | null = null
let pending: Promise<string> | null = null

export function newDeviceId(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function getDeviceId(): Promise<string> {
  if (cached) return Promise.resolve(cached)
  // Paralel çağırışlar iki fərqli ID yaratmasın: birinci çağırışın promise-i paylaşılır.
  pending ??= (async () => {
    const stored = await secureStorage.getItem(KEY)
    if (stored && /^[A-Za-z0-9_-]{8,128}$/.test(stored)) return (cached = stored)
    const id = newDeviceId(Crypto.getRandomBytes(16))
    await secureStorage.setItem(KEY, id)
    return (cached = id)
  })().finally(() => { pending = null })
  return pending
}
