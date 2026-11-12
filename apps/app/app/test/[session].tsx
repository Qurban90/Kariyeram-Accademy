/**
 * Test ekranı. Suallar serverdən bir-bir gəlir; cavab açarı klientdə yoxdur, yalnız cavabdan sonra (imtahanda — sonda) gəlir.
 * Su nişanı + ekran qoruması (SEC-008). Kursor serverdədir: tətbiq bağlansa, test eyni yerdən davam edir.
 */
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from '../../src/components/Text'
import { useScreenGuard } from '../../src/components/ScreenGuard'
import { Badge, Bar, Button, ErrorBox, Loading, P, Screen } from '../../src/components/ui'
import { Watermark } from '../../src/components/Watermark'
import { t } from '../../src/i18n/az'
import { api, ApiFailure, type AnswerResult, type Question } from '../../src/lib/api'
import { colors, font, radius, space, touch } from '../../src/theme'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
type Phase = 'loading' | 'asking' | 'sending' | 'feedback' | 'finishing' | 'blocked'

function mmss(s: number) {
  const m = Math.floor(s / 60), r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export default function TestRunner() {
  const { session, subject } = useLocalSearchParams<{ session: string; subject?: string }>()
  useScreenGuard('test')
  const [phase, setPhase] = useState<Phase>('loading')
  const [q, setQ] = useState<Question | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  const [fb, setFb] = useState<AnswerResult | null>(null)
  const [err, setErr] = useState<ApiFailure | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const shownAt = useRef(Date.now())
  const finishing = useRef(false)

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    setPhase('finishing')
    try {
      await api.finish(session)
      router.replace({ pathname: '/result/[session]', params: { session, subject: subject ?? '' } })
    } catch (e) {
      finishing.current = false
      setErr(e as ApiFailure); setPhase('blocked')
    }
  }, [session, subject])

  const load = useCallback(async () => {
    setPhase('loading'); setErr(null); setFb(null); setChosen(null)
    try {
      const r = await api.next(session)
      if (r.done) { await finish(); return }
      setQ(r)
      setLeft(r.time_left_s)
      shownAt.current = Date.now()
      setPhase('asking')
    } catch (e) {
      const f = e as ApiFailure
      if (f.code === 'session_closed') { router.replace({ pathname: '/result/[session]', params: { session, subject: subject ?? '' } }); return }
      setErr(f); setPhase('blocked')
    }
  }, [session, subject, finish])

  useEffect(() => { void load() }, [load])

  // İmtahan taymeri: göstərici klientdədir, həqiqi limit serverdədir.
  useEffect(() => {
    if (left === null || phase === 'finishing') return
    if (left <= 0) { if (phase === 'asking') void load(); return }
    const id = setTimeout(() => setLeft((v) => (v === null ? v : v - 1)), 1000)
    return () => clearTimeout(id)
  }, [left, phase, load])

  const submit = async (choice: number | null) => {
    if (!q || phase !== 'asking') return
    setPhase('sending'); setErr(null)
    const chars = q.stem.length + q.options.reduce((a, o) => a + o.length, 0)
    try {
      const r = await api.answer({ session, question: q.question_id, chosen: choice, ms: Date.now() - shownAt.current, chars })
      if (q.mode === 'exam') {
        if (r.done) await finish(); else await load()
        return
      }
      setFb(r); setChosen(choice); setPhase('feedback')
    } catch (e) {
      const f = e as ApiFailure
      if (f.code === 'out_of_order') { await load(); return } // cavab artıq qəbul olunub (təkrar göndəriş)
      if (f.code === 'time_up' || f.code === 'session_closed') { await finish(); return } // imtahan vaxtı bitib: server sessiyanı bağlayıb
      setErr(f); setPhase(f.code === 'network' || f.code === 'timeout' ? 'asking' : 'blocked')
    }
  }

  const claim = async () => {
    try { await api.claimDevice(); await load() } catch (e) { setErr(e as ApiFailure) }
  }

  if (phase === 'loading' || phase === 'finishing') return <Screen back title=""><Loading /></Screen>

  if (phase === 'blocked' && err) {
    return (
      <Screen back title="">
        <ErrorBox message={err.message} />
        {err.code === 'device_not_active' && <Button label={t.test.claimDevice} onPress={claim} />}
        {['network', 'timeout', 'internal'].includes(err.code) && <Button label={t.common.retry} onPress={load} />}
        {err.code === 'consent_required' && <Button label={t.common.continue} onPress={() => router.replace('/onboarding')} />}
        <Button variant="quiet" label={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Screen>
    )
  }
  if (!q) return null

  const exam = q.mode === 'exam'
  const showResult = phase === 'feedback' && fb && typeof fb.correct === 'boolean'

  return (
    <View style={{ flex: 1, backgroundColor: colors.board }}>
      <Screen back title={t.test.question(q.position, q.total)}
        right={left !== null ? <Text style={[st.timer, left < 60 && { color: colors.bad }]} accessibilityLabel={`${t.test.timeLeft} ${mmss(left)}`}>{mmss(Math.max(0, left))}</Text> : null}>
        <Bar value={(100 * (q.position - 1)) / q.total} />
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Badge label={t.test.levels[q.level]} />
          {q.trap && !exam && <Badge tone="trap" icon="alert" label={t.test.trap} />}
          {exam && <Badge tone="gold" icon="timer" label={t.test.examNote} />}
        </View>

        <Text style={st.stem} selectable={false} testID="stem">{q.stem}</Text>

        <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
          {q.options.map((o, i) => {
            const isChosen = chosen === i
            let border: string = colors.line, bg: string = colors.surface
            if (showResult) {
              if (i === fb!.correct_display) { border = colors.ok; bg = colors.okWash }
              else if (isChosen) { border = colors.bad; bg = colors.badWash }
            } else if (isChosen) { border = colors.gold; bg = colors.goldWash }
            const oe = showResult ? fb!.option_explanations?.[i] : undefined
            return (
              <Pressable key={i} testID={`opt-${i}`} accessibilityRole="radio" aria-checked={isChosen} aria-disabled={phase !== 'asking'}
                accessibilityLabel={`${LETTERS[i]}. ${o}`}
                onPress={phase === 'asking' ? () => setChosen(i) : undefined}
                style={[st.opt, { borderColor: border, backgroundColor: bg }]}>
                <View style={[st.letter, isChosen && { backgroundColor: colors.gold, borderColor: colors.gold }]}><Text style={[st.letterTxt, isChosen && { color: colors.ink }]}>{LETTERS[i]}</Text></View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={st.optTxt} selectable={false}>{o}</Text>
                  {oe ? <Text style={st.optExp}>{oe}</Text> : null}
                </View>
              </Pressable>
            )
          })}
        </View>

        {showResult && (
          <View style={[st.feedback, { borderColor: fb!.correct ? colors.ok : colors.bad }]} accessibilityLiveRegion="polite" testID="feedback">
            <Text style={[st.fbTitle, { color: fb!.correct ? colors.ok : chosen === null ? colors.warn : colors.bad }]}>
              {fb!.correct ? t.test.correct : chosen === null ? t.test.blank : t.test.wrong}
            </Text>
            {fb!.explanation ? <P><Text style={{ fontWeight: '700' }}>{t.test.explanation}: </Text>{fb!.explanation}</P> : null}
            {fb!.law_ref ? <P dim small>{t.test.lawRef}: {fb!.law_ref}</P> : null}
          </View>
        )}

        <ErrorBox message={err?.message} />

        {phase === 'feedback' ? (
          <Button testID="next" label={fb?.done ? t.test.finish : t.test.next} onPress={() => (fb?.done ? finish() : load())} />
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button testID="skip" variant="quiet" label={t.test.skip} onPress={() => submit(null)} disabled={phase !== 'asking'} style={{ flex: 1 }} />
            <Button testID="confirm" label={t.test.confirm} onPress={() => submit(chosen)} disabled={chosen === null} loading={phase === 'sending'} style={{ flex: 2 }} />
          </View>
        )}
        <P dim small style={{ textAlign: 'center' }}>{t.test.leaveConfirm}</P>
      </Screen>
      <Watermark value={q.watermark} />
    </View>
  )
}

const st = StyleSheet.create({
  timer: { color: colors.ivory, fontVariant: ['tabular-nums'], fontFamily: font.serif, fontSize: font.h3 + 1, paddingHorizontal: space.sm },
  stem: { color: colors.ivory, fontSize: 19, lineHeight: 29, fontWeight: '500' },
  opt: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: touch + 12, padding: space.md + 2, borderRadius: radius.md + 2, borderWidth: 1 },
  letter: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  letterTxt: { color: colors.ivoryDim, fontWeight: '600' },
  optTxt: { color: colors.ivory, fontSize: font.body, lineHeight: 23, paddingTop: 4 },
  optExp: { color: colors.ivoryDim, fontSize: font.small, lineHeight: 20 },
  feedback: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm, backgroundColor: colors.surface },
  fbTitle: { fontSize: font.h2, fontFamily: font.serif },
})
