/**
 * Ortaq UI elementləri. Hər interaktiv element: accessibilityRole, label və ≥44px toxunma sahəsi.
 * Vizual qayda: səthlər sakit və tünddür, qızılı yalnız seçimi və növbəti addımı göstərir (bax theme.ts).
 */
import { router } from 'expo-router'
import { useRef, useState, type ComponentRef, type ReactNode } from 'react'
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { t } from '../i18n/az'
import { StatusBar } from 'expo-status-bar'
import { font, fx, fxOf, radius, roomColors, space, touch, type, type Palette } from '../theme'
import { Icon, type IconName } from './Icon'
import { Text } from './Text'
import { usePalette, useSheet } from './Theme'

export { Icon, type IconName } from './Icon'
export { Text } from './Text'
export { RoomTheme, usePalette, useSheet } from './Theme'

/* ───────────────────────── Konteynerlər ───────────────────────── */

export function Screen({ children, scroll = true, title, back, right, padded = true, glow }: {
  children: ReactNode; scroll?: boolean; title?: string; back?: boolean | (() => void); right?: ReactNode; padded?: boolean
  /** Yuxarıdan düşən fənər işığı: giriş və məktəb zalı kimi "qarşılama" ekranları üçün. */
  glow?: boolean
}) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const body = <View style={[padded && s.pad, { gap: space.lg, flexGrow: 1 }]}>{children}</View>
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style={colors === roomColors ? 'dark' : 'light'} />
      {glow ? <View style={s.lamp} /> : null}
      {(title || back) && (
        <View style={s.header}>
          {back ? (
            <Pressable
              accessibilityRole="button" accessibilityLabel={t.common.back} hitSlop={8}
              onPress={() => (typeof back === 'function' ? back() : router.canGoBack() ? router.back() : router.replace('/'))}
              style={({ pressed }) => [s.backBtn, pressed && { backgroundColor: colors.surfaceHi }]}
            >
              <Icon name="back" size={22} />
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

/** Səhifə bölməsi: serif başlıq, sağda istəyə bağlı əməl, altında məzmun. */
export function Section({ title, right, children, gap = space.md, testID }: { title: string; right?: ReactNode; children?: ReactNode; gap?: number; testID?: string }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  return (
    <View style={{ gap }} testID={testID}>
      <View style={s.sectionHead}>
        <H level={2} style={{ flexShrink: 1 }}>{title}</H>
        {right}
      </View>
      {children}
    </View>
  )
}

type CardTone = 'plain' | 'gold' | 'bad' | 'trap'
export function Card({ children, style, onPress, label, testID, tone = 'plain' }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string; testID?: string; tone?: CardTone
}) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const base = [s.card, tone === 'gold' && s.cardGold, tone === 'bad' && { borderColor: colors.bad }, tone === 'trap' && { borderColor: colors.trap }]
  if (!onPress) return <View style={[base, style]} testID={testID}>{children}</View>
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [base, style, pressed && s.cardPressed]}>
      {children}
    </Pressable>
  )
}

