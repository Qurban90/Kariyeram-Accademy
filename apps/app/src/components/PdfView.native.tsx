/**
 * Native: su nişanlı PDF müvəqqəti keş faylı kimi açılır (sistem görüntüləyicisi).
 * Fayl paylaşımdan dərhal sonra və ekran bağlananda silinir: cihazda daimi nüsxə qalmır.
 * Hər səhifədə tələbə nömrəsi var (server vurur) — sızma halında mənbə müəyyən olunur.
 * Qeyd: sistem paylaşma pəncərəsi faylı başqa tətbiqə ötürə bilər; tam qapalı görüntüləyici
 * mağaza buraxılışından əvvəl ayrıca native komponentlə əlavə olunacaq.
 */
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { t } from '../i18n/az'
import { Button, ErrorBox, P } from './ui'

export function PdfView({ data, name }: { data: ArrayBuffer; name: string }) {
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<File | null>(null)
  // Ekran bağlananda müvəqqəti fayl silinir.
  useEffect(() => () => { try { fileRef.current?.delete() } catch { /* artıq silinib */ } }, [])
  const open = async () => {
    setErr(null)
    let f: File | null = null
    try {
      f = new File(Paths.cache, name)
      fileRef.current = f
      if (f.exists) f.delete()
      f.create()
      f.write(new Uint8Array(data))
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name })
      else setErr(t.library.openFailed)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { try { f?.delete() } catch { /* artıq silinib */ } }
  }
  return (
    <View style={{ gap: 12 }}>
      <P dim small>{t.library.pdfReady}</P>
      <Button testID="pdf-open" label={t.library.openPdf} onPress={open} />
      <ErrorBox message={err} />
    </View>
  )
}