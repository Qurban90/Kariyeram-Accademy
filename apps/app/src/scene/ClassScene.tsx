/**
 * Fənn otağının 2.5D görünüşü: qapıdan giriş, sinif, partaya avtomatik oturma, sonra partanın üstü (iki seçim).
 * Dərsdən və ya testdən qayıdanda tələbə yenə öz partasındadır (animasiya təkrarlanmır).
 */
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '../components/Text'
import { Icon } from '../components/Icon'
import { t } from '../i18n/az'
import { colors, radius, scene as c, space, touch, type } from '../theme'
import { Classroom } from './Classroom'
import { DeskView } from './DeskView'
import { mySeat } from './plan'
import { SceneMenu } from './SceneMenu'
import { useQuietMotion } from './Stage'

export function ClassScene({ subject, roomNo, name, firstName, studentNo, onLesson, onTest, onLeave }: {
  subject: string; roomNo: string; name: string; firstName: string; studentNo: number | null | undefined
  onLesson: () => void; onTest: () => void; onLeave: () => void
}) {
  const quiet = useQuietMotion()
  const ins = useSafeAreaInsets()
  const [seated, setSeated] = useState(false)
  if (quiet === null) return <View style={{ flex: 1, backgroundColor: c.roomWall }} />
  if (seated || quiet) {
    return <DeskView name={name || firstName} seatNo={mySeat(studentNo).no} roomNo={roomNo} subject={subject}
      onLesson={onLesson} onTest={onTest} onLeave={onLeave} menu={<SceneMenu light />} />
  }
  return (
    <View style={{ flex: 1 }}>
      <Classroom studentNo={studentNo} firstName={firstName} subject={subject} quiet={false} onSeated={() => setSeated(true)} />
      <View style={[st.bar, { top: ins.top + space.sm }]} pointerEvents="box-none">
        <Pressable testID="class-leave" onPress={onLeave} accessibilityRole="button" accessibilityLabel={t.scene.leave} style={st.btn}>
          <Icon name="back" size={20} color={colors.onGold} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable testID="scene-skip" onPress={() => setSeated(true)} accessibilityRole="button" accessibilityLabel={t.scene.skip} style={[st.btn, st.skip]}>
          <Text style={st.skipTxt}>{t.scene.skip}</Text>
          <Icon name="chevron" size={16} color={colors.onGold} />
        </Pressable>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  bar: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center' },
  btn: {
    minWidth: touch, height: touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
    backgroundColor: 'rgba(255,253,246,0.72)',
  },
  skip: { paddingHorizontal: space.lg },
  skipTxt: { color: colors.onGold, fontFamily: type.semibold, fontSize: 15 },
})