/** Bir neçə sətri bir səthdə birləşdirir (aralarında incə xətt). Kart içində kart əvəzinə işlənir. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean)
  return (
    <View style={[s.group, style]}>
      {items.map((c, i) => (
        <View key={i}>
          {i > 0 ? <View style={s.groupLine} /> : null}
          {c}
        </View>
      ))}
    </View>
  )
}

export function ListRow({ icon, title, sub, onPress, right, testID, label }: {
  icon?: IconName; title: string; sub?: string; onPress?: () => void; right?: ReactNode; testID?: string; label?: string
}) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const inner = (
    <>
      {icon ? <View style={s.rowIcon}><Icon name={icon} size={20} color={colors.gold} /></View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" size={18} color={colors.ivoryFaint} /> : null)}
    </>
  )
  if (!onPress) return <View style={s.row} testID={testID}>{inner}</View>
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label ?? title} onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surfaceHi }]}>
      {inner}
    </Pressable>
  )
}

/** Siyahıda seçilən sətir (məs. mövzu): sağda işarə qutusu, bağlıdırsa qıfıl. */
export function SelectRow({ title, sub, selected, onPress, disabled, locked, testID }: {
  title: string; sub?: string; selected?: boolean; onPress: () => void; disabled?: boolean; locked?: boolean; testID?: string
}) {
  const colors = usePalette()
  const s = useSheet(makeS)
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityLabel={sub ? `${title}, ${sub}` : title} aria-checked={!!selected} aria-disabled={!!disabled} disabled={!!disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [s.row, selected && { backgroundColor: colors.goldWash }, disabled && { opacity: 0.5 }, pressed && !disabled && { backgroundColor: colors.surfaceHi }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {locked ? <Icon name="lock" size={18} color={colors.ivoryFaint} /> : (
        <View style={[s.box, selected && s.boxOn]}>
          {selected ? <Icon name="check" size={16} color={colors.onGold} strokeWidth={2.6} /> : null}
        </View>
      )}
    </Pressable>
  )
}

export function Divider() {
  const colors = usePalette()
  const s = useSheet(makeS)
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong }} />
}

/** Modal pəncərə: telefonda aşağıdan qalxan vərəq, enli ekranda mərkəzdə dialoq. Fona toxunmaq və ya "Bağla" bağlayır. */
export function Sheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; testID?: string }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const { width } = useWindowDimensions()
  const wide = width >= 640
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.scrim, wide ? { justifyContent: 'center', alignItems: 'center', padding: space.xl } : { justifyContent: 'flex-end' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
        <View testID={testID} style={[s.sheet, wide ? s.sheetWide : s.sheetNarrow]} accessibilityViewIsModal role="dialog" aria-modal aria-label={title}>
          {!wide ? <View style={s.grabber} /> : null}
          <View style={s.sheetHead}>
            <H level={2} style={{ flex: 1 }}>{title}</H>
            <Pressable accessibilityRole="button" accessibilityLabel={t.common.close} onPress={onClose} hitSlop={8}
              style={({ pressed }) => [s.closeBtn, pressed && { backgroundColor: colors.line }]}>
              <Icon name="x" size={18} color={colors.ivoryDim} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }} style={{ flexShrink: 1 }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  )
}

/* ───────────────────────── Mətn ───────────────────────── */

export function H({ children, level = 1, style }: { children: ReactNode; level?: 1 | 2 | 3; style?: StyleProp<TextStyle> }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  return <Text accessibilityRole="header" style={[level === 1 ? s.h1 : level === 2 ? s.h2 : s.h3, style]}>{children}</Text>
}
export function P({ children, dim, style, small }: { children: ReactNode; dim?: boolean; small?: boolean; style?: StyleProp<TextStyle> }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  return <Text style={[s.p, dim && { color: colors.ivoryDim }, small && s.pSmall, style]}>{children}</Text>
}

/* ───────────────────────── Əməllər ───────────────────────── */

type Variant = 'primary' | 'ghost' | 'danger' | 'quiet'
export function Button({ label, onPress, variant = 'primary', disabled, loading, style, testID, small, icon }: {
  label: string; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean
  style?: StyleProp<ViewStyle>; testID?: string; small?: boolean; icon?: IconName
}) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const off = disabled || loading
  const fg = variant === 'primary' ? colors.onGold : variant === 'danger' ? '#FFFFFF' : colors.ivory
  return (
    <Pressable
      testID={testID} accessibilityRole="button" accessibilityLabel={label} aria-disabled={!!off} aria-busy={!!loading} disabled={!!off}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [s.btn, small && s.btnSmall, s[`btn_${variant}`], off && s.btnOff, pressed && !off && s.btnPressed, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={s.btnInner}>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[s.btnTxt, small && { fontSize: font.small }, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  )
}

/** Yalnız ikonlu dairəvi düymə; `label` ekran oxuyucusu üçündür. */
export function IconButton({ icon, label, onPress, testID, tone = 'plain' }: { icon: IconName; label: string; onPress: () => void; testID?: string; tone?: 'plain' | 'gold' }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [s.backBtn, tone === 'gold' && { borderColor: colors.goldLine, backgroundColor: colors.goldWash }, pressed && { backgroundColor: colors.surfaceHi }]}>
      <Icon name={icon} size={20} color={tone === 'gold' ? colors.goldBright : colors.ivory} />
    </Pressable>
  )
}

