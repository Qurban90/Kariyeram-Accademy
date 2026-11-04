/**
 * Konspekt: server icazəni yoxlayır. Mətn su nişanı və ekran qoruması altında göstərilir;
 * PDF serverdə tələbə nömrəsi ilə möhürlənib gəlir (fayla birbaşa ünvan verilmir).
 */
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { useScreenGuard } from '../../src/components/ScreenGuard'
import { PdfView } from '../../src/components/PdfView'
import { ErrorBox, Loading, Screen } from '../../src/components/ui'
import { Watermark } from '../../src/components/Watermark'
import { api } from '../../src/lib/api'
import { t } from '../../src/i18n/az'
import { colors, font, space } from '../../src/theme'

export default function LibraryText() {
  const { id, kind, title } = useLocalSearchParams<{ id: string; kind?: string; title?: string }>()
  const isPdf = kind === 'pdf'
  useScreenGuard('library')
  // Hər açılış serverdə audit-ə yazılır: keşləmirik və təkrar cəhd etmirik.
  const q = useQuery({ queryKey: ['library-open', id], queryFn: () => api.libraryOpen(id), staleTime: 0, gcTime: 0, enabled: !isPdf, retry: false })
  const pdf = useQuery({ queryKey: ['library-pdf', id], queryFn: () => api.libraryPdf(id), staleTime: 0, gcTime: 0, enabled: isPdf, retry: false })
  return (
    <View style={{ flex: 1, backgroundColor: colors.board }}>
      <Screen back title={q.data?.title ?? title ?? ''}>
        {(q.isLoading || pdf.isLoading) && <Loading label={isPdf ? t.library.preparing : undefined} />}
        <ErrorBox message={q.error ? (q.error as Error).message : null} onRetry={() => q.refetch()} />
        <ErrorBox message={pdf.error ? (pdf.error as Error).message : null} onRetry={() => pdf.refetch()} />
        {pdf.data ? <PdfView data={pdf.data} name={`konspekt-${String(id).slice(0, 8)}.pdf`} /> : null}
        {q.data?.body ? (
          <View style={{ gap: space.md }} testID="library-body">
            {q.data.body.split(/\n{2,}/).map((para, i) => (
              <Text key={i} selectable={false} style={{ color: colors.chalk, fontSize: font.body + 1, lineHeight: 27 }}>{para}</Text>
            ))}
          </View>
        ) : null}
      </Screen>
      <Watermark value={q.data?.watermark} />
    </View>
  )
}
