// LiveKit webhook: imza + gövdə hash + köhnəlmə yoxlanır, hadisə ID-si ilə idempotent işlənir.
import { verifyWebhook } from '../_shared/livekit.ts'
import { restDb } from '../_shared/supabase.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const db = restDb({ url: env('SUPABASE_URL'), serviceKey: env('SUPABASE_SERVICE_ROLE_KEY') })
const cfg = { url: env('LIVEKIT_URL'), apiKey: env('LIVEKIT_API_KEY'), apiSecret: env('LIVEKIT_API_SECRET') }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })
  const raw = await req.text()
  let ev
  try {
    ev = await verifyWebhook(cfg, raw, req.headers.get('authorization'))
  } catch (e) {
    console.log(JSON.stringify({ level: 'warn', msg: 'webhook_rejected', reason: String(e) }))
    return new Response('unauthorized', { status: 401 })
  }
  if (!ev.id || !ev.event) return new Response('bad event', { status: 400 }) // təkrar göndərməyə dəyməz
  const identity = ev.participant?.identity && UUID.test(ev.participant.identity) ? ev.participant.identity : null
  const at = ev.createdAt ? new Date(Number(ev.createdAt) * 1000).toISOString() : new Date().toISOString()
  try {
    await db.rpc('live_webhook_event', { p_event_id: ev.id, p_kind: ev.event, p_room: ev.room?.name ?? '', p_identity: identity, p_at: at })
  } catch (e) {
    console.log(JSON.stringify({ level: 'error', msg: 'webhook_db', err: String(e).slice(0, 200) }))
    return new Response('retry', { status: 500 }) // LiveKit təkrar göndərəcək; idempotentdir
  }
  return new Response('ok')
})
