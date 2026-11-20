import { describe, expect, it } from 'vitest'
import { corsHeaders, MAX_BODY, readBody } from './http.ts'

const req = (body: string | null, headers: Record<string, string> = {}) =>
  new Request('https://x.example/api/answer', { method: 'POST', body, headers })

describe('CORS', () => {
  it('APP_ORIGINS boşdursa ACAO ümumiyyətlə göndərilmir (native app)', () => {
    const h = corsHeaders('https://evil.example', [])
    expect(h['Access-Control-Allow-Origin']).toBeUndefined()
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS')
    expect(h.Vary).toBe('Origin')
  })
  it('icazəli origin əks olunur, naməlum origin üçün ACAO yoxdur', () => {
    const allowed = ['https://app.example.az']
    expect(corsHeaders('https://app.example.az', allowed)['Access-Control-Allow-Origin']).toBe('https://app.example.az')
    const h = corsHeaders('https://evil.example', allowed)
    expect(h['Access-Control-Allow-Origin']).toBeUndefined()
    expect(corsHeaders('', allowed)['Access-Control-Allow-Origin']).toBeUndefined()
  })
})

describe('gövdə limiti', () => {
  it('content-length limitdən böyükdürsə buferləmədən rədd edilir', async () => {
    const r = req('x', { 'content-length': String(MAX_BODY + 1) })
    expect(await readBody(r, MAX_BODY)).toBeNull()
  })
  it('yalan content-length: axın oxunarkən limit yenə işləyir', async () => {
    const big = 'a'.repeat(MAX_BODY + 100)
    const r = req(big, { 'content-length': '10' })
    expect(await readBody(r, MAX_BODY)).toBeNull()
  })
  it('limit daxilində gövdə tam oxunur (UTF-8 daxil)', async () => {
    const body = JSON.stringify({ code: 'ABCD-EFGH-JKLM', ad: 'Tələbə Əli' })
    expect(await readBody(req(body), MAX_BODY)).toBe(body)
    expect(await readBody(req(null), MAX_BODY)).toBe('')
  })
  it('çox hissəli axın da sayılır', async () => {
    const chunk = new Uint8Array(40 * 1024).fill(65)
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(chunk); c.enqueue(chunk); c.enqueue(chunk); c.close() },
    })
    const r = new Request('https://x.example/api/staff/library/add', { method: 'POST', body: stream, duplex: 'half' } as RequestInit)
    expect(await readBody(r, 100 * 1024)).toBeNull() // 120 KB > 100 KB
  })
})