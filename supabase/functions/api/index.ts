// Supabase Edge Function (Deno). Bütün tələbə və müəllim əməliyyatları buradan keçir.
// POST /functions/v1/api/<route>  Authorization: Bearer <istifadəçi JWT>
import { ApiError } from '../_shared/errors.ts'
import { RoomService, type LiveKitConfig } from '../_shared/livekit.ts'
import { dispatch, type Ctx } from '../_shared/router.ts'
import { deleteAuthUser, getUserId, restDb } from '../_shared/supabase.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const supa = { url: env('SUPABASE_URL'), serviceKey: env('SUPABASE_SERVICE_ROLE_KEY') }
const db = restDb(supa)
const lk: LiveKitConfig | null = env('LIVEKIT_URL') && env('LIVEKIT_API_KEY') && env('LIVEKIT_API_SECRET')
  ? { url: env('LIVEKIT_URL'), apiKey: env('LIVEKIT_API_KEY'), apiSecret: env('LIVEKIT_API_SECRET') }
  : null
const live = { cfg: lk, rooms: lk ? new RoomService(lk) : null }
const admin = { deleteAuthUser: (id: string) => deleteAuthUser(supa, id) }

const MAX_BODY = 64 * 1024
const origins = env('APP_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean)

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': origins.length === 0 ? '*' : origins.includes(o) ? o : origins[0]!,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-request-id',
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
  const jwt = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!jwt) return reply({ error: 'unauthorized' }, 401)
  const userId = await getUserId(supa, jwt)
  if (!userId) return reply({ error: 'unauthorized' }, 401)

  const started = Date.now()
  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY) return reply({ error: 'too_large' }, 413)
    const body = raw ? JSON.parse(raw) : {}
    const ctx: Ctx = { db, userId, live, admin }
    const out = await dispatch(route, ctx, body)
    log('info', 'api', { rid, route, ms: Date.now() - started })
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
