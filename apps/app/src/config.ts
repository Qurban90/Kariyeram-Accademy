/** Mühit konfiqurasiyası. EXPO_PUBLIC_* dəyişənləri build zamanı paketə yazılır: burada SİR saxlanmır. */
import Constants from 'expo-constants'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const config = {
  supabaseUrl: url.replace(/\/+$/, ''),
  /** Anon açar ictimaidir (RLS qoruyur); service_role heç vaxt klientə düşməməlidir. */
  supabaseAnonKey: anonKey,
  apiBase: `${url.replace(/\/+$/, '')}/functions/v1/api`,
  brand: 'Karyeram Academy',
  /** app.json "version": serverə x-app-version başlığı ilə gedir (minimum versiya yoxlaması). */
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  /** Sorğu vaxt limiti (ms). */
  requestTimeoutMs: 15_000,
} as const

export const configError = !url || !anonKey
  ? 'EXPO_PUBLIC_SUPABASE_URL və EXPO_PUBLIC_SUPABASE_ANON_KEY təyin edilməyib (apps/app/.env).'
  : null
