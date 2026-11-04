/** Müəllim otağı (FR-060, FR-062): yoxlamada olan sualları dərc etmək və toplu abunə kodu yaratmaq. Icazə serverdə yoxlanır. */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { Button, Card, Chip, ErrorBox, Field, H, Loading, P, Screen } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { api, ApiFailure } from '../src/lib/api'
import { useSubjects } from '../src/lib/queries'
import { supabase } from '../src/lib/supabase'
import { colors, font, space } from '../src/theme'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
interface StaffQuestion {
  id: string; stem: string; options: string[]; answer_index: number; explanation: string; option_explanations: string[]
  level: number; trap: boolean; law_ref: string | null; status: string; topics: { name: string; subject_id: string } | null
}
const msg = (e: unknown) => (e instanceof ApiFailure ? e.message : e instanceof Error ? e.message : String(e))

export default function Teacher() {
  const [tab, setTab] = useState<'questions' | 'codes'>('questions')
  return (
    <Screen back title={t.teacher.title}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip testID="tab-questions" label={t.teacher.questions} selected={tab === 'questions'} onPress={() => setTab('questions')} />
        <Chip testID="tab-codes" label={t.teacher.codes} selected={tab === 'codes'} onPress={() => setTab('codes')} />
      </View>
      {tab === 'questions' ? <ReviewQueue /> : <CodeMaker />}
    </Screen>
  )
}

function ReviewQueue() {
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['staff-review'],
    queryFn: async () => {
      // RLS: questions cədvəlini yalnız müəllim/admin oxuyur.
      const { data, error } = await supabase.from('questions')
        .select('id, stem, options, answer_index, explanation, option_explanations, level, trap, law_ref, status, topics(name, subject_id)')
        .in('status', ['review', 'draft']).order('created_at').limit(50)
      if (error) throw new Error(error.message)
      return data as unknown as StaffQuestion[]
    },
  })
  const setStatus = async (id: string, status: 'published' | 'draft' | 'retired') => {
    setBusy(id); setErr(null)
    try { await api.setQuestionStatus(id, status); await qc.invalidateQueries({ queryKey: ['staff-review'] }) } catch (e) { setErr(msg(e)) } finally { setBusy(null) }
  }
  if (q.isLoading) return <Loading />
  return (
    <View style={{ gap: space.md }}>
      <ErrorBox message={err ?? (q.error ? msg(q.error) : null)} onRetry={q.error ? () => q.refetch() : undefined} />
      {(q.data ?? []).length === 0 && <P dim>{t.teacher.none}</P>}
      {(q.data ?? []).map((x, n) => (
        <Card key={x.id} testID={`rq-${n}`}>
          <P dim small>{x.topics?.subject_id} · {x.topics?.name} · {t.teacher.status[x.status]} · {t.test.levels[x.level]}{x.trap ? ` · ⚠ ${t.test.trap}` : ''}</P>
          <Text style={{ color: colors.chalk, fontWeight: '700', fontSize: font.body }}>{x.stem}</Text>
          {x.options.map((o, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Text style={{ color: i === x.answer_index ? colors.ok : colors.chalk, fontSize: font.small }}>
                {LETTERS[i]}. {o}{i === x.answer_index ? `  ✓ ${t.teacher.correct}` : ''}
              </Text>
              {x.option_explanations[i] ? <Text style={{ color: colors.chalkDim, fontSize: font.tiny }}>{x.option_explanations[i]}</Text> : null}
            </View>
          ))}
          {x.explanation ? <P small>{t.test.explanation}: {x.explanation}</P> : null}
          {x.law_ref ? <P small dim>{t.test.lawRef}: {x.law_ref}</P> : null}
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Button small testID={`publish-${n}`} label={t.teacher.publish} loading={busy === x.id} onPress={() => setStatus(x.id, 'published')} />
            {x.status !== 'draft' && <Button small variant="quiet" label={t.teacher.toDraft} onPress={() => setStatus(x.id, 'draft')} />}
            <Button small variant="quiet" label={t.teacher.retire} onPress={() => setStatus(x.id, 'retired')} />
          </View>
        </Card>
      ))}
    </View>
  )
}

function CodeMaker() {
  const subjects = useSubjects()
  const [subject, setSubject] = useState<string | null>(null)
  const [count, setCount] = useState('10')
  const [days, setDays] = useState(90)
  const [codes, setCodes] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const create = async () => {
    setErr(null); setCopied(false)
    const n = Number(count)
    if (!subject) { setErr(t.teacher.pickSubject); return }
    if (!Number.isInteger(n) || n < 1 || n > 200) { setErr(t.teacher.countBad); return }
    setBusy(true)
    try { setCodes((await api.staffCodes(subject, n, days)).codes) } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(codes.join('\n')); setCopied(true) } catch { /* brauzer icazə vermədi */ }
  }

  return (
    <View style={{ gap: space.md }}>
      <P dim small>{t.teacher.subject}</P>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(subjects.data ?? []).map((s) => <Chip key={s.id} testID={`cs-${s.id}`} label={s.name} selected={subject === s.id} onPress={() => setSubject(s.id)} />)}
      </View>
      <Field testID="code-count" label={t.teacher.count} value={count} onChangeText={(v) => setCount(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} />
      <P dim small>{t.teacher.days}</P>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {[30, 90, 180, 365].map((d) => <Chip key={d} label={String(d)} selected={days === d} onPress={() => setDays(d)} />)}
      </View>
      <ErrorBox message={err} />
      <Button testID="make-codes" label={t.teacher.create} onPress={create} loading={busy} />
      {codes.length > 0 && (
        <Card style={{ borderColor: colors.warn }}>
          <P small style={{ color: colors.warn }}>{t.teacher.onceWarn}</P>
          <Text selectable testID="codes-out" style={{ color: colors.chalk, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: font.body, lineHeight: 26 }}>{codes.join('\n')}</Text>
          {Platform.OS === 'web' && <Button small variant="ghost" label={copied ? t.teacher.copied : t.teacher.copy} onPress={copy} />}
        </Card>
      )}
    </View>
  )
}
