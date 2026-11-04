import { afterEach, describe, expect, it, vi } from 'vitest'
import { restDb } from './supabase.ts'

afterEach(() => vi.unstubAllGlobals())

describe('restDb', () => {
  it('bağlantı qırılanda bir dəfə təkrar edir', async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', f)
    expect(await restDb({ url: 'http://x', serviceKey: 'k' }).rpc('fn', {})).toEqual({ ok: true })
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('HTTP xətası və ikinci qırılma təkrar edilmir', async () => {
    const f = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }))
    vi.stubGlobal('fetch', f)
    await expect(restDb({ url: 'http://x', serviceKey: 'k' }).rpc('fn', {})).rejects.toThrow(/500/)
    expect(f).toHaveBeenCalledTimes(1)
    const g = vi.fn().mockRejectedValue(new TypeError('down'))
    vi.stubGlobal('fetch', g)
    await expect(restDb({ url: 'http://x', serviceKey: 'k' }).rpc('fn', {})).rejects.toThrow(TypeError)
    expect(g).toHaveBeenCalledTimes(2)
  })
})
