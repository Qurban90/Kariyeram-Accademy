/** 3D dəhliz konteyneri: gec yüklənmə, WebGL xətasında 2D-yə qayıdış, əlçatan qapı siyahısı. */
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Loading } from '../components/ui'
import { t } from '../i18n/az'
import { colors, font, radius, space } from '../theme'

const SchoolCorridor = lazy(() => import('./SchoolCorridor').then((m) => ({ default: m.SchoolCorridor })))

class GLBoundary extends Component<{ onFail: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: Error) { this.props.onFail(e) }
  render() { return this.state.failed ? null : this.props.children }
}

export interface DoorInfo { key: string; number: string; title: string }

export function Corridor3D({ doors, hallLive, onEnter, onFail }: {
  doors: DoorInfo[]; hallLive: boolean; onEnter: (key: string | 'hall') => void; onFail: () => void
}) {
  const [selected, setSelected] = useState<number | 'hall' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const pick = (i: number | 'hall') => {
    setSelected(i)
    if (timer.current) clearTimeout(timer.current)
    // Kamera qapıya çatsın, qapı açılsın, sonra otağa keçək.
    timer.current = setTimeout(() => { onEnter(i === 'hall' ? 'hall' : doors[i]!.key); setSelected(null) }, 1100)
  }

  return (
    <View style={st.wrap}>
      <View style={st.canvas} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="corridor-3d">
        <GLBoundary onFail={onFail}>
          <Suspense fallback={<Loading />}>
            <SchoolCorridor doors={doors.map((d) => ({ key: d.key }))} selected={selected} onPick={pick} hallLive={hallLive} />
          </Suspense>
        </GLBoundary>
        <Text style={st.hint} pointerEvents="none">{t.hall.walkHint}</Text>
      </View>
      <View style={st.legend}>
        {doors.map((d, i) => (
          <Pressable key={d.key} testID={`door3d-${d.key}`} accessibilityRole="button" accessibilityLabel={`${d.number}. ${d.title}`}
            onPress={() => pick(i)} style={[st.tag, selected === i && st.tagOn]}>
            <Text style={st.tagNo}>{d.number}</Text><Text style={st.tagTxt} numberOfLines={1}>{d.title}</Text>
          </Pressable>
        ))}
        <Pressable testID="door3d-hall" accessibilityRole="button" accessibilityLabel={t.hall.live} onPress={() => pick('hall')} style={[st.tag, selected === 'hall' && st.tagOn]}>
          <Text style={st.tagNo}>{hallLive ? '●' : 'ZAL'}</Text><Text style={st.tagTxt}>{t.hall.live}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  wrap: { gap: space.sm },
  canvas: { height: 360, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.boardDeep, borderWidth: 1, borderColor: colors.boardLine },
  hint: { position: 'absolute', bottom: 8, alignSelf: 'center', color: colors.chalk, backgroundColor: colors.overlay, paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, fontSize: font.tiny },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.boardLine, maxWidth: '100%' },
  tagOn: { borderColor: colors.brass, backgroundColor: '#2c4a3a' },
  tagNo: { color: colors.brass, fontWeight: '900', fontSize: font.small },
  tagTxt: { color: colors.chalk, fontWeight: '600', fontSize: font.small, flexShrink: 1 },
})
