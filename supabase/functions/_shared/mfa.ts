/**
 * İki mərhələli qoruma qapısı (R-11). aal JWT-dən oxunur: token əvvəlcə GoTrue-da yoxlanır, ona görə claim-ə etibar etmək olar.
 *   * admin/*: həmişə aal2.
 *   * staff/* və live/create: aal2, əgər istifadəçi MFA qoşubsa və ya admin hamı üçün məcburi edibsə.
 * Sual bankının birbaşa (RLS) oxunmasında eyni qayda DB-dədir (_staff_aal_ok).
 */
import { ApiError } from './errors.ts'

export function jwtClaims(jwt: string): Record<string, unknown> {
  try {
    const p = jwt.split('.')[1] ?? ''
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (p.length % 4)) % 4)
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
    const v = JSON.parse(json)
    return v && typeof v === 'object' ? v as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

const STAFF = (route: string) => route.startsWith('staff/') || route === 'live/create'

export function mfaGate(route: string, u: { aal: string; hasMfa: boolean }, staffMfaRequired = true): ApiError | null {
  if (u.aal === 'aal2') return null
  if (route.startsWith('admin/')) return new ApiError('mfa_required', 403)
  if (STAFF(route) && (u.hasMfa || staffMfaRequired)) return new ApiError('mfa_required', 403)
  return null
}
