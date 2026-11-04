/**
 * Admin otağı (FR-064): istifadəçi axtarışı, dayandırma/bərpa, rol (tələbə ↔ müəllim), audit jurnalı.
 * İcazə serverdə yoxlanır (is_admin); bu ekran yalnız rahatlıq üçündür. Əlaqə məlumatları maskalı gəlir.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import { Button, Card, Chip, ErrorBox, Field, H, Loading, P, Screen } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { api, ApiFailure, type AdminUser } from '../src/lib/api'
import { checkAppConfig } from '../src/lib/appStatus'
import { supabase } from '../src/lib/supabase'
import { config } from '../src/config'
import { colors, space } from '../src/theme'
import { fmtDateTime } from '../src/lib/dates'

const msg = (e: unknown) => (e instanceof ApiFailure ? e.message : e instanceof Error ? e.message : String(e))
const HOURS = [24, 168, 720, 8760] as const
const fmt = fmtDateTime

export default function Admin() {
  const [tab, setTab] = useState<'users' | 'audit' | 'app'>('users')
  return (
    <Screen back title={t.admin.title}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip testID="tab-users" label={t.admin.users} selected={tab === 'users'} onPress={() => setTab('users')} />
        <Chip testID="tab-audit" label={t.admin.audit} selected={tab === 'audit'} onPress={() => setTab('audit')} />
        <Chip testID="tab-app" label={t.admin.app} selected={tab === 'app'} onPress={() => setTab('app')} />
      </View>
      {/* İstifadəçilər bölməsi gizlədilir, silinmir: tab dəyişəndə axtarış və nəticələr itməsin. */}
      <View style={tab === 'users' ? undefined : { display: 'none' }}><Users /></View>
      {tab === 'audit' ? <Audit /> : tab === 'app' ? <AppConfig /> : null}
    </Screen>
  )
}

function Users() {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const search = async () => {
    if (!q.trim()) return
    setBusy(true); setErr(null)
    try { setUsers((await api.adminFind(q.trim())).users) } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }
  const replace = (u: AdminUser) => setUsers((xs) => (xs ?? []).map((x) => (x.id === u.id ? u : x)))
  return (
    <View style={{ gap: space.md }}>
      <Field testID="admin-q" label={t.admin.search} placeholder={t.admin.searchPh} value={q} onChangeText={setQ}
        autoCapitalize="none" autoCorrect={false} maxLength={120} onSubmitEditing={search} returnKeyType="search" />
      <Button testID="admin-search" label={t.admin.search} onPress={search} loading={busy} />
      <ErrorBox message={err} />
      <P dim small>{t.admin.adminNote}</P>
      {users && users.length === 0 && <P dim>{t.admin.none}</P>}
      {(users ?? []).map((u) => <UserCard key={u.id} u={u} onChange={replace} />)}
    </View>
  )
}

function UserCard({ u, onChange }: { u: AdminUser; onChange: (u: AdminUser) => void }) {
  const [reason, setReason] = useState('')
  const [hours, setHours] = useState<number>(24)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const run = async (key: string, f: () => Promise<Partial<AdminUser>>) => {
    setBusy(key); setErr(null); setWarn(null)
    try { onChange({ ...u, ...(await f()) }) } catch (e) { setErr(msg(e)) } finally { setBusy(null) }
  }
  const suspend = () => {
    if (reason.trim().length < 3) { setErr(t.admin.reasonBad); return }
    void run('suspend', async () => {
      const r = await api.adminSuspend(u.id, hours, reason.trim())
      if (!r.authBan) setWarn(t.admin.banWarn)
      setReason('')
      return { suspended_until: r.until, suspension_reason: `admin: ${reason.trim()}` }
    })
  }
  const isAdmin = u.role === 'admin'
  return (
    <Card testID={`admin-user-${u.student_no}`}>
      <H level={3}>{u.display_name || '—'} · № {u.student_no}</H>
      <P dim small>{t.profile.role[u.role]} · {[u.email, u.phone].filter(Boolean).join(' · ')}</P>
      <P small style={{ color: u.suspended_until ? colors.bad : colors.ok }}>
        {u.suspended_until ? `${t.admin.suspendedUntil(fmt(u.suspended_until))} — ${u.suspension_reason ?? ''}` : t.admin.active}
      </P>
      {!isAdmin && (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {u.suspended_until ? (
            <Button small testID="admin-unsuspend" variant="ghost" label={t.admin.unsuspend} loading={busy === 'unsuspend'}
              onPress={() => run('unsuspend', async () => {
                const r = await api.adminUnsuspend(u.id)
                if (!r.authBan) setWarn(t.admin.banWarn)
                return { suspended_until: null, suspension_reason: null }
              })} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                {HOURS.map((h) => <Chip key={h} label={t.admin.hours[h]!} selected={hours === h} onPress={() => setHours(h)} />)}
              </View>
              <Field testID="admin-reason" label={t.admin.reason} value={reason} onChangeText={setReason} maxLength={300} />
              <Button small testID="admin-suspend" variant="danger" label={t.admin.suspend} loading={busy === 'suspend'} onPress={suspend} />
            </>
          )}
          <Button small testID="admin-role" variant="quiet" loading={busy === 'role'}
            label={u.role === 'teacher' ? t.admin.makeStudent : t.admin.makeTeacher}
            onPress={() => run('role', async () => {
              const role = u.role === 'teacher' ? 'student' : 'teacher'
              await api.adminSetRole(u.id, role)
              return { role }
            })} />
        </View>
      )}
      <ErrorBox message={err} />
      {warn ? <P small style={{ color: colors.warn }}>{warn}</P> : null}
    </Card>
  )
}

