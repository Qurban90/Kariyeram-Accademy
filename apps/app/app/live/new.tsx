/** Müəllim/admin: canlı dərs planlaşdırma (FR-041). Server icazəni yoxlayır: yalnız məkan sahibi müəllim və ya admin. */
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { Button, Chip, ErrorBox, Field, P, Screen } from '../../src/components/ui'
import { t } from '../../src/i18n/az'
import { api, ApiFailure } from '../../src/lib/api'
import { parseLocal } from '../../src/live/model'
import { useVenues } from '../../src/lib/queries'
import { space } from '../../src/theme'

const pad = (n: number) => String(n).padStart(2, '0')
function defaultStart() {
  const d = new Date(Date.now() + 10 * 60_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export default function NewLive() {
  const venues = useVenues()
  const qc = useQueryClient()
  const [venue, setVenue] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(defaultStart())
  const [dur, setDur] = useState('60')
  const [access, setAccess] = useState<'enrolled' | 'public' | 'invite'>('public')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr(null)
    const v = venues.data?.find((x) => x.id === venue)
    const s = parseLocal(start)
    const minutes = Number(dur)
    if (!v) { setErr(t.live.form.venue + '?'); return }
    if (title.trim().length < 1) { setErr(t.live.form.title + '?'); return }
    if (!s) { setErr(t.live.form.start); return }
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 720) { setErr(t.live.durationBad); return }
    if (access === 'enrolled' && !v.subject_id) { setErr(t.live.venueNoSubject); return }
    setBusy(true)
    try {
      const r = await api.create({
        venue: v.id, title: title.trim(), startsAt: s.toISOString(), endsAt: new Date(s.getTime() + minutes * 60_000).toISOString(),
        access, subject: access === 'enrolled' ? v.subject_id ?? undefined : undefined,
      })
      await qc.invalidateQueries({ queryKey: ['live-sessions'] })
      router.replace({ pathname: '/live/[id]', params: { id: r.session_id } })
    } catch (e) { setErr(e instanceof ApiFailure ? e.message : String(e)) } finally { setBusy(false) }
  }

  return (
    <Screen back title={t.live.create}>
      <P dim small>{t.live.form.venue}</P>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(venues.data ?? []).map((v) => <Chip key={v.id} label={`${v.door_label ? v.door_label + ' · ' : ''}${v.name}`} selected={venue === v.id} onPress={() => setVenue(v.id)} />)}
      </View>
      <Field label={t.live.form.title} value={title} onChangeText={setTitle} maxLength={140} />
      <Field label={t.live.form.start} value={start} onChangeText={setStart} autoCapitalize="none" />
      <Field label={t.live.form.duration} value={dur} onChangeText={(x) => setDur(x.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} />
      <P dim small>{t.live.form.access}</P>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(['public', 'enrolled'] as const).map((a) => <Chip key={a} label={t.live.access[a]} selected={access === a} onPress={() => setAccess(a)} />)}
      </View>
      <ErrorBox message={err} />
      <Button label={t.live.create} onPress={submit} loading={busy} />
    </Screen>
  )
}
