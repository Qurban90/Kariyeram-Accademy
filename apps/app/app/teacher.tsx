/** Müəllim otağı (FR-060, FR-062): yoxlamada olan sualları dərc etmək və toplu abunə kodu yaratmaq. Icazə serverdə yoxlanır. */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { Button, Card, Check, Chip, ErrorBox, Field, H, Loading, P, Screen } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { api, ApiFailure } from '../src/lib/api'
import { useLibrary, useSubjects } from '../src/lib/queries'
import { supabase } from '../src/lib/supabase'
import { colors, font, space } from '../src/theme'
import { fmtDate } from '../src/lib/dates'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
interface StaffQuestion {
  id: string; stem: string; options: string[]; answer_index: number; explanation: string; option_explanations: string[]
  level: number; trap: boolean; law_ref: string | null; status: string; topics: { name: string; subject_id: string } | null
}
const msg = (e: unknown) => (e instanceof ApiFailure ? e.message : e instanceof Error ? e.message : String(e))

export default function Teacher() {
  const [tab, setTab] = useState<'questions' | 'codes' | 'analysis' | 'diary' | 'library'>('questions')
  return (
    <Screen back title={t.teacher.title}>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Chip testID="tab-questions" label={t.teacher.questions} selected={tab === 'questions'} onPress={() => setTab('questions')} />
        <Chip testID="tab-codes" label={t.teacher.codes} selected={tab === 'codes'} onPress={() => setTab('codes')} />
        <Chip testID="tab-analysis" label={t.teacher.analysis} selected={tab === 'analysis'} onPress={() => setTab('analysis')} />
        <Chip testID="tab-diary" label={t.teacher.diary} selected={tab === 'diary'} onPress={() => setTab('diary')} />
        <Chip testID="tab-library" label={t.library.shelf} selected={tab === 'library'} onPress={() => setTab('library')} />
      </View>
      {tab === 'questions' ? <ReviewQueue /> : tab === 'codes' ? <><CodeMaker /><CodeList /></> : tab === 'analysis' ? <Analysis /> : tab === 'diary' ? <DiaryWriter /> : <ShelfManager />}
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

const FLAG_COLOR: Record<string, string> = {
  suspect_key: colors.bad, non_discriminating: colors.warn, too_hard: colors.warn, too_easy: colors.warn, trap: colors.trap, insufficient_data: colors.chalkDim,
}

function Analysis() {
  const subjects = useSubjects()
  const [subject, setSubject] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['analysis', subject], enabled: !!subject, queryFn: () => api.analysis(subject!) })
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(subjects.data ?? []).map((s) => <Chip key={s.id} testID={`an-${s.id}`} label={s.name} selected={subject === s.id} onPress={() => setSubject(s.id)} />)}
      </View>
      <P dim small>{t.teacher.analysisNote}</P>
      {q.isLoading && subject ? <Loading /> : null}
      <ErrorBox message={q.error ? msg(q.error) : null} onRetry={() => q.refetch()} />
      {subject && q.data && q.data.items.length === 0 && <P dim>{t.teacher.analysisEmpty}</P>}
      {(q.data?.items ?? []).map((it, n) => (
        <Card key={it.questionId} testID={`an-item-${n}`}>
          <P dim small>{it.topic} · {it.n} {t.teacher.nLabel}</P>
          <Text style={{ color: colors.chalk, fontSize: font.small }} numberOfLines={3}>{it.stem}</Text>
          <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }}>
            <P small>{t.teacher.pLabel}: {Math.round(it.p * 100)}%</P>
            <P small>{t.teacher.discLabel}: {it.discrimination.toFixed(2)}</P>
          </View>
          <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
            {it.flags.map((f) => (
              <Text key={f} style={{ color: FLAG_COLOR[f] ?? colors.chalk, borderColor: FLAG_COLOR[f] ?? colors.chalk, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, fontSize: font.tiny, fontWeight: '700' }}>
                {t.teacher.flags[f] ?? f}
              </Text>
            ))}
          </View>
        </Card>
      ))}
    </View>
  )
}

