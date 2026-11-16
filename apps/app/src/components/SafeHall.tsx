/**
 * Ən sadə əsas ekran. Tam zal ekranı telefonda iki dəfə ardıcıl açılmayanda (çökmə, donma) göstərilir ki, tətbiq istifadəsiz
 * qalmasın. Bilərəkdən yalnız ən sadə elementlərdən yığılıb: düz rəngli qutular və mətn; ikon (SVG), qradiyent, kölgə,
 * animasiya və 3D yoxdur. Dizayn sisteminin komponentləri burada işlənmir, çünki çökən məhz onlardan biri ola bilər.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { t } from '../i18n/az'
import { colors } from '../theme'

export interface SafeRow { key: string; title: string; sub?: string; onPress: () => void }

export function SafeHall({ greeting, rooms, links, onRetryFull }: { greeting: string; rooms: SafeRow[]; links: SafeRow[]; onRetryFull: () => void }) {
  const row = (r: SafeRow) => (
    <Pressable key={r.key} testID={`safe-${r.key}`} accessibilityRole="button" accessibilityLabel={r.title} onPress={r.onPress} style={st.row}>
      <Text style={st.title}>{r.title}</Text>
      {r.sub ? <Text style={st.sub}>{r.sub}</Text> : null}
    </Pressable>
  )
  return (
    <SafeAreaView style={st.screen}>
      <ScrollView contentContainerStyle={st.body}>
        <Text style={st.h}>{greeting}</Text>
        <Text style={st.note}>{t.safe.note}</Text>
        <Text style={st.head}>{t.hall.rooms}</Text>
        <View style={st.group}>{rooms.map(row)}</View>
        <View style={st.group}>{links.map(row)}</View>
        <Pressable testID="safe-retry-full" accessibilityRole="button" accessibilityLabel={t.safe.retryFull} onPress={onRetryFull} style={st.retry}>
          <Text style={st.retryTxt}>{t.safe.retryFull}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  body: { padding: 16, gap: 14 },
  h: { color: colors.ivory, fontSize: 26 },
  note: { color: colors.ivoryDim, fontSize: 14, lineHeight: 20 },
  head: { color: colors.ivory, fontSize: 18, marginTop: 6 },
  group: { gap: 8 },
  row: { minHeight: 56, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  title: { color: colors.ivory, fontSize: 16 },
  sub: { color: colors.ivoryDim, fontSize: 13, marginTop: 2 },
  retry: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, marginTop: 8 },
  retryTxt: { color: colors.ivory, fontSize: 15 },
})
