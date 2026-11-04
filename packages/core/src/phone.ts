/**
 * Azərbaycan mobil nömrəsinin normallaşdırılması (E.164: +994XXXXXXXXX).
 * Qəbul edilən yazılışlar: "050 123 45 67", "(050) 123-45-67", "501234567", "+994 50 123 45 67", "00994501234567".
 * Yalnız mobil operator prefiksləri qəbul olunur, çünki SMS OTP stasionar nömrəyə gəlmir.
 */
export const AZ_MOBILE_PREFIXES = ['10', '50', '51', '55', '60', '70', '77', '99'] as const

export type PhoneResult = { ok: true; e164: string; display: string } | { ok: false; reason: 'empty' | 'format' | 'prefix' }

export function normalizeAzPhone(input: string): PhoneResult {
  const raw = input.trim()
  if (!raw) return { ok: false, reason: 'empty' }
  if (/[^\d\s()+\-.]/.test(raw)) return { ok: false, reason: 'format' }
  let d = raw.replace(/\D/g, '')
  if (raw.startsWith('+')) {
    if (!d.startsWith('994')) return { ok: false, reason: 'format' }
    d = d.slice(3)
  } else if (d.startsWith('00994')) d = d.slice(5)
  else if (d.startsWith('994') && d.length === 12) d = d.slice(3)
  else if (d.startsWith('0') && d.length === 10) d = d.slice(1)
  if (!/^\d{9}$/.test(d)) return { ok: false, reason: 'format' }
  const op = d.slice(0, 2)
  if (!(AZ_MOBILE_PREFIXES as readonly string[]).includes(op)) return { ok: false, reason: 'prefix' }
  return { ok: true, e164: `+994${d}`, display: `+994 ${op} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` }
}

/** Ekranda göstərmək üçün nömrənin ortasını gizlədir: +994 50 *** ** 67 */
export function maskPhone(e164: string): string {
  const m = /^\+?994(\d{2})\d{5}(\d{2})$/.exec(e164.replace(/\s/g, ''))
  return m ? `+994 ${m[1]} *** ** ${m[2]}` : e164
}

/** Sadə e-poçt yoxlaması (son yoxlama GoTrue-dadır). */
export function isEmail(s: string): boolean {
  const v = s.trim()
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}