export function Chip({ label, selected, onPress, disabled, testID, icon }: {
  label: string; selected?: boolean; onPress: () => void; disabled?: boolean; testID?: string; icon?: IconName
}) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const fg = selected ? colors.goldBright : colors.ivory
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={!!selected} aria-disabled={!!disabled} disabled={!!disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [s.chip, selected && s.chipOn, disabled && { opacity: 0.4 }, pressed && !disabled && { backgroundColor: selected ? colors.goldWash : colors.surfaceHi }]}>
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: selected ? '600' : '500', fontSize: font.small + 1, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  )
}

/** İki-üç seçim arasında keçid (məs. Telefon / E-poçt). */
export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; testID?: string; icon?: IconName }[]
}) {
  const colors = usePalette()
  const s = useSheet(makeS)
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable key={o.value} testID={o.testID} accessibilityRole="tab" accessibilityLabel={o.label} aria-selected={on}
            onPress={() => onChange(o.value)} style={[s.segItem, on && s.segItemOn]}>
            {o.icon ? <Icon name={o.icon} size={16} color={on ? colors.goldBright : colors.ivoryDim} /> : null}
            <Text style={{ color: on ? colors.ivory : colors.ivoryDim, fontWeight: on ? '600' : '500', fontSize: font.small + 1 }}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function Check({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={value}
      onPress={() => onChange(!value)} style={s.check}>
      <View style={[s.box, value && s.boxOn]}>
        {value ? <Icon name="check" size={16} color={colors.onGold} strokeWidth={2.6} /> : null}
      </View>
      <Text style={[s.p, { flex: 1 }]}>{label}</Text>
    </Pressable>
  )
}

/* ───────────────────────── Forma və vəziyyət ───────────────────────── */

export function Field({ label, error, hint, style, onFocus, onBlur, ...rest }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text style={s.label} nativeID={`lbl-${label}`}>{label}</Text>
      <TextInput
        accessibilityLabel={label} aria-labelledby={`lbl-${label}`} placeholderTextColor={colors.ivoryFaint}
        selectionColor={colors.gold} cursorColor={colors.gold}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }} onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        style={[s.input, focused && s.inputFocus, error ? { borderColor: colors.bad } : null, style]} {...rest}
      />
      {error ? <Text style={s.err} accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  )
}

/** 6 xanalı təsdiq kodu: görünən xanalar, üstündə şəffaf həqiqi giriş (testID orada qalır — SMS avtodoldurma və testlər işləyir). */
export function OtpInput({ value, onChange, onSubmit, label, error, autoFocus, testID }: {
  value: string; onChange: (v: string) => void; onSubmit?: () => void; label: string; error?: boolean; autoFocus?: boolean; testID?: string
}) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const ref = useRef<ComponentRef<typeof TextInput>>(null)
  const [focused, setFocused] = useState(false)
  const active = Math.min(value.length, 5)
  return (
    <Pressable accessible={false} onPress={() => ref.current?.focus()} style={s.otpRow}>
      <TextInput
        ref={ref} testID={testID} value={value} accessibilityLabel={label}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6}
        onSubmitEditing={onSubmit} autoFocus={autoFocus} caretHidden
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={s.otpHidden}
      />
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={[s.otpCell, focused && i === active && s.otpCellOn, error && { borderColor: colors.bad }]}>
          <Text style={s.otpDigit}>{value[i] ?? ''}</Text>
        </View>
      ))}
    </Pressable>
  )
}

