/**
 * Su nişanı: tələbə nömrəsi ekranın üzərinə çəp şəkildə təkrarlanır. Ekran şəkli sızarsa, mənbə müəyyən olunur.
 * Kredensial deyil (yalnız nömrə). pointerEvents="none": toxunmaya mane olmur. Ekran oxuyucudan gizlidir.
 */
import { StyleSheet, Text, View } from 'react-native'

export function Watermark({ value }: { value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  const label = `№ ${value}`
  const rows = Array.from({ length: 9 })
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <View style={st.rot}>
        {rows.map((_, i) => (
          <Text key={i} style={[st.txt, { marginLeft: (i % 2) * 70 }]} selectable={false}>
            {`${label}      ${label}      ${label}      ${label}`}
          </Text>
        ))}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  rot: { position: 'absolute', top: '-20%', left: '-30%', right: '-30%', bottom: '-20%', justifyContent: 'space-around', transform: [{ rotate: '-24deg' }] },
  txt: { color: 'rgba(241,236,224,0.07)', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
})
