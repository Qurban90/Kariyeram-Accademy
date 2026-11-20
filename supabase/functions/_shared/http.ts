/** HTTP köməkçiləri: CORS və gövdə oxuma (Deno-dan asılı deyil, vitest ilə test olunur). */

export const MAX_BODY = 64 * 1024
/** Mətn konspekti (200 000 simvola qədər) üçün yeganə istisna. */
export const MAX_BODY_LIBRARY = 900 * 1024

/**
 * CORS: APP_ORIGINS verilməyibsə ACAO başlığı ÜMUMİYYƏTLƏ göndərilmir (native tətbiqə CORS lazım deyil,
 * brauzer deploy-u siyahını açıq verir). Naməlum origin üçün də ACAO yoxdur — '*' və ya origins[0] əks olunmur.
 */
export function corsHeaders(origin: string, allowed: string[]): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-request-id, x-app-version',
    'Access-Control-Expose-Headers': 'x-request-id, content-disposition',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && allowed.includes(origin)) return { 'Access-Control-Allow-Origin': origin, ...base }
  return base
}

/**
 * Gövdəni limit daxilində oxuyur. Əvvəlcə content-length yoxlanılır (tam buferləmədən rədd),
 * sonra axın oxunarkən baytlar sayılır — başlıq yalan və ya yoxdursa da limit aşılmır.
 * Limit aşılırsa null qaytarır (413 too_large).
 */
export async function readBody(req: Request, limit: number): Promise<string | null> {
  const cl = req.headers.get('content-length')
  if (cl !== null && /^\d+$/.test(cl) && Number(cl) > limit) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > limit) {
          await reader.cancel().catch(() => {})
          return null
        }
        chunks.push(value)
      }
    }
  } finally {
    reader.releaseLock()
  }
  const buf = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { buf.set(c, off); off += c.byteLength }
  return new TextDecoder().decode(buf)
}