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
      const r = await call(cfg, `/rest/v1/rpc/${encodeURIComponent(fn)}`, { method: 'POST', body: JSON.stringify(args) })
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
