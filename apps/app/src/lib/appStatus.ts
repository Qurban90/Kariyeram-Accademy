/**
 * Tətbiq səviyyəsində vəziyyət: texniki iş və ya köhnə versiya. İki mənbə: başlanğıcda app_config (anon oxuma)
 * və istənilən API cavabı (server hər sorğuda yoxlayır). Gate bu vəziyyətə görə ümumi ekran göstərir.
 */
import { compareVersions } from '@karyeram/core/src/version.ts'
import { useSyncExternalStore } from 'react'
import { config } from '../config'
import { supabase } from './supabase'

export type AppStatus = { kind: 'ok' } | { kind: 'maintenance' | 'upgrade_required'; message: string | null }

let status: AppStatus = { kind: 'ok' }
const subs = new Set<() => void>()

export function setAppStatus(s: AppStatus) {
  status = s
  subs.forEach((f) => f())
}

export function useAppStatus(): AppStatus {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => status, () => status)
}

/** app_config-i oxuyur; oxuna bilməsə vəziyyəti dəyişmir (şəbəkə xətası tətbiqi bağlamasın). */
export async function checkAppConfig(): Promise<void> {
  const { data, error } = await supabase.from('app_config').select('min_version, maintenance, message').limit(1).maybeSingle()
  if (error || !data) return
  const c = data as { min_version: string; maintenance: boolean; message: string | null }
  if (compareVersions(config.appVersion, c.min_version) < 0) setAppStatus({ kind: 'upgrade_required', message: c.message })
  else if (c.maintenance) setAppStatus({ kind: 'maintenance', message: c.message })
  else setAppStatus({ kind: 'ok' })
}
