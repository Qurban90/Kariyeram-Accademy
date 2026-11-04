// Supabase Edge Function (Deno). Bütün tələbə və müəllim əməliyyatları buradan keçir.
// POST /functions/v1/api/<route>  Authorization: Bearer <istifadəçi JWT>
import { ApiError } from '../_shared/errors.ts'
import { RoomService, type LiveKitConfig } from '../_shared/livekit.ts'
import { dispatch, type Ctx } from '../_shared/router.ts'
import { suspendedGate } from '../_shared/admin.ts'
import { cachedConfig, configGate } from '../_shared/config.ts'
import { mfaGate } from '../_shared/mfa.ts'
import { deleteAuthUser, getAppConfig, getUser, restDb, restStorage, setAuthBan } from '../_shared/supabase.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const supa = { url: env('SUPABASE_URL'), serviceKey: env('SUPABASE_SERVICE_ROLE_KEY') }
const db = restDb(supa)
const lk: LiveKitConfig | null = env('LIVEKIT_URL') && env('LIVEKIT_API_KEY') && env('LIVEKIT_API_SECRET')
  ? { url: env('LIVEKIT_URL'), apiKey: env('LIVEKIT_API_KEY'), apiSecret: env('LIVEKIT_API_SECRET'), publicUrl: env('LIVEKIT_PUBLIC_URL') || undefined }
  : null
const live = { cfg: lk, rooms: lk ? new RoomService(lk) : null }
const admin = { deleteAuthUser: (id: string) => deleteAuthUser(supa, id), setBan: (id: string, h: number | null) => setAuthBan(supa, id, h) }
const storage = restStorage(supa, 'library')
// İstehsalda 30 s; lokal testlərdə qısa (APP_CONFIG_TTL_MS), ki dəyişiklik dərhal yoxlanılsın.
const appConfig = cachedConfig(() => getAppConfig(supa), Number(env('APP_CONFIG_TTL_MS')) || 30_000)

const MAX_BODY = 64 * 1024
/** Mətn konspekti (200 000 simvola qədər) üçün yeganə istisna. */
const MAX_BODY_LIBRARY = 900 * 1024
const origins = env('APP_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean)

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': origins.length === 0 ? '*' : origins.includes(o) ? o : origins[0]!,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-request-id, x-app-version',
    'Access-Control-Expose-Headers': 'x-request-id, content-disposition',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const log = (level: 'info' | 'warn' | 'error', msg: string, data: Record<string, unknown>) =>
  console.log(JSON.stringify({ level, msg, ...data, at: new Date().toISOString() }))

Deno.serve(async (req) => {
  const rid = req.headers.get('x-request-id')?.slice(0, 64) || crypto.randomUUID()
  const headers = { ...cors(req), 'content-type': 'application/json', 'x-request-id': rid, 'cache-control': 'no-store' }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response(null, { headers })
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)

  const route = new URL(req.url).pathname.split('/api/')[1] ?? ''
  // Texniki iş və minimum versiya: auth-dan əvvəl (ucuz, keşlənir), ki texniki işdə GoTrue-ya da yük getməsin.
  const cfg = await appConfig()
  const blocked = configGate(route, cfg, req.headers.get('x-app-version'))
  if (blocked) return reply({ error: blocked.code, message: cfg.message, minVersion: cfg.minVersion, requestId: rid }, blocked.status)
  const jwt = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!jwt) return reply({ error: 'unauthorized' }, 401)
  const user = await getUser(supa, jwt)
  if (!user) return reply({ error: 'unauthorized' }, 401)
  const userId = user.id
  // Admin tərəfindən dayandırılmış hesab: yalnız ixrac və silinmə (DB də öz yoxlamasını edir, bu birinci qatdır).
  if (suspendedGate(route, user.bannedUntil)) return reply({ error: 'suspended', requestId: rid }, 403)
  // Müəllim/admin iki mərhələli qoruma (R-11).
  const mfa = mfaGate(route, user, cfg.staffMfaRequired === true)
  if (mfa) return reply({ error: mfa.code, requestId: rid }, mfa.status)

  const started = Date.now()
  try {
    const raw = await req.text()
    if (raw.length > (route === 'staff/library/add' ? MAX_BODY_LIBRARY : MAX_BODY)) return reply({ error: 'too_large' }, 413)
    const body = raw ? JSON.parse(raw) : {}
    const ctx: Ctx = { db, userId, live, admin, storage, log: (msg, data) => log('error', msg, { rid, ...data }) }
    const out = await dispatch(route, ctx, body)
    log('info', 'api', { rid, route, ms: Date.now() - started })
    // Fayl cavabı (su nişanlı PDF): JSON deyil, baytlar; keşlənmir, çünki hər tələbənin nüsxəsi fərqlidir.
    if (out && typeof out === 'object' && '__file' in out) {
      const f = (out as { __file: { bytes: Uint8Array; contentType: string; filename: string } }).__file
      return new Response(new Uint8Array(f.bytes), { status: 200, headers: { ...headers, 'content-type': f.contentType, 'content-disposition': `inline; filename="${f.filename}"`, 'x-content-type-options': 'nosniff' } })
    }
    return reply(out)
  } catch (e) {
    if (e instanceof ApiError) {
      log('warn', 'api_error', { rid, route, code: e.code, ms: Date.now() - started })
      return reply({ error: e.code, requestId: rid }, e.status)
    }
    if (e instanceof SyntaxError) return reply({ error: 'bad_json', requestId: rid }, 400)
    log('error', 'api_crash', { rid, route, err: String(e).slice(0, 300) })
    return reply({ error: 'internal', requestId: rid }, 500)
  }
})
