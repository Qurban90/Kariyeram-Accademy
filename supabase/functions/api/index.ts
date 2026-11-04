// Supabase Edge Function (Deno). Bütün tələbə əməliyyatları buradan keçir.
// POST /functions/v1/api/<route>  Authorization: Bearer <istifadəçi JWT>
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ApiError, routes, type Db } from '../_shared/handlers.ts'

const url = Deno.env.get('SUPABASE_URL')!
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const db: Db = {
  async rpc(fn, args) {
    const { data, error } = await service.rpc(fn, args)
    if (error) throw new ApiError(error.message, 500)
    return data
  },
}
const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const route = new URL(req.url).pathname.split('/api/')[1] as keyof typeof routes
  const handler = routes[route]
  if (!handler) return json({ error: 'not_found' }, 404)
  const jwt = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  const { data: user, error } = await service.auth.getUser(jwt)
  if (error || !user.user) return json({ error: 'unauthorized' }, 401)
  try {
    const body = await req.json().catch(() => ({}))
    return json(await (handler as (db: Db, s: string, b: unknown) => Promise<unknown>)(db, user.user.id, body))
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.code }, e.status)
    console.error(e)
    return json({ error: 'internal' }, 500)
  }
})
