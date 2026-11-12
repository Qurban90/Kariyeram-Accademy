/**
 * Su nişanı: tələbə nömrəsi ekranın üzərinə çəp şəkildə təkrarlanır. Ekran şəkli sızarsa, mənbə müəyyən olunur.
 * Kredensial deyil (yalnız nömrə). pointerEvents="none": toxunmaya mane olmur. Ekran oxuyucudan gizlidir.
 */
import { StyleSheet, View } from 'react-native'
import { roomColors } from '../theme'
import { Text } from './Text'
import { usePalette } from './Theme'

export function Watermark({ value }: { value: string | number | null | undefined }) {
  const palette = usePalette()
  if (value === null || value === undefined || value === '') return null
  const label = `№ ${value}`
  const rows = Array.from({ length: 9 })
  const ink = palette === roomColors ? 'rgba(34,27,17,0.06)' : 'rgba(241,236,224,0.07)'
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <View style={st.rot}>
        {rows.map((_, i) => (
          <Text key={i} style={[st.txt, { color: ink, marginLeft: (i % 2) * 70 }]} selectable={false}>
            {`${label}      ${label}      ${label}      ${label}`}
          </Text>
        ))}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  rot: { position: 'absolute', top: '-20%', left: '-30%', right: '-30%', bottom: '-20%', justifyContent: 'space-around', transform: [{ rotate: '-24deg' }] },
  txt: { fontSize: 18, fontWeight: '800', letterSpacing: 2 },
})
