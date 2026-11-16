/**
 * Cihaz diaqnostikası (yalnız native). Real telefonda çökməni görmək üçün jurnal (logcat) əlçatan deyil, ona görə tətbiq
 * hər mərhələdə serverə qısa iz buraxır və son izə görə harada dayandığı bilinir.
 *
 * İz necə gedir: `app_config` cədvəlinə adi oxuma sorğusu, mətn `message` süzgəcindədir (heç nə qaytarmır, heç nə yazmır);
 * sorğunun ünvanı Supabase-in giriş jurnalında qalır. Ayrıca server kodu və cədvəl lazım deyil.
 * Məxfilik: izdə yalnız mərhələnin adı, yığımın nömrəsi, təsadüfi işə salma nömrəsi və xətanın mətni olur.
 * İstifadəçi ID-si, e-poçt, kod və token göndərilmir; mətn yalnız hərf, rəqəm və bir neçə durğu işarəsinə qədər təmizlənir.
 */
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { config, configError } from '../config'
import { secureStorage } from './storage'

const on = Platform.OS !== 'web' && !configError
const build = (process.env.EXPO_PUBLIC_BUILD ?? 'dev').slice(0, 7)
const run = Math.random().toString(16).slice(2, 8)
let seq = 0

const clean = (s: unknown, max: number) => String(s ?? '').replace(/[^A-Za-z0-9 _.:/()=-]/g, '_').slice(0, max)

/** Mərhələ izi. Gözləmir və heç vaxt xəta atmır. */
export function crumb(stage: string, detail: unknown = '') {
  if (!on) return
  const msg = `diag|${build}|${run}|${++seq}|${clean(stage, 40)}|${clean(detail, 170)}`
  try {
    void fetch(`${config.supabaseUrl}/rest/v1/app_config?select=min_version&limit=1&message=eq.${encodeURIComponent(msg)}`, {
      headers: { apikey: config.supabaseAnonKey },
    }).catch(() => {})
  } catch { /* şəbəkə yoxdur */ }
}

/* ───────────── JS xətalarının tutulması ───────────── */

export interface Crash { message: string; stack: string }
let crash: Crash | null = null
const crashSubs = new Set<(c: Crash | null) => void>()

interface ErrorUtilsLike { getGlobalHandler?: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler?: (h: (e: unknown, fatal?: boolean) => void) => void }

/**
 * Buraxılış yığımında tutulmayan JS xətası tətbiqi dərhal bağlayır ("App keeps stopping"). Burada xəta qeydə alınır,
 * serverə iz gedir və tətbiq bağlanmaq əvəzinə xəta ekranını göstərir (mətn görünür, ekran şəkli çəkmək olur).
 */
export function installCrashCapture() {
  if (!on) return
  const eu = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils
  const prev = eu?.getGlobalHandler?.()
  eu?.setGlobalHandler?.((e, fatal) => {
    const err = e as { message?: unknown; stack?: unknown } | null
    const c: Crash = { message: String(err?.message ?? e).slice(0, 400), stack: String(err?.stack ?? '').split('\n').slice(0, 8).join('\n') }
    crumb(fatal ? 'js_fatal' : 'js_error', c.message)
    crumb('js_stack', c.stack.replace(/\n/g, ' / '))
    if (fatal && !__DEV__) { crash = c; crashSubs.forEach((f) => f(c)); return }
    prev?.(e, fatal)
  })
}

export function useCrash(): [Crash | null, () => void] {
  const [c, set] = useState(crash)
  useEffect(() => { crashSubs.add(set); set(crash); return () => { crashSubs.delete(set) } }, [])
  return [c, () => { crash = null; crashSubs.forEach((f) => f(null)) }]
}

/* ───────────── Əsas ekranın açılış cəhdləri ───────────── */

const HALL_KEY = 'karyeram.hall'
let attempt: Promise<number> | null = null

/**
 * Əsas ekran açılmazdan əvvəl çağırılır. Qaytardığı ədəd: bundan əvvəl ardıcıl neçə dəfə əsas ekran açılıb sabit
 * vəziyyətə çatmadan tətbiq bağlanıb (çökmə və ya donma). 0: adi açılış; 1: mərhələli diaqnostik açılış; 2+: ən sadə ekran.
 * Vebdə həmişə 0.
 */
export function hallAttempt(): Promise<number> {
  if (!on) return Promise.resolve(0)
  return (attempt ??= (async () => {
    let fails = 0
    try {
      const p = JSON.parse((await secureStorage.getItem(HALL_KEY)) ?? 'null') as { state?: string; fails?: number } | null
      if (p?.state === 'opening') fails = Math.min(9, (Number(p.fails) || 0) + 1)
    } catch { /* zədəli qeyd: sıfırdan */ }
    await secureStorage.setItem(HALL_KEY, JSON.stringify({ state: 'opening', fails })).catch(() => {})
    crumb('hall_attempt', `fails=${fails}`)
    return fails
  })())
}

/** Əsas ekran bir neçə saniyə sabit işlədi: növbəti açılış adi olacaq. */
export function hallStable() {
  if (!on) return
  secureStorage.setItem(HALL_KEY, JSON.stringify({ state: 'ok', fails: 0 })).catch(() => {})
  crumb('hall_stable')
}

/** İstifadəçi tam görünüşü yenidən sınamaq istəyir. */
export async function hallReset() {
  attempt = null
  await secureStorage.setItem(HALL_KEY, JSON.stringify({ state: 'ok', fails: 0 })).catch(() => {})
  crumb('hall_reset')
}
