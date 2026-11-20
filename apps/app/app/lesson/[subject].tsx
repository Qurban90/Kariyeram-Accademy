/** Dərsin izahı (tam ekran): mövzular sadə siyahıda, izah canlı dərsdə. PDF tətbiqdə yoxdur —
 * materiallar yalnız kurs tələbələrinə göndərilir; əlaqə üçün müəllimin nömrəsi və canlı dərsə qoşulma. */
import { router, useLocalSearchParams } from 'expo-router'
import { Linking, StyleSheet, View } from 'react-native'
import { Button, Card, Group, H, Icon, ListRow, Loading, P, RoomTheme, Screen, Section, usePalette } from '../../src/components/ui'
import { RoomScene } from '../../src/components/RoomScene'
import { t } from '../../src/i18n/az'
import { config } from '../../src/config'
import { useLiveSessions, useSubjects, useTopics } from '../../src/lib/queries'
import { space } from '../../src/theme'

export default function Lesson() {
  const { subject } = useLocalSearchParams<{ subject: string }>()
  const subjects = useSubjects()
  const topics = useTopics(subject)
  const live = useLiveSessions()
  const colors = usePalette()
  const name = subjects.data?.find((s) => s.id === subject)?.name ?? ''
  const idx = (subjects.data ?? []).findIndex((s) => s.id === subject)
  const roomNo = idx >= 0 ? String(101 + idx) : ''
  const hasLive = (live.data ?? []).some((s) => s.state === 'live' && (s.subject_id === subject || s.subject_id === null))

  if (subjects.isLoading || topics.isLoading) return <Screen><Loading /></Screen>

  return (
    <RoomTheme>
      <Screen back title={t.lesson.title}>
        <RoomScene number={roomNo || undefined} name={name} />
        <P dim>{t.lesson.lead}</P>

        <Section title={t.room.topics}>
          {(topics.data ?? []).length === 0 ? <P dim small>{t.lesson.empty}</P> : (
            <Group>
              {(topics.data ?? []).map((x, i) => (
                <ListRow key={x.id} testID={`lesson-topic-${i}`} icon="bookOpen" title={x.name}
                  sub={hasLive ? t.lesson.topicLive : t.lesson.open}
                  onPress={() => router.push('/live')} />
              ))}
            </Group>
          )}
        </Section>

        <Card tone="gold" testID="lesson-contact">
          <View style={st.head}>
            <Icon name="phone" size={20} color={colors.gold} />
            <H level={3}>{t.contact.title}</H>
          </View>
          <P dim small>{t.contact.lead}</P>
          <P style={st.phone}>{config.contactPhoneDisplay}</P>
          <View style={st.row}>
            <Button testID="lesson-call" icon="phone" label={t.contact.call} style={{ flex: 1 }}
              onPress={() => void Linking.openURL(`tel:${config.contactPhone}`)} />
            <Button testID="lesson-live" icon="screen" variant="ghost" label={hasLive ? t.contact.live : t.contact.enroll} style={{ flex: 1 }}
              onPress={() => router.push('/live')} />
          </View>
          <P dim small>{t.contact.free}</P>
        </Card>
      </Screen>
    </RoomTheme>
  )
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  phone: { fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
})