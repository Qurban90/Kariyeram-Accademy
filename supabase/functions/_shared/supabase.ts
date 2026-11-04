/** Asılılıqsız Supabase klienti (REST): RPC, istifadəçi yoxlaması, admin silmə. Timeout ilə. */
import type { Db } from './handlers.ts'

export interface SupaConfig {
  url: string
  serviceKey: string
  timeoutMs?: number
}

async function call(cfg: SupaConfig, path: string, init: { method: string; headers?: Record<string, string>; body?: string }) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? 8000)
  try {
    return await fetch(`${cfg.url}${path}`, {
      method: init.method,
      headers: { apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}`, 'content-type': 'application/json', ...init.headers },
      body: init.body,
      signal: ctl.signal,
    })
  } finally {
    clearTimeout(t)
  }
}

export function restDb(cfg: SupaConfig): Db {
  return {
    async rpc(fn, args) {
      const req = () => call(cfg, `/rest/v1/rpc/${encodeURIComponent(fn)}`, { method: 'POST', body: JSON.stringify(args) })
      let r: Response
      try {
        r = await req()
      } catch (e) {
        // Yalnız şəbəkə səviyyəsində xəta (bağlantı qırıldı, HTTP cavabı yoxdur): bir dəfə təkrar.
        // RPC-lər təkrara dözümlüdür (submit_answer → out_of_order, razılıq/cihaz idempotent). Timeout (AbortError) təkrar edilmir.
        if (!(e instanceof TypeError)) throw e
        await new Promise((res) => setTimeout(res, 50 + Math.random() * 100))
        r = await req()
      }
      const text = await r.text()
      if (!r.ok) throw new Error(`rpc ${fn}: ${r.status} ${text.slice(0, 200)}`)
      return (text ? JSON.parse(text) : null) as never
    },
  }
}

/** İstifadəçi JWT-sini GoTrue-da yoxlayır (imza, müddət, silinmiş istifadəçi). */
export async function getUserId(cfg: SupaConfig, jwt: string): Promise<string | null> {
  const r = await call(cfg, '/auth/v1/user', { method: 'GET', headers: { authorization: `Bearer ${jwt}` } })
  if (!r.ok) return null
  const u = (await r.json()) as { id?: string }
  return typeof u.id === 'string' ? u.id : null
}

export async function deleteAuthUser(cfg: SupaConfig, id: string): Promise<void> {
  const r = await call(cfg, `/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`auth delete: ${r.status}`)
}

/** Storage (şəxsi bucket): imzalı yükləmə/endirmə ünvanları. Ünvanlar nisbi qaytarılır (/object/...), klient öz Supabase URL-i ilə birləşdirir. */
export interface StorageDeps {
  signDownload(path: string, ttlSeconds: number): Promise<string>
  signUpload(path: string): Promise<{ path: string; token: string }>
  remove(path: string): Promise<void>
}

export function restStorage(cfg: SupaConfig, bucket: string): StorageDeps {
  const p = (path: string) => path.split('/').map(encodeURIComponent).join('/')
  return {
    async signDownload(path, ttl) {
      const r = await call(cfg, `/storage/v1/object/sign/${bucket}/${p(path)}`, { method: 'POST', body: JSON.stringify({ expiresIn: ttl }) })
      if (!r.ok) throw new Error(`storage sign: ${r.status}`)
      const j = (await r.json()) as { signedURL?: string }
      if (!j.signedURL) throw new Error('storage sign: no url')
      return j.signedURL
    },
    async signUpload(path) {
      const r = await call(cfg, `/storage/v1/object/upload/sign/${bucket}/${p(path)}`, { method: 'POST', body: '{}' })
      if (!r.ok) throw new Error(`storage upload sign: ${r.status}`)
      const j = (await r.json()) as { url?: string; token?: string }
      const token = j.token ?? new URL(`http://x${j.url ?? ''}`).searchParams.get('token')
      if (!token) throw new Error('storage upload sign: no token')
      return { path, token }
    },
    async remove(path) {
      const r = await call(cfg, `/storage/v1/object/${bucket}`, { method: 'DELETE', body: JSON.stringify({ prefixes: [path] }) })
      if (!r.ok) throw new Error(`storage remove: ${r.status}`)
    },
  }
}
