/** Mətn konspekti: server icazəni yoxlayır, mətn su nişanı və ekran qoruması altında göstərilir. */
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { useScreenGuard } from '../../src/components/ScreenGuard'
import { ErrorBox, Loading, Screen } from '../../src/components/ui'
import { Watermark } from '../../src/components/Watermark'
import { api } from '../../src/lib/api'
import { colors, font, space } from '../../src/theme'

export default function LibraryText() {
  const { id } = useLocalSearchParams<{ id: string }>()
  useScreenGuard('library')
  const q = useQuery({ queryKey: ['library-open', id], queryFn: () => api.libraryOpen(id), staleTime: 0, gcTime: 0 })
  return (
    <View style={{ flex: 1, backgroundColor: colors.board }}>
      <Screen back title={q.data?.title ?? ''}>
        {q.isLoading && <Loading />}
        <ErrorBox message={q.error ? (q.error as Error).message : null} onRetry={() => q.refetch()} />
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