export function ErrorBox({ message, onRetry }: { message: string | null | undefined; onRetry?: () => void }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  if (!message) return null
  return (
    <View style={s.errBox} accessibilityRole="alert">
      <Icon name="alert" size={18} color={colors.bad} />
      <Text style={{ color: colors.ivory, fontSize: font.small, lineHeight: 20, flex: 1 }}>{message}</Text>
      {onRetry && <Button small variant="ghost" label={t.common.retry} onPress={onRetry} />}
    </View>
  )
}

export function Loading({ label = t.common.loading }: { label?: string }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl }} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.gold} size="large" />
      <P dim small>{label}</P>
    </View>
  )
}

/* ───────────────────────── Vidjetlər ───────────────────────── */

type Tone = 'neutral' | 'gold' | 'ok' | 'bad' | 'trap' | 'live' | 'warn'
const toneOf = (colors: Palette): Record<Tone, { fg: string; bg: string; line: string }> => ({
  neutral: { fg: colors.ivoryDim, bg: 'transparent', line: colors.lineStrong },
  gold: { fg: colors.goldBright, bg: colors.goldWash, line: colors.goldLine },
  ok: { fg: colors.ok, bg: colors.okWash, line: 'rgba(140,203,160,0.4)' },
  bad: { fg: colors.bad, bg: colors.badWash, line: 'rgba(236,130,114,0.4)' },
  warn: { fg: colors.warn, bg: 'rgba(232,154,91,0.12)', line: 'rgba(232,154,91,0.4)' },
  trap: { fg: colors.trap, bg: 'rgba(200,162,232,0.12)', line: 'rgba(200,162,232,0.45)' },
  live: { fg: '#FFFFFF', bg: colors.badSolid, line: colors.live },
})

export function Badge({ label, tone = 'neutral', icon, dot, testID }: { label: string; tone?: Tone; icon?: IconName; dot?: boolean; testID?: string }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const c = toneOf(colors)[tone]
  return (
    <View testID={testID} style={[s.badge, { backgroundColor: c.bg, borderColor: c.line }]}>
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.fg }} /> : null}
      {icon ? <Icon name={icon} size={13} color={c.fg} strokeWidth={2} /> : null}
      <Text style={{ color: c.fg, fontSize: font.tiny, fontWeight: '600', letterSpacing: 0.2 }}>{label}</Text>
    </View>
  )
}

/** Böyük rəqəm və altında izahı (nəticə, seriya, xal). */
export function Stat({ value, label, color, align = 'center' }: { value: string | number; label: string; color?: string; align?: 'center' | 'left' }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start', minWidth: 72, gap: 2 }}>
      <Text style={{ color: color ?? colors.ivory, fontFamily: type.display, fontSize: font.title, lineHeight: 34, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: colors.ivoryDim, fontSize: font.tiny, fontWeight: '500', letterSpacing: 0.3 }}>{label}</Text>
    </View>
  )
}

export function Bar({ value, color }: { value: number; color?: string }) {
  const colors = usePalette()
  const s = useSheet(makeS)
  const v = Math.max(0, Math.min(100, value))
  return (
    <View style={s.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v) }}>
      <View style={{ width: `${v}%`, height: '100%', backgroundColor: color ?? colors.gold, borderRadius: radius.pill }} />
    </View>
  )
}

