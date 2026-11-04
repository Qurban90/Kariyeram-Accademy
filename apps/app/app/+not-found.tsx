import { router } from 'expo-router'
import { Button, H, P, Screen } from '../src/components/ui'

export default function NotFound() {
  return (
    <Screen>
      <H>Bu otaq tapılmadı</H>
      <P dim>Ünvan səhvdir və ya otaq bağlanıb.</P>
      <Button label="Məktəbə qayıt" onPress={() => router.replace('/')} />
    </Screen>
  )
}
