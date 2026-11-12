/**
 * Brend nişanı və söz nişanı. Nişan loqonun vektor sadələşdirməsidir (aypara, pilləkən, fənər tutan müəllim,
 * işığa doğru çıxan tələbə): rəsmi loqo faylı (SVG/PNG) əlavə olunanda `BrandMark` onunla əvəz edilməlidir.
 */
import { View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Line, Path, Polygon, Rect, Stop } from 'react-native-svg'
import { t } from '../i18n/az'
import { colors, space, type } from '../theme'
import { Text } from './Text'

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <Defs>
        <LinearGradient id="km-beam" x1="80" y1="41" x2="46" y2="74" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.goldBright} stopOpacity="0.98" />
          <Stop offset="0.5" stopColor={colors.gold} stopOpacity="0.5" />
          <Stop offset="1" stopColor={colors.gold} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {/* Aypara: solda qalın, sağa doğru incələn halqa */}
      <Path fill={colors.ivory} fillRule="evenodd"
        d="M58 8a52 52 0 100 104a52 52 0 100-104zM63 12a46 46 0 110 92a46 46 0 110-92z" />
      {/* Fənər şüası */}
      <Polygon points="79.4,40 81,42.6 62,86 36,62" fill="url(#km-beam)" />
      {/* Yol və pilləkən */}
      <Path fill={colors.ivory}
        d="M22 103C38 101 49 95 56 88V86H64V78H72V70H80V62H109C106 70 88 73 73 83C60 92 42 102 22 103Z" />
      {/* Müəllim */}
      <Circle cx="93" cy="26" r="5" fill={colors.ivory} />
      <Path fill={colors.ivory} d="M88.2 34.2Q93 31.2 97.8 34.2L99 62H87Z" />
      <Line x1="89" y1="37.5" x2="80.5" y2="41.2" stroke={colors.ivory} strokeWidth="2.8" strokeLinecap="round" />
      {/* Tələbə */}
      <Circle cx="49.5" cy="65.5" r="4.2" fill={colors.ivory} />
      <Rect x="46.4" y="71" width="6.4" height="13.5" rx="3" fill={colors.ivory} />
      <Rect x="41.6" y="72.6" width="4.2" height="8.4" rx="2" fill={colors.ivory} />
      <Line x1="48.4" y1="83.5" x2="46.2" y2="94" stroke={colors.ivory} strokeWidth="2.8" strokeLinecap="round" />
      <Line x1="51.4" y1="83.5" x2="57" y2="85.6" stroke={colors.ivory} strokeWidth="2.8" strokeLinecap="round" />
    </Svg>
  )
}

/** "Karyeram / ACCADEMY": loqodakı kimi iki C qızılıdır. */
export function Wordmark({ size = 22, align = 'left' }: { size?: number; align?: 'left' | 'center' }) {
  const sub = Math.max(9, Math.round(size * 0.36))
  const tracking = sub * 0.42
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }} accessible accessibilityRole="header" accessibilityLabel={t.brand}>
      <Text style={{ color: colors.ivory, fontFamily: type.displayBold, fontSize: size, lineHeight: Math.round(size * 1.12), letterSpacing: -0.2 }}>Karyeram</Text>
      <Text style={{ color: colors.ivoryDim, fontFamily: type.display, fontSize: sub, letterSpacing: tracking, marginRight: -tracking, marginTop: 1 }}>
        A<Text style={{ color: colors.gold, fontFamily: type.displayBold }}>CC</Text>ADEMY
      </Text>
    </View>
  )
}

export function Lockup({ variant = 'row', size }: { variant?: 'row' | 'stack'; size?: number }) {
  if (variant === 'stack') {
    return (
      <View style={{ alignItems: 'center', gap: space.md }}>
        <BrandMark size={size ?? 132} />
        <Wordmark size={38} align="center" />
      </View>
    )
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 }}>
      <BrandMark size={size ?? 42} />
      <Wordmark size={21} />
    </View>
  )
}