const makeS = (colors: Palette) => {
  const f = fxOf(colors)
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  lamp: { position: 'absolute', top: 0, left: 0, right: 0, height: 420, backgroundImage: fx.lamp, pointerEvents: 'none' },
  pad: { padding: space.lg, paddingBottom: space.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, minHeight: 60, gap: space.sm },
  backBtn: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  headerTitle: { flex: 1, color: colors.ivory, fontFamily: type.display, fontSize: 19, textAlign: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },

  card: { backgroundColor: colors.surface, boxShadow: f.cardShadow, borderRadius: radius.lg, padding: space.lg + 2, borderWidth: 1, borderColor: colors.line, gap: space.sm },
  cardGold: { borderColor: colors.goldLine, backgroundImage: f.beam },
  cardPressed: { backgroundColor: colors.surfaceHi, transform: [{ scale: 0.992 }] },
  group: { backgroundColor: colors.surface, boxShadow: f.cardShadow, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  groupLine: { height: 1, backgroundColor: colors.line, marginLeft: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md + 2, minHeight: touch + 16 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldWash },
  rowTitle: { color: colors.ivory, fontSize: font.body, fontWeight: '600' },
  rowSub: { color: colors.ivoryDim, fontSize: font.small, lineHeight: 19 },

  scrim: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surfaceTop, borderColor: colors.lineStrong, borderWidth: 1, padding: space.xl, gap: space.lg, maxHeight: '88%', boxShadow: f.lift },
  sheetNarrow: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderBottomWidth: 0, paddingTop: space.md, paddingBottom: space.xxl },
  sheetWide: { borderRadius: radius.xl, width: '100%', maxWidth: 460 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong },
  closeBtn: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center' },

  h1: { color: colors.ivory, fontFamily: type.display, fontSize: 30, lineHeight: 37, letterSpacing: -0.3 },
  h2: { color: colors.ivory, fontFamily: type.display, fontSize: font.h2, lineHeight: 28, letterSpacing: -0.1 },
  h3: { color: colors.ivory, fontSize: font.h3, lineHeight: 23, fontWeight: '600' },
  p: { color: colors.ivory, fontSize: font.body, lineHeight: 24 },
  pSmall: { fontSize: font.small, lineHeight: 20 },

  btn: { minHeight: touch + 8, paddingHorizontal: space.xl, borderRadius: radius.md + 2, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: touch, paddingHorizontal: space.lg, borderRadius: radius.md },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  btn_primary: { backgroundColor: '#E9B23C', backgroundImage: fx.goldFill, boxShadow: f.goldGlow },
  btn_ghost: { borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'transparent' },
  btn_danger: { backgroundColor: colors.badSolid },
  btn_quiet: { backgroundColor: colors.surfaceHi },
  btnOff: { opacity: 0.42, boxShadow: 'none' },
  btnPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  btnTxt: { fontSize: font.body, fontWeight: '600', letterSpacing: 0.1 },

  chip: { flexDirection: 'row', gap: space.sm, minHeight: touch, minWidth: touch, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.goldWash, borderColor: colors.gold },
  seg: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.nightDeep, borderWidth: 1, borderColor: colors.line },
  segItem: { flex: 1, flexDirection: 'row', gap: space.sm, minHeight: touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  segItemOn: { backgroundColor: colors.surfaceTop, borderColor: colors.goldLine },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch, paddingVertical: space.xs + 2 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ivoryFaint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.gold, borderColor: colors.gold },

  label: { color: colors.ivoryDim, fontSize: font.small, fontWeight: '500' },
  input: { minHeight: touch + 8, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.nightDeep, color: colors.ivory, borderRadius: radius.sm + 2, paddingHorizontal: space.lg, fontSize: 17, fontFamily: type.body, outlineWidth: 0 },
  inputFocus: { borderColor: colors.gold, boxShadow: f.focusRing },
  err: { color: colors.bad, fontSize: font.small },
  hint: { color: colors.ivoryFaint, fontSize: font.tiny },
  errBox: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.badWash, borderColor: 'rgba(236,130,114,0.4)', borderWidth: 1, borderRadius: radius.md, padding: space.md },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },

  otpRow: { flexDirection: 'row', gap: space.sm },
  otpHidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, fontSize: 17 },
  otpCell: { flex: 1, height: 60, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.nightDeep, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  otpCellOn: { borderColor: colors.gold, boxShadow: f.focusRing },
  otpDigit: { color: colors.ivory, fontSize: 24, fontFamily: type.semibold, fontVariant: ['tabular-nums'] },
})
}
