/** Ortaq UI elementləri. Hər interaktiv element: accessibilityRole, label və ≥44px toxunma sahəsi. */
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { t } from '../i18n/az'
import { colors, font, radius, space, touch } from '../theme'

export function Screen({ children, scroll = true, title, back, right, padded = true }: {
  children: ReactNode; scroll?: boolean; title?: string; back?: boolean | (() => void); right?: ReactNode; padded?: boolean
}) {
  const body = <View style={[padded && s.pad, { gap: space.lg, flexGrow: 1 }]}>{children}</View>
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right', 'bottom']}>
      {(title || back) && (
        <View style={s.header}>
          {back ? (
            <Pressable
              accessibilityRole="button" accessibilityLabel={t.common.back} hitSlop={8}
              onPress={() => (typeof back === 'function' ? back() : router.canGoBack() ? router.back() : router.replace('/'))}
              style={s.backBtn}
            >
              <Text style={s.backTxt}>‹</Text>
            </Pressable>
          ) : <View style={{ width: touch }} />}
          <Text style={s.headerTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
          <View style={{ minWidth: touch, alignItems: 'flex-end' }}>{right}</View>
        </View>
      )}
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  )
}

type Variant = 'primary' | 'ghost' | 'danger' | 'quiet'
export function Button({ label, onPress, variant = 'primary', disabled, loading, style, testID, small }: {
  label: string; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean
  style?: StyleProp<ViewStyle>; testID?: string; small?: boolean
}) {
  const off = disabled || loading
  return (
    <Pressable
      testID={testID} accessibilityRole="button" accessibilityLabel={label} aria-disabled={!!off} aria-busy={!!loading} disabled={!!off}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [s.btn, small && s.btnSmall, s[`btn_${variant}`], off && { opacity: 0.5 }, pressed && !off && { opacity: 0.85, transform: [{ scale: 0.98 }] }, style]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.ink : colors.chalk} />
        : <Text style={[s.btnTxt, small && { fontSize: font.small }, variant === 'primary' ? { color: colors.ink } : variant === 'danger' ? { color: '#fff' } : { color: colors.chalk }]}>{label}</Text>}
    </Pressable>
  )
}

export function Field({ label, error, hint, ...rest }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={s.label} nativeID={`lbl-${label}`}>{label}</Text>
      <TextInput
        accessibilityLabel={label} aria-labelledby={`lbl-${label}`} placeholderTextColor="#7f8f86"
        style={[s.input, error ? { borderColor: colors.bad } : null]} {...rest}
      />
      {error ? <Text style={s.err} accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  )
}

export function Card({ children, style, onPress, label, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string; testID?: string }) {
  if (!onPress) return <View style={[s.card, style]} testID={testID}>{children}</View>
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [s.card, style, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  )
}

export function H({ children, level = 1, style }: { children: ReactNode; level?: 1 | 2 | 3; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[level === 1 ? s.h1 : level === 2 ? s.h2 : s.h3, style]}>{children}</Text>
}
export function P({ children, dim, style, small }: { children: ReactNode; dim?: boolean; small?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.p, dim && { color: colors.chalkDim }, small && { fontSize: font.small }, style]}>{children}</Text>
}

export function ErrorBox({ message, onRetry }: { message: string | null | undefined; onRetry?: () => void }) {
  if (!message) return null
  return (
    <View style={s.errBox} accessibilityRole="alert">
      <Text style={{ color: colors.chalk, fontSize: font.small, flex: 1 }}>{message}</Text>
      {onRetry && <Button small variant="ghost" label={t.common.retry} onPress={onRetry} />}
    </View>
  )
}

export function Loading({ label = t.common.loading }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl }} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.brass} size="large" />
      <P dim>{label}</P>
    </View>
  )
}

export function Chip({ label, selected, onPress, disabled, testID }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={!!selected} aria-disabled={!!disabled} disabled={!!disabled}
      onPress={disabled ? undefined : onPress} style={[s.chip, selected && s.chipOn, disabled && { opacity: 0.45 }]}>
      <Text style={{ color: selected ? colors.ink : colors.chalk, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}

export function Check({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={value}
      onPress={() => onChange(!value)} style={s.check}>
      <View style={[s.box, value && { backgroundColor: colors.brass, borderColor: colors.brass }]}>
        {value && <Text style={{ color: colors.ink, fontWeight: '900' }}>✓</Text>}
      </View>
      <Text style={[s.p, { flex: 1 }]}>{label}</Text>
    </Pressable>
  )
}

export function Bar({ value, color = colors.ok }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v) }}>
      <View style={{ width: `${v}%`, height: '100%', backgroundColor: color, borderRadius: radius.pill }} />
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.board },
  pad: { padding: space.lg, maxWidth: 820, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.boardLine },
  backBtn: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  backTxt: { color: colors.chalk, fontSize: 34, lineHeight: 36, marginTop: -4 },
  headerTitle: { flex: 1, color: colors.chalk, fontSize: font.h3, fontWeight: '700', textAlign: 'center' },
  btn: { minHeight: touch + 4, paddingHorizontal: space.xl, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: touch, paddingHorizontal: space.md },
  btn_primary: { backgroundColor: colors.brass },
  btn_ghost: { borderWidth: 1, borderColor: colors.brassDeep, backgroundColor: 'transparent' },
  btn_danger: { backgroundColor: '#b2392c' },
  btn_quiet: { backgroundColor: colors.panel },
  btnTxt: { fontSize: font.body, fontWeight: '700' },
  label: { color: colors.chalkDim, fontSize: font.small, fontWeight: '600' },
  input: { minHeight: touch + 6, borderWidth: 1, borderColor: colors.boardLine, backgroundColor: colors.boardDeep, color: colors.chalk, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 18 },
  err: { color: colors.bad, fontSize: font.small },
  hint: { color: colors.chalkDim, fontSize: font.tiny },
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.boardLine, gap: space.sm },
  h1: { color: colors.chalk, fontSize: font.title, fontWeight: '800', fontFamily: font.serif },
  h2: { color: colors.chalk, fontSize: font.h2, fontWeight: '700' },
  h3: { color: colors.chalk, fontSize: font.h3, fontWeight: '700' },
  p: { color: colors.chalk, fontSize: font.body, lineHeight: 23 },
  errBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: '#4a1f1a', borderColor: colors.bad, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  chip: { minHeight: touch, minWidth: touch, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brassDeep, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.brass, borderColor: colors.brass },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch, paddingVertical: space.xs },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: colors.chalkDim, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.boardDeep, overflow: 'hidden' },
})
