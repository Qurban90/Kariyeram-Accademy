/**
 * Native: su nişanlı PDF tətbiqin keş qovluğuna yazılır və sistemin görüntüləyicisi/paylaşma pəncərəsi ilə açılır.
 * Faylın hər səhifəsində tələbə nömrəsi var (server vurur). Real cihazda yoxlanmayıb (NFR-001).
 */
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useState } from 'react'
import { View } from 'react-native'
import { t } from '../i18n/az'
import { Button, ErrorBox, P } from './ui'

export function PdfView({ data, name }: { data: ArrayBuffer; name: string }) {
  const [err, setErr] = useState<string | null>(null)
  const open = async () => {
    setErr(null)
    try {
      const f = new File(Paths.cache, name)
      if (f.exists) f.delete()
      f.create()
      f.write(new Uint8Array(data))
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name })
      else setErr(t.library.openFailed)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }
  return (
    <View style={{ gap: 12 }}>
      <P dim small>{t.library.pdfReady}</P>
      <Button testID="pdf-open" label={t.library.openPdf} onPress={open} />
      <ErrorBox message={err} />
    </View>
  )
}
