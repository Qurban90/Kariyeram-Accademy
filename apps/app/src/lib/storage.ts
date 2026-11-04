/**
 * Veb: localStorage. Brauzer məxfi rejimində və ya bloklananda yaddaş olmaya bilər, ona görə hər əməliyyat try/catch-dədir.
 * Native versiya: storage.native.ts (SecureStore, Keychain/Keystore).
 */
export interface KV {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const mem = new Map<string, string>()

export const secureStorage: KV = {
  async getItem(k) {
    try { return globalThis.localStorage?.getItem(k) ?? mem.get(k) ?? null } catch { return mem.get(k) ?? null }
  },
  async setItem(k, v) {
    try { globalThis.localStorage?.setItem(k, v) } catch { /* yaddaş bloklanıb */ }
    mem.set(k, v)
  },
  async removeItem(k) {
    try { globalThis.localStorage?.removeItem(k) } catch { /* yaddaş bloklanıb */ }
    mem.delete(k)
  },
}
