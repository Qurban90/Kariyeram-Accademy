/**
 * Tətbiq konfiqurasiyası (public.app_config): texniki iş rejimi və minimum klient versiyası.
 * Hər API sorğusunda oxumamaq üçün izolyat daxilində 30 saniyəlik keş; eyni anda gələn sorğular bir yükləməni paylaşır.
 * Konfiqurasiya oxuna bilməsə son məlum dəyər qaytarılır; o da yoxdursa tələbə axını bloklanmır (OPEN),
 * amma staff MFA fail-CLOSED işləyir: naməlum vəziyyətdə məcburi sayılır (staffMfaRequired: true).
 */
import { ApiError } from './errors.ts'

export interface AppConfig { minVersion: string; maintenance: boolean; message: string | null; staffMfaRequired?: boolean }
export const OPEN: AppConfig = { minVersion: '0.0.0', maintenance: false, message: null, staffMfaRequired: true }

export function cachedConfig(load: () => Promise<AppConfig>, ttlMs = 30_000, now: () => number = Date.now) {
  let value: AppConfig | null = null
  let at = 0
  let inflight: Promise<AppConfig> | null = null
  return async (): Promise<AppConfig> => {
    if (value && now() - at < ttlMs) return value
    inflight ??= load()
      .then((v) => { value = v; at = now(); return v })
      .catch(() => value ?? OPEN)
      .finally(() => { inflight = null })
    return inflight
  }
}

/** "1.10.2" > "1.9.9". Formatı pozuq versiya 0.0.0 sayılır. */
export function compareVersions(a: string, b: string): number {
  const p = (v: string) => (/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v) ? v.split('.').map(Number) : [0, 0, 0])
  const x = p(a), y = p(b)
  for (let i = 0; i < 3; i++) if (x[i]! !== y[i]!) return x[i]! < y[i]! ? -1 : 1
  return 0
}

/** Məlumat hüquqları (ixrac, silmə) heç vaxt bloklanmır. Admin marşrutları texniki işdə də işləyir (rejimi söndürmək üçün). */
const ALWAYS = new Set(['account/export', 'account/delete'])

export function configGate(route: string, cfg: AppConfig, appVersion: string | null): ApiError | null {
  if (ALWAYS.has(route)) return null
  if (cfg.maintenance && !route.startsWith('admin/')) return new ApiError('maintenance', 503)
  if (compareVersions(appVersion ?? '0.0.0', cfg.minVersion) < 0) return new ApiError('upgrade_required', 426)
  return null
}
