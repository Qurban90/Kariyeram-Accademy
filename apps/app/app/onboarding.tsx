/** Razılıqlar (FR-004, PRIV-003): şərtlər, məxfilik, 18+ məcburi; marketinq və dərs yazısı istəyə bağlı. Versiya serverdə qeyd olunur. */
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { Button, Check, ErrorBox, Field, H, P, Screen } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { api, ApiFailure } from '../src/lib/api'
import { useAuth } from '../src/lib/auth'
import { crumb } from '../src/lib/diag'
import { space } from '../src/theme'

export default function Onboarding() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [req, setReq] = useState({ terms: false, privacy: false, age18: false })
  const [opt, setOpt] = useState({ marketing: false, recording: false })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const n = name.trim().replace(/\s+/g, ' ')
    if (n.length < 2 || n.length > 80) { setErr(t.onboarding.nameLabel + ': 2–80 simvol'); return }
    if (!req.terms || !req.privacy || !req.age18) { setErr(t.onboarding.required); return }
    setBusy(true); setErr(null)
    try {
      const docs = ['terms', 'privacy', 'age18', ...(opt.marketing ? ['marketing'] : []), ...(opt.recording ? ['recording'] : [])]
      await api.consent(docs, n)
      crumb('consent_ok')
      await api.claimDevice().catch(() => {})
      await refreshProfile()
      crumb('nav_hall')
      router.replace('/')
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <H>{t.onboarding.title}</H>
      <P dim>{t.onboarding.lead}</P>
      <Field testID="name" label={t.onboarding.nameLabel} placeholder={t.onboarding.namePh} value={name} onChangeText={setName}
        autoComplete="name" textContentType="name" maxLength={80} />
      <View style={{ gap: space.xs }}>
        <Check testID="c-terms" label={t.onboarding.terms} value={req.terms} onChange={(v) => setReq({ ...req, terms: v })} />
        <Check testID="c-privacy" label={t.onboarding.privacy} value={req.privacy} onChange={(v) => setReq({ ...req, privacy: v })} />
        <Check testID="c-age" label={t.onboarding.age18} value={req.age18} onChange={(v) => setReq({ ...req, age18: v })} />
        <Check label={t.onboarding.marketing} value={opt.marketing} onChange={(v) => setOpt({ ...opt, marketing: v })} />
        <Check label={t.onboarding.recording} value={opt.recording} onChange={(v) => setOpt({ ...opt, recording: v })} />
      </View>
      <P dim small>{t.onboarding.minorNote}</P>
      <ErrorBox message={err} />
      <Button testID="enter-school" label={t.onboarding.submit} onPress={submit} loading={busy} />
      <Button variant="quiet" label={t.profile.signOut} onPress={signOut} />
    </Screen>
  )
}