function CodeList() {
  const q = useQuery({ queryKey: ['staff-codes'], queryFn: () => api.listCodes() })
  const [err, setErr] = useState<string | null>(null)
  const revoke = async (id: string) => {
    setErr(null)
    try { await api.revokeCode(id); await q.refetch() } catch (e) { setErr(msg(e)) }
  }
  return (
    <View style={{ gap: space.sm, marginTop: space.lg }}>
      <H level={3}>{t.teacher.myCodes}</H>
      <ErrorBox message={err ?? (q.error ? msg(q.error) : null)} />
      {q.data && q.data.codes.length === 0 && <P dim small>{t.teacher.noCodes}</P>}
      {(q.data?.codes ?? []).slice(0, 100).map((c, i) => (
        <View key={c.id} testID={`code-row-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <Text style={{ color: colors.chalk, flex: 1, minWidth: 160, fontSize: font.small }}>
            {c.subject_id} · {c.days} gün · {fmtDate(c.created_at)} · {t.teacher.codeState[c.state]}
          </Text>
          {c.state === 'unused' && <Button small variant="danger" label={t.teacher.revoke} onPress={() => revoke(c.id)} />}
        </View>
      ))}
    </View>
  )
}

function DiaryWriter() {
  const [no, setNo] = useState('')
  const [kind, setKind] = useState<'grade' | 'note'>('grade')
  const [title, setTitle] = useState('')
  const [grade, setGrade] = useState('')
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setErr(null); setOk(null)
    const n = Number(no)
    if (!Number.isInteger(n) || n < 1) { setErr(t.teacher.studentNoBad); return }
    setBusy(true)
    try {
      const r = await api.diaryAdd({ studentNo: n, kind, title: title.trim(), grade: kind === 'grade' ? grade.trim() : undefined, text: text.trim() || undefined })
      setOk(t.teacher.saved(r.student_name)); setTitle(''); setGrade(''); setText('')
    } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }
  return (
    <View style={{ gap: space.md }}>
      <Field testID="d-no" label={t.teacher.studentNo} value={no} onChangeText={(v) => setNo(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label={t.teacher.kindGrade} selected={kind === 'grade'} onPress={() => setKind('grade')} />
        <Chip testID="d-note" label={t.teacher.kindNote} selected={kind === 'note'} onPress={() => setKind('note')} />
      </View>
      <Field testID="d-title" label={t.teacher.entryTitle} value={title} onChangeText={setTitle} maxLength={140} />
      {kind === 'grade' && <Field testID="d-grade" label={t.teacher.grade} value={grade} onChangeText={setGrade} maxLength={10} />}
      <Field label={t.teacher.text} value={text} onChangeText={setText} maxLength={2000} multiline />
      <ErrorBox message={err} />
      {ok ? <P style={{ color: colors.ok }}>{ok}</P> : null}
      <Button testID="d-save" label={t.teacher.save} onPress={save} loading={busy} />
    </View>
  )
}

const MAX_PDF = 25 * 1024 * 1024

function ShelfManager() {
  const subjects = useSubjects()
  const qc = useQueryClient()
  const [subject, setSubject] = useState<string | null>(null)
  const list = useLibrary(subject ?? undefined)
  const [kind, setKind] = useState<'text' | 'pdf'>('text')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [free, setFree] = useState(false)
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = async () => {
    setErr(null)
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false })
    if (r.canceled || !r.assets[0]) return
    const a = r.assets[0]
    if ((a.size ?? 0) > MAX_PDF) { setErr(t.library.tooBig); return }
    setFile(a)
  }

  const save = async () => {
    setErr(null); setOk(null)
    if (!subject) { setErr(t.library.needSubject); return }
    if (!title.trim()) { setErr(t.library.needTitle); return }
    if (kind === 'text' && !body.trim()) { setErr(t.library.needBody); return }
    if (kind === 'pdf' && !file) { setErr(t.library.needFile); return }
    setBusy(true)
    try {
      if (kind === 'text') {
        await api.libraryAdd({ subject, title: title.trim(), kind, free, body })
      } else {
        // 1) server yol və birdəfəlik yükləmə tokeni verir, 2) fayl birbaşa Storage-a, 3) metadata qeydi.
        const up = await api.libraryUploadUrl(subject)
        const data: Blob | ArrayBuffer = file!.file ?? (await (await fetch(file!.uri)).arrayBuffer())
        const { error } = await supabase.storage.from('library').uploadToSignedUrl(up.path, up.token, data, { contentType: 'application/pdf' })
        if (error) throw new Error(error.message)
        await api.libraryAdd({ subject, title: title.trim(), kind, free, path: up.path, bytes: file!.size ?? undefined })
      }
      setOk(t.library.uploaded); setTitle(''); setBody(''); setFile(null)
      await qc.invalidateQueries({ queryKey: ['library'] })
    } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    setErr(null)
    try { await api.libraryDelete(id); await qc.invalidateQueries({ queryKey: ['library'] }) } catch (e) { setErr(msg(e)) }
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(subjects.data ?? []).map((s) => <Chip key={s.id} testID={`ls-${s.id}`} label={s.name} selected={subject === s.id} onPress={() => setSubject(s.id)} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip testID="lk-text" label={t.library.text} selected={kind === 'text'} onPress={() => setKind('text')} />
        <Chip testID="lk-pdf" label={t.library.pdf} selected={kind === 'pdf'} onPress={() => setKind('pdf')} />
      </View>
      <Field testID="l-title" label={t.library.title} value={title} onChangeText={setTitle} maxLength={140} />
      {kind === 'text'
        ? <Field testID="l-body" label={t.library.body} value={body} onChangeText={setBody} multiline maxLength={200000} style={{ minHeight: 160, textAlignVertical: 'top' }} />
        : (
          <View style={{ gap: space.xs }}>
            <Button small variant="ghost" testID="l-pick" label={t.library.pickPdf} onPress={pick} />
            {file && <P small>{t.library.picked(file.name, Math.round((file.size ?? 0) / 1024))}</P>}
          </View>
        )}
      <Check testID="l-free" label={t.library.freeToggle} value={free} onChange={setFree} />
      <ErrorBox message={err} />
      {ok ? <P style={{ color: colors.ok }}>{ok}</P> : null}
      <Button testID="l-save" label={t.library.add} onPress={save} loading={busy} />

      {(list.data ?? []).map((it) => (
        <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={{ color: colors.chalk, flex: 1, fontSize: font.small }}>{it.kind === 'pdf' ? '📄' : '📘'} {it.title}{it.free ? ` · ${t.library.free}` : ''}</Text>
          <Button small variant="danger" label={t.library.remove} onPress={() => remove(it.id)} />
        </View>
      ))}
    </View>
  )
}
