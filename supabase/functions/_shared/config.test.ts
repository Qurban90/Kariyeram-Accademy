import { describe, expect, it, vi } from 'vitest'
import { cachedConfig, compareVersions, configGate, OPEN } from './config.ts'

describe('tətbiq konfiqurasiyası', () => {
  it('versiya müqayisəsi rəqəmlərlədir, mətnlə yox', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('0.9.0', '1.0.0')).toBe(-1)
    expect(compareVersions('zibil', '0.0.1')).toBe(-1)
  })
  it('texniki iş: hamı bloklanır, admin və məlumat hüquqları istisna', () => {
    const cfg = { ...OPEN, maintenance: true }
    expect(configGate('session/start', cfg, '1.0.0')).toMatchObject({ code: 'maintenance', status: 503 })
    expect(configGate('admin/config', cfg, '1.0.0')).toBeNull()
    expect(configGate('account/export', cfg, '1.0.0')).toBeNull()
  })
  it('köhnə klient (və ya başlıqsız klient) yeniləməyə yönləndirilir', () => {
    const cfg = { ...OPEN, minVersion: '1.2.0' }
    expect(configGate('answer', cfg, '1.1.9')).toMatchObject({ code: 'upgrade_required', status: 426 })
    expect(configGate('answer', cfg, null)).toMatchObject({ code: 'upgrade_required' })
    expect(configGate('answer', cfg, '1.2.0')).toBeNull()
    expect(configGate('account/delete', cfg, null)).toBeNull()
  })
  it('keş: TTL ərzində bir yükləmə, eyni anda gələnlər paylaşır, xətada son dəyər', async () => {
    let t = 0
    const load = vi.fn(async () => ({ ...OPEN, minVersion: '1.0.0' }))
    const get = cachedConfig(load, 1000, () => t)
    await Promise.all([get(), get(), get()])
    expect(load).toHaveBeenCalledTimes(1)
    t = 500; await get(); expect(load).toHaveBeenCalledTimes(1)
    t = 1500; load.mockRejectedValueOnce(new Error('db down'))
    expect((await get()).minVersion).toBe('1.0.0')
    const failing = cachedConfig(async () => { throw new Error('x') })
    expect(await failing()).toEqual(OPEN)
  })
  it('fail-closed: naməlum konfiqurasiyada staff MFA məcburidir', async () => {
    expect(OPEN.staffMfaRequired).toBe(true)
    const failing = cachedConfig(async () => { throw new Error('db down') })
    expect((await failing()).staffMfaRequired).toBe(true)
    // Son məlum dəyər qorunur: admin açıq söndürübsə, xəta zamanı da söndürülmüş qalır.
    let t = 0
    const load = vi.fn(async () => ({ ...OPEN, staffMfaRequired: false }))
    const get = cachedConfig(load, 1000, () => t)
    await get()
    t = 1500; load.mockRejectedValueOnce(new Error('db down'))
    expect((await get()).staffMfaRequired).toBe(false)
  })
})
