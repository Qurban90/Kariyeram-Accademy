import { t } from '../src/i18n/az'
import { router } from 'expo-router'
import { Button, H, P, Screen } from '../src/components/ui'

export default function NotFound() {
  return (
    <Screen>
      <H>{t.system.notFound}</H>
      <P dim>{t.system.notFoundSub}</P>
      <Button label={t.system.backToSchool} onPress={() => router.replace('/')} />
    </Screen>
  )
}
