/**
 * Veb: su nişanlı PDF tətbiqin içində (brauzerin PDF görüntüləyicisi, iframe) açılır, üstündə tətbiqin su nişanı da qalır.
 * Faylın özündə də hər səhifədə tələbə nömrəsi var (server vurur), endirilsə belə mənbə görünür.
 */
import { createElement, useEffect, useState } from 'react'
import { View } from 'react-native'
import { Button, P } from './ui'
import { t } from '../i18n/az'

export function PdfView({ data, name }: { data: ArrayBuffer; name: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [data])
  if (!url) return null
  const download = () => {
    const a = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
  }
  return (
    <View style={{ gap: 12 }}>
      {createElement('iframe', {
        src: url, title: name, 'data-testid': 'pdf-frame',
        style: { width: '100%', height: '75vh', border: 0, borderRadius: 8, background: '#fff' },
      })}
      <P dim small>{t.library.webHint}</P>
      {/* Android Chrome-da daxili PDF görüntüləyicisi yoxdur: yeni tab (istifadəçi kliki ilə, popup bloklanmır) və ya endirmə. */}
      <Button testID="pdf-newtab" label={t.library.openTab} onPress={() => { window.open(url, '_blank', 'noopener') }} />
      <Button variant="ghost" testID="pdf-download" label={t.library.download} onPress={download} />
    </View>
  )
}