function Audit() {
  const [kind, setKind] = useState<string | undefined>(undefined)
  const q = useInfiniteQuery({
    queryKey: ['admin-audit', kind],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => api.adminAudit({ kind, before: pageParam }),
    getNextPageParam: (last) => (last.events.length === 50 ? last.events[last.events.length - 1]!.id : undefined),
  })
  const events = q.data?.pages.flatMap((p) => p.events) ?? []
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Chip label={t.admin.allKinds} selected={!kind} onPress={() => setKind(undefined)} />
        {['admin_suspended', 'admin_role', 'suspended_pace', 'device_replaced', 'live_banned', 'client_screenshot'].map((k) => (
          <Chip key={k} label={t.admin.kinds[k] ?? k} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <ErrorBox message={q.error ? msg(q.error) : null} onRetry={q.error ? () => q.refetch() : undefined} />
      {q.isLoading ? <Loading /> : events.length === 0 ? <P dim>{t.admin.empty}</P> : events.map((e) => (
        <Card key={e.id}>
          <P small dim>{fmt(e.at)} · {t.admin.kinds[e.kind] ?? e.kind}</P>
          <P small>{e.display_name ? `${e.display_name} · № ${e.student_no}` : '—'}</P>
          {Object.keys(e.detail).length > 0 && <P small dim>{JSON.stringify(e.detail).slice(0, 240)}</P>}
        </Card>
      ))}
      {q.hasNextPage && <Button variant="ghost" label={t.admin.more} loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} />}
    </View>
  )
}

function AppConfig() {
  const q = useQuery({
    queryKey: ['app-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_config').select('min_version, maintenance, message').limit(1).single()
      if (error) throw new Error(error.message)
      return data as { min_version: string; maintenance: boolean; message: string | null }
    },
  })
  const [minV, setMinV] = useState<string | null>(null)
  const [msgText, setMsgText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  if (q.isLoading) return <Loading />
  const cur = q.data
  const save = async (b: { maintenance?: boolean }) => {
    const v = (minV ?? cur?.min_version ?? '').trim()
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v)) { setErr(t.admin.versionBad); return }
    setBusy(true); setErr(null); setOk(false)
    try {
      await api.adminConfig({ minVersion: v, message: msgText ?? cur?.message ?? '', ...b })
      await q.refetch(); await checkAppConfig(); setOk(true)
    } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }
  return (
    <View style={{ gap: space.md }}>
      <ErrorBox message={q.error ? msg(q.error) : err} onRetry={q.error ? () => q.refetch() : undefined} />
      <P dim small>{t.admin.thisVersion(config.appVersion)}</P>
      <Field testID="cfg-min" label={t.admin.minVersion} value={minV ?? cur?.min_version ?? ''} onChangeText={setMinV} autoCapitalize="none" maxLength={11} />
      <Field testID="cfg-msg" label={t.admin.message} value={msgText ?? cur?.message ?? ''} onChangeText={setMsgText} maxLength={500} multiline />
      <Button testID="cfg-save" label={t.admin.saveConfig} onPress={() => save({})} loading={busy} />
      <H level={3}>{t.admin.maintenance}: {cur?.maintenance ? t.admin.on : t.admin.off}</H>
      <P dim small>{t.admin.maintenanceWarn}</P>
      <Button testID="cfg-maint" variant={cur?.maintenance ? 'primary' : 'danger'} loading={busy}
        label={cur?.maintenance ? `${t.admin.maintenance}: ${t.admin.off}` : `${t.admin.maintenance}: ${t.admin.on}`}
        onPress={() => save({ maintenance: !cur?.maintenance })} />
      {ok ? <P small style={{ color: colors.ok }}>{t.admin.saved}</P> : null}
    </View>
  )
}
