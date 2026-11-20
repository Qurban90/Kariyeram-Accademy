/**
 * Akademiyanın reklamı: tətbiq pulsuzdur, dərs materialları və canlı dərs isə kurs tələbələri üçündür.
 * Hər yerdə eyni söz və eyni iki hərəkət: zəng et, WhatsApp-da yaz.
 */
import { Linking, StyleSheet, View } from 'react-native'
import { config } from '../config'
import { t } from '../i18n/az'
import { space } from '../theme'
import { Icon } from './Icon'
import { usePalette } from './Theme'
import { Button, H, P, Sheet } from './ui'

/** Nömrəni beynəlxalq formata çevirir (WhatsApp üçün): 010 375 85 93 → 994103758593. */
export function waNumber(local: string): string {
  const d = local.replace(/\D/g, '')
  if (d.startsWith('994')) return d
  return `994${d.replace(/^0/, '')}`
}

export const callAcademy = () => void Linking.openURL(`tel:${config.contactPhone}`).catch(() => {})
export const writeAcademy = () => void Linking.openURL(`https://wa.me/${waNumber(config.contactPhone)}?text=${encodeURIComponent(t.promo.waText)}`).catch(() => {})

/** Səhifənin sonunda reklam bloku (kart deyil: səhifənin öz hissəsi). */
export function Promo({ testID = 'promo' }: { testID?: string }) {
  const colors = usePalette()
  return (
    <View testID={testID} style={[st.wrap, { borderColor: colors.goldLine, backgroundColor: colors.goldWash }]}>
      <View style={st.head}>
        <Icon name="screen" size={20} color={colors.gold} />
        <H level={3} style={{ flex: 1 }}>{t.promo.title}</H>
      </View>
      <P dim small>{t.promo.lead}</P>
      <P style={st.phone}>{config.contactPhoneDisplay}</P>
      <View style={st.row}>
        <Button testID={`${testID}-call`} small icon="phone" label={t.promo.call} onPress={callAcademy} style={{ flex: 1 }} />
        <Button testID={`${testID}-wa`} small icon="chat" variant="ghost" label={t.promo.write} onPress={writeAcademy} style={{ flex: 1 }} />
      </View>
      <P dim small>{t.promo.free}</P>
    </View>
  )
}

/** Partadakı stikerə toxunanda açılan pəncərə. */
export function PromoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={t.promo.title} testID="promo-sheet">
      <P dim>{t.promo.lead}</P>
      <P style={st.phone}>{config.contactPhoneDisplay}</P>
      <Button testID="promo-sheet-call" icon="phone" label={t.promo.call} onPress={callAcademy} />
      <Button testID="promo-sheet-wa" icon="chat" variant="ghost" label={t.promo.write} onPress={writeAcademy} />
      <P dim small>{t.promo.free}</P>
    </Sheet>
  )
}

const st = StyleSheet.create({
  wrap: { gap: space.sm, padding: space.lg, borderRadius: 18, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  phone: { fontSize: 22, fontWeight: '700', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap', marginTop: space.xs },
})
