/**
 * 3D səhnənin üstündəki idarə qatı: yuxarıda ipucu və menyu, sağ aşağıda əsas düymə (Daxil ol, Otur, Pəncərə),
 * sol aşağıda ilk saniyələrdə joystik işarəsi, ortada qısa bildiriş. Səhnəyə toxunuşları kəsmir (box-none).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '../components/Icon'
import { Text } from '../components/Text'
import { t } from '../i18n/az'
import { colors, font, fx, radius, space, touch, type } from '../theme'

/** Siçanla idarə olunan cihaz (joystik işarəsi və toxunma ipucu lazım deyil). */
export const finePointer = Platform.OS === 'web' && typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(pointer: fine)').matches

export function Hud({ hint, onMenu, children, toast, showStick, menuTestID = 'hud-menu' }: {
  hint: string; onMenu: () => void; children?: ReactNode; toast?: string | null; showStick?: boolean; menuTestID?: string
}) {
  const ins = useSafeAreaInsets()
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={st.vignette} />
      <View pointerEvents="box-none" style={[st.top, { top: Math.max(12, ins.top + 8), left: Math.max(14, ins.left + 8), right: Math.max(14, ins.right + 8) }]}>
        <View style={st.hint} pointerEvents="none"><Text style={st.hintTxt}>{hint}</Text></View>
        <Pressable testID={menuTestID} accessibilityRole="button" accessibilityLabel={t.walk.menu} onPress={onMenu}
          style={({ pressed }) => [st.round, pressed && { backgroundColor: colors.surfaceTop }]}>
          <Icon name="sliders" size={20} color={colors.ivory} />
        </Pressable>
      </View>
      {showStick ? (
        <View pointerEvents="none" style={[st.joy, { left: Math.max(18, ins.left + 12), bottom: Math.max(30, ins.bottom + 22) }]}>
          <Text style={st.joyTxt}>{t.walk.stick}</Text>
        </View>
      ) : null}
      {toast ? <View pointerEvents="none" style={[st.toast, { bottom: Math.max(128, ins.bottom + 120) }]} accessibilityLiveRegion="polite"><Text style={st.toastTxt}>{toast}</Text></View> : null}
      <View pointerEvents="box-none" style={[st.acts, { right: Math.max(14, ins.right + 8), bottom: Math.max(22, ins.bottom + 14) }]}>{children}</View>
    </View>
  )
}

/** Əsas düymə: basılanda "çökən" qızılı düymə (oyun düyməsi hissi). `ghost` ikinci dərəcəli əməllər üçündür. */
export function HudButton({ label, sub, onPress, ghost, testID, icon }: {
  label: string; sub?: string; onPress: () => void; ghost?: boolean; testID?: string; icon?: 'door' | 'exit' | 'book' | 'stairs' | 'compass'
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={sub ? `${sub}. ${label}` : label} onPress={onPress}
      style={({ pressed }) => [st.cta, ghost ? st.ctaGhost : st.ctaGold, pressed && (ghost ? { backgroundColor: colors.surfaceTop } : st.ctaDown)]}>
      {icon ? <Icon name={icon} size={20} color={ghost ? colors.ivory : colors.onGold} /> : null}
      <View style={{ flexShrink: 1 }}>
        {sub ? <Text style={[st.ctaSub, { color: ghost ? colors.ivoryDim : colors.onGold }]} numberOfLines={1}>{sub}</Text> : null}
        <Text style={[st.ctaTxt, { color: ghost ? colors.ivory : colors.onGold }]} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  )
}

/** Qısa bildiriş: mətn dəyişəndə göstərilir, 2.6 saniyədən sonra özü itir. */
export function useToast(): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const show = (m: string) => {
    setMsg(m)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2600)
  }
  return [msg, show]
}

/**
 * Keçid pərdəsi: qapıdan keçəndə ekran yumşaq qaralır, o tayda yumşaq açılır (iki səhnə arasındakı kəsilmə görünmür).
 * Toxunuşları kəsmir.
 */
export function Veil({ shown, ms = 320 }: { shown: boolean; ms?: number }) {
  const a = useRef(new Animated.Value(shown ? 1 : 0)).current
  useEffect(() => { Animated.timing(a, { toValue: shown ? 1 : 0, duration: ms, useNativeDriver: true }).start() }, [a, shown, ms])
  return <Animated.View pointerEvents="none" style={[st.veil, { opacity: a }]} />
}

/** Aşağıdan qalxan görünüş (pəncərə açılanda). "Azaldılmış hərəkət"də animasiyasız. */
export function Rise({ children, style }: { children: ReactNode; style?: object }) {
  const a = useRef(new Animated.Value(0)).current
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 320, useNativeDriver: true }).start() }, [a])
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }] }]}>{children}</Animated.View>
}

const glass = { backgroundColor: 'rgba(11,10,9,0.72)', borderWidth: 1, borderColor: colors.lineStrong } as const

const st = StyleSheet.create({
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.nightDeep },
  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.38) 100%)' },
  top: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  hint: { ...glass, flexShrink: 1, maxWidth: 360, borderRadius: radius.md, paddingHorizontal: space.md + 2, paddingVertical: space.sm + 1 },
  hintTxt: { color: colors.ivory, fontSize: font.small - 1, lineHeight: 18, fontFamily: type.medium },
  round: { ...glass, width: touch + 2, height: touch + 2, borderRadius: (touch + 2) / 2, alignItems: 'center', justifyContent: 'center' },
  joy: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(246,237,224,0.38)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  joyTxt: { color: colors.ivory, fontSize: font.tiny, lineHeight: 15, textAlign: 'center', fontFamily: type.semibold },
  toast: { position: 'absolute', alignSelf: 'center', maxWidth: 420, marginHorizontal: space.xl, ...glass, backgroundColor: 'rgba(11,10,9,0.92)', borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md - 1 },
  toastTxt: { color: colors.ivory, fontSize: font.small, textAlign: 'center' },
  acts: { position: 'absolute', alignItems: 'flex-end', gap: space.sm + 2, maxWidth: '78%' },
  cta: { minHeight: 52, borderRadius: radius.lg - 2, paddingHorizontal: space.lg + 4, paddingVertical: space.sm + 2, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  ctaGold: { backgroundColor: colors.gold, backgroundImage: fx.goldFill, boxShadow: `0px 5px 0px ${colors.goldDeep}, 0px 12px 24px rgba(0,0,0,0.45)` },
  ctaDown: { transform: [{ translateY: 4 }], boxShadow: `0px 1px 0px ${colors.goldDeep}, 0px 6px 12px rgba(0,0,0,0.4)` },
  ctaGhost: { ...glass },
  ctaSub: { fontSize: font.tiny, fontFamily: type.semibold, opacity: 0.82 },
  ctaTxt: { fontSize: font.body, fontFamily: type.bold },
})
