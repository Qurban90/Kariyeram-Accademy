/** Asılılıqsız Supabase klienti (REST): RPC, istifadəçi yoxlaması, admin silmə. Timeout ilə. */
import type { Db } from './handlers.ts'
import { jwtClaims } from './mfa.ts'

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

export interface AuthUser { id: string; bannedUntil: string | null; aal: string; hasMfa: boolean }

/**
 * İstifadəçi JWT-sini GoTrue-da yoxlayır (imza, müddət, silinmiş istifadəçi, ləğv olunmuş sessiya).
 * Yerli imza yoxlamasından bir şəbəkə gedişi bahadır, amma "bütün cihazlardan çıxış" və silinmə dərhal işləyir (ADR-0007).
 */
export async function getUser(cfg: SupaConfig, jwt: string): Promise<AuthUser | null> {
  const r = await call(cfg, '/auth/v1/user', { method: 'GET', headers: { authorization: `Bearer ${jwt}` } })
  if (!r.ok) return null
  const u = (await r.json()) as { id?: string; banned_until?: string | null; factors?: { status?: string }[] | null }
  if (typeof u.id !== 'string') return null
  // Token GoTrue-da yoxlandı; aal (autentifikasiya səviyyəsi) onun claim-indədir.
  const aal = jwtClaims(jwt).aal
  return {
    id: u.id,
    bannedUntil: typeof u.banned_until === 'string' ? u.banned_until : null,
    aal: typeof aal === 'string' ? aal : 'aal1',
    hasMfa: Array.isArray(u.factors) && u.factors.some((f) => f?.status === 'verified'),
  }
}

/** Tətbiq konfiqurasiyası (tək sətir). */
export async function getAppConfig(cfg: SupaConfig): Promise<{ minVersion: string; maintenance: boolean; message: string | null; staffMfaRequired: boolean }> {
  const r = await call(cfg, '/rest/v1/app_config?select=min_version,maintenance,message,staff_mfa_required&limit=1', { method: 'GET' })
  if (!r.ok) throw new Error(`app_config: ${r.status}`)
  const rows = (await r.json()) as { min_version: string; maintenance: boolean; message: string | null; staff_mfa_required: boolean }[]
  const c = rows[0]
  if (!c) throw new Error('app_config: empty')
  // Fail-closed: sütun yoxdursa və ya null-dursa MFA məcburi sayılır; yalnız açıq `false` söndürür.
  return { minVersion: c.min_version, maintenance: c.maintenance, message: c.message, staffMfaRequired: c.staff_mfa_required !== false }
}

/** GoTrue qadağası: yeni giriş və token yeniləmə bloklanır. hours = null qadağanı götürür. */
export async function setAuthBan(cfg: SupaConfig, id: string, hours: number | null): Promise<void> {
  const r = await call(cfg, `/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify({ ban_duration: hours === null ? 'none' : `${hours}h` }),
  })
  if (!r.ok) throw new Error(`auth ban: ${r.status}`)
}

export async function deleteAuthUser(cfg: SupaConfig, id: string): Promise<void> {
  const r = await call(cfg, `/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`auth delete: ${r.status}`)
}

/** Storage (şəxsi bucket): müəllim üçün imzalı yükləmə ünvanı; endirmə yalnız serverdə (klientə birbaşa fayl ünvanı verilmir). */
export interface StorageDeps {
  /** Faylın özü (yalnız server oxuyur; məs. su nişanı vurmaq üçün). */
  download(path: string): Promise<Uint8Array>
  signUpload(path: string): Promise<{ path: string; token: string }>
  remove(path: string): Promise<void>
}

export function restStorage(cfg: SupaConfig, bucket: string): StorageDeps {
  const p = (path: string) => path.split('/').map(encodeURIComponent).join('/')
  return {
    async download(path) {
      const r = await call(cfg, `/storage/v1/object/${bucket}/${p(path)}`, { method: 'GET' })
      if (!r.ok) throw new Error(`storage download: ${r.status}`)
      return new Uint8Array(await r.arrayBuffer())
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
