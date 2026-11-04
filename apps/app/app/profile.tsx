/** Kabinet: profil, abunə kodu (FR-030), abunələr, məlumat ixracı (FR-007), razılıqlar, hesab silmə (FR-006), çıxış. */
import { maskPhone } from '@karyeram/core/src/phone.ts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { Button, Card, ErrorBox, Field, H, P, Screen } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { api, ApiFailure } from '../src/lib/api'
import { useAuth } from '../src/lib/auth'
import { saveJson } from '../src/lib/download'
import { useEnrollments, useSubjects } from '../src/lib/queries'
import { supabase } from '../src/lib/supabase'
import { colors, space } from '../src/theme'

/** Hər klaviaturada İ hərfi olmaya bilər: "sil", "SIL", "SİL" eyni təsdiq sayılır, serverə dəqiq "SİL" gedir. */
const isDeleteWord = (v: string) => /^s[iİıI]l$/i.test(v.trim())

const msg = (e: unknown) => (e instanceof ApiFailure ? e.message : e instanceof Error ? e.message : String(e))

export default function Profile() {
  const { profile, session, signOut } = useAuth()
  const qc = useQueryClient()
  const enr = useEnrollments()
  const subjects = useSubjects()
  const consents = useQuery({
    queryKey: ['consents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('consents').select('doc, version, revoked_at')
      if (error) throw new Error(error.message)
      return data as { doc: string; version: string; revoked_at: string | null }[]
    },
  })
  const [code, setCode] = useState('')
  const [codeMsg, setCodeMsg] = useState<string | null>(null)
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [del, setDel] = useState('')
  const [showDel, setShowDel] = useState(false)

  const subjectName = (id: string) => subjects.data?.find((s) => s.id === id)?.name ?? id
  const active = (doc: string) => (consents.data ?? []).some((c) => c.doc === doc && !c.revoked_at)

  const redeem = async () => {
    setCodeErr(null); setCodeMsg(null)
    const c = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(c)) { setCodeErr('Kod XXXX-XXXX-XXXX formatında olmalıdır.'); return }
    setBusy('code')
    try {
      const r = await api.redeem(c)
      setCodeMsg(t.profile.redeemed(subjectName(r.subject_id), r.access_until ? new Date(r.access_until).toLocaleDateString('az-AZ') : '—'))
      setCode('')
      await qc.invalidateQueries({ queryKey: ['enrollments'] })
    } catch (e) { setCodeErr(msg(e)) } finally { setBusy(null) }
  }

  const exportData = async () => {
    setBusy('export'); setErr(null)
    try {
      const data = await api.exportData()
      await saveJson(`karyeram-melumatlarim-${new Date().toISOString().slice(0, 10)}.json`, data)
    } catch (e) { setErr(msg(e)) } finally { setBusy(null) }
  }

  const toggleConsent = async (doc: 'marketing' | 'recording') => {
    setBusy(doc); setErr(null)
    try {
      if (active(doc)) await api.revoke(doc); else await api.consent([doc])
      await consents.refetch()
    } catch (e) { setErr(msg(e)) } finally { setBusy(null) }
  }

  const deleteAccount = async () => {
    setBusy('delete'); setErr(null)
    try {
      await api.deleteAccount('SİL')
      qc.clear()
      await signOut()
      router.replace('/sign-in')
    } catch (e) { setErr(msg(e)); setBusy(null) }
  }

  const contact = session?.user.phone ? maskPhone(session.user.phone) : session?.user.email ?? ''
  const staff = profile?.role === 'teacher' || profile?.role === 'admin'

  return (
    <Screen back title={t.profile.title}>
      <Card>
        <H level={2}>{profile?.display_name || '—'}</H>
        <P dim>{t.profile.role[profile?.role ?? 'student']} · № {profile?.student_no}</P>
        <P dim small>{contact}</P>
      </Card>

      <H level={2}>{t.profile.redeem}</H>
      <Field testID="code" label={t.profile.redeem} placeholder={t.profile.redeemPh} value={code} onChangeText={setCode}
        autoCapitalize="characters" autoCorrect={false} maxLength={14} error={codeErr} />
      {codeMsg ? <P style={{ color: colors.ok }}>{codeMsg}</P> : null}
      <Button testID="redeem" label={t.profile.redeemBtn} onPress={redeem} loading={busy === 'code'} />

      <H level={2}>{t.profile.subscriptions}</H>
      {(enr.data ?? []).length === 0 ? <P dim>{t.profile.noSubs}</P> : (enr.data ?? []).map((e) => (
        <View key={e.subject_id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <P>{subjectName(e.subject_id)}</P>
          <P dim small>{new Date(e.access_until).toLocaleDateString('az-AZ')}</P>
        </View>
      ))}

      {staff && (
        <>
          <H level={2}>{t.live.title}</H>
          <Button variant="ghost" label={t.live.create} onPress={() => router.push('/live/new')} />
        </>
      )}

      <H level={2}>{t.profile.privacy}</H>
      <ErrorBox message={err} />
      <Button variant="ghost" testID="export" label={t.profile.export} onPress={exportData} loading={busy === 'export'} />
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button small variant={active('marketing') ? 'primary' : 'quiet'} label={`${t.profile.marketing}: ${active('marketing') ? t.common.yes : t.common.no}`}
          onPress={() => toggleConsent('marketing')} loading={busy === 'marketing'} />
        <Button small variant={active('recording') ? 'primary' : 'quiet'} label={`${t.profile.recording}: ${active('recording') ? t.common.yes : t.common.no}`}
          onPress={() => toggleConsent('recording')} loading={busy === 'recording'} />
      </View>
      <P dim small>{t.profile.deviceNote}</P>

      <Button variant="quiet" testID="sign-out" label={t.profile.signOut} onPress={async () => { qc.clear(); await signOut() }} />

      {!showDel ? (
        <Button variant="danger" testID="delete-open" label={t.profile.delete} onPress={() => setShowDel(true)} />
      ) : (
        <Card style={{ borderColor: colors.bad }}>
          <H level={3}>{t.profile.delete}</H>
          <P small>{t.profile.deleteWarn}</P>
          <Field testID="delete-confirm" label={t.profile.deleteType} value={del} onChangeText={setDel} autoCapitalize="characters" autoCorrect={false} />
          <Button variant="danger" testID="delete-go" label={t.profile.deleteBtn} disabled={!isDeleteWord(del)} onPress={deleteAccount} loading={busy === 'delete'} />
          <Button variant="quiet" label={t.common.cancel} onPress={() => { setShowDel(false); setDel('') }} />
        </Card>
      )}
    </Screen>
  )
}
