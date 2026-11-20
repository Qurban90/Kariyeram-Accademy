/**
 * Dərsin izahı (partadakı dəftər): fənnin mövzuları sadə siyahıda. Mövzunun mətn izahı (konspekt) varsa açılır;
 * yoxdursa izahın canlı dərsdə verildiyi deyilir və həmin mövzudan dərhal test yazmaq təklif olunur.
 * PDF materiallar tətbiqdə paylanmır: onlar kurs tələbələrinə verilir (aşağıdakı reklam bloku).
 */
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Promo } from '../../src/components/Promo'
import { Button, ErrorBox, Group, ListRow, Loading, P, RoomTheme, Screen, Section, Sheet } from '../../src/components/ui'
import { t } from '../../src/i18n/az'
import { api, ApiFailure } from '../../src/lib/api'
import { useLibrary, useSubjects, useTopics, type Topic } from '../../src/lib/queries'

function LessonInner() {
  const { subject } = useLocalSearchParams<{ subject: string }>()
  const subjects = useSubjects()
  const topics = useTopics(subject)
  const lib = useLibrary(subject)
  const [picked, setPicked] = useState<Topic | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const name = subjects.data?.find((s) => s.id === subject)?.name ?? ''

  if (subjects.isLoading || topics.isLoading) return <Screen back title={t.lesson.title}><Loading /></Screen>

  const textOf = (topicId: string) => (lib.data ?? []).find((i) => i.kind === 'text' && i.topic_id === topicId)
  // Mövzuya bağlı olmayan yazılı izahlar (fənn üzrə ümumi). PDF-lər tətbiqdə göstərilmir: kurs materialıdır.
  const general = (lib.data ?? []).filter((i) => i.kind === 'text' && !(topics.data ?? []).some((x) => x.id === i.topic_id))
  const read = (id: string, title: string) => router.push({ pathname: '/library/[id]', params: { id, kind: 'text', title } })
  const open = (x: Topic) => {
    const doc = textOf(x.id)
    if (doc) read(doc.id, doc.title)
    else { setErr(null); setPicked(x) }
  }
  const test = async () => {
    if (!picked) return
    setBusy(true); setErr(null)
    try {
      const r = await api.start({ subject, mode: 'topic', topicIds: [picked.id], size: 10 })
      setPicked(null)
      router.push({ pathname: '/test/[session]', params: { session: r.session_id, subject, from: 'room' } })
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen back title={name ? `${t.lesson.title}: ${name}` : t.lesson.title}>
      <P dim>{t.lesson.lead}</P>
      <ErrorBox message={topics.error ? (topics.error as Error).message : null} onRetry={() => topics.refetch()} />
      <Section title={t.room.topics}>
        {(topics.data ?? []).length === 0 ? <P dim small>{t.lesson.empty}</P> : (
          <Group>
            {(topics.data ?? []).map((x, i) => (
              <ListRow key={x.id} testID={`lesson-topic-${i}`} icon={textOf(x.id) ? 'bookOpen' : 'screen'} title={x.name}
                sub={textOf(x.id) ? t.lesson.read : t.lesson.topicLive} onPress={() => open(x)} />
            ))}
          </Group>
        )}
      </Section>
      {general.length ? (
        <Section title={t.lesson.general}>
          <Group>
            {general.map((d, i) => <ListRow key={d.id} testID={`lesson-doc-${i}`} icon="bookOpen" title={d.title} sub={t.lesson.read} onPress={() => read(d.id, d.title)} />)}
          </Group>
        </Section>
      ) : null}
      <Promo testID="lesson-promo" />

      <Sheet visible={!!picked} onClose={() => setPicked(null)} title={picked?.name ?? ''} testID="lesson-topic-sheet">
        <P dim>{t.lesson.liveOnly}</P>
        <ErrorBox message={err} />
        <Button testID="lesson-topic-test" icon="timer" label={t.lesson.testThis} loading={busy} onPress={() => void test()} />
        <Button testID="lesson-topic-live" icon="screen" variant="ghost" label={t.lesson.toLive} onPress={() => { setPicked(null); router.push('/live') }} />
      </Sheet>
    </Screen>
  )
}

export default function Lesson() {
  return <RoomTheme><LessonInner /></RoomTheme>
}
