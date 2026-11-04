/** Native: fayl tətbiqin keş qovluğuna yazılır və sistem paylaşma pəncərəsi açılır (istifadəçi harada saxlayacağını seçir). */
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

export async function saveJson(name: string, data: unknown): Promise<void> {
  const f = new File(Paths.cache, name)
  if (f.exists) f.delete()
  f.create()
  f.write(JSON.stringify(data, null, 2))
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: name })
}
