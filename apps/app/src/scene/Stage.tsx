/**
 * 2.5D səhnənin ortaq hissələri: ölçü, qat (perspektiv kameraya bağlı SVG təbəqəsi), səhnədə yazı.
 * Hərəkət yalnız transform və şəffaflıqdır: telefonda native driver ilə JS-dən asılı olmadan axır.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Platform, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native'
import Svg from 'react-native-svg'
import { useEffect } from 'react'
import { Text } from '../components/Text'
import { fit, sampleLayer, VB, type Cam } from './plan'

export const nativeDriver = Platform.OS !== 'web'

type Size = { w: number; h: number }
const SizeCtx = createContext<Size>({ w: 390, h: 844 })
export const useStage = () => useContext(SizeCtx)

/** Səhnənin kökü: ölçünü ölçür və qatlara ötürür. */
export function Stage({ children, testID, bg }: { children: ReactNode; testID?: string; bg: string }) {
  const win = useWindowDimensions()
  const [size, setSize] = useState<Size>({ w: win.width, h: win.height })
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width > 0 && height > 0 && (Math.abs(width - size.w) > 1 || Math.abs(height - size.h) > 1)) setSize({ w: width, h: height })
  }
  return (
    <View testID={testID} style={[StyleSheet.absoluteFill, { backgroundColor: bg, overflow: 'hidden' }]} onLayout={onLayout}>
      <SizeCtx.Provider value={size}>{children}</SizeCtx.Provider>
    </View>
  )
}

/**
 * Bir dərinlikdəki təbəqə. `zl` verilibsə kamera yolu ilə perspektivə uyğun hərəkət edir;
 * `extra` əlavə transform (məs. yırğalanma) üçündür.
 */
export function Layer({ children, progress, path, zl, opacity, overlay, pointerEvents = 'none' }: {
  children?: ReactNode
  progress?: Animated.Value
  path?: (p: number) => Cam
  zl?: number
  opacity?: Animated.AnimatedInterpolation<number> | Animated.Value | number
  /** SVG-nin üstündə, eyni transformla hərəkət edən RN elementləri (yazılar, toxunuş sahələri). */
  overlay?: ReactNode
  pointerEvents?: 'none' | 'box-none' | 'auto'
}) {
  const { w, h } = useStage()
  const transform = useMemo(() => {
    if (!progress || !path || zl === undefined) return undefined
    const s = sampleLayer(path, zl, w, h)
    return [
      { translateX: progress.interpolate({ inputRange: s.input, outputRange: s.tx }) },
      { translateY: progress.interpolate({ inputRange: s.input, outputRange: s.ty }) },
      { scale: progress.interpolate({ inputRange: s.input, outputRange: s.k }) },
    ]
  }, [progress, path, zl, w, h])
  return (
    <Animated.View pointerEvents={pointerEvents} renderToHardwareTextureAndroid={false}
      style={[StyleSheet.absoluteFill, transform ? { transform } : null, opacity !== undefined ? { opacity } : null]}>
      <Svg width={w} height={h} viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {children}
      </Svg>
      {overlay}
    </Animated.View>
  )
}

/** viewBox nöqtəsini ekran pikselinə çevirir. */
export function useToScreen() {
  const { w, h } = useStage()
  return useMemo(() => {
    const f = fit(w, h)
    return { s: f.s, x: (vx: number) => f.ox + vx * f.s, y: (vy: number) => f.oy + vy * f.s }
  }, [w, h])
}

/** Səhnədəki yazı (lövhə, qapı lövhəciyi, ad kartı): mərkəzi viewBox nöqtəsində, ölçüsü viewBox vahidi ilə. */
export function SceneText({ x, y, size, width, children, style, lines = 1 }: {
  x: number; y: number; size: number; width: number; children: ReactNode; style?: StyleProp<TextStyle>; lines?: number
}) {
  const m = useToScreen()
  const wpx = width * m.s
  const fs = Math.max(6, size * m.s)
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: m.x(x) - wpx / 2, top: m.y(y) - (fs * 1.25 * lines) / 2, width: wpx, alignItems: 'center' }}>
      <Text numberOfLines={lines} style={[{ fontSize: fs, lineHeight: fs * 1.22, textAlign: 'center' }, style]}>{children}</Text>
    </View>
  )
}

/** "Azaldılmış hərəkət" və ya ekran oxuyucusu: səhnə animasiyasız birbaşa son vəziyyətə keçir. */
export function useQuietMotion(): boolean | null {
  const [v, setV] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      // Vebdə (react-native-web) bu sorğu həmişə true qaytarır: yalnız telefonda soruşulur.
      Platform.OS === 'web' ? Promise.resolve(false) : AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
    ]).then(([a, b]) => { if (alive) setV(a || b) })
    return () => { alive = false }
  }, [])
  return v
}
