/**
 * İki mərhələli qoruma (TOTP, R-11): müəllim və admin üçün.
 *  - MfaSetup: Kabinetdə qoşma (QR və ya gizli açar → autentifikator tətbiqi → 6 rəqəmli kod).
 *  - MfaChallenge: MFA qoşmuş istifadəçi daxil olanda kod soruşulur (aal1 → aal2).
 * Server qaydanı özü tətbiq edir (admin/* həmişə aal2; staff/* faktor varsa və ya məcburidirsə); bu ekranlar yalnız yoldur.
 */
import { createElement, useCallback, useEffect, useState } from 'react'
import { Platform, View } from 'react-native'
import { Text } from './Text'
import { t } from '../i18n/az'
import { supabase } from '../lib/supabase'
import { colors, font, space } from '../theme'
import { Button, Card, ErrorBox, Field, H, P, Screen } from './ui'

const CODE = /^\d{6}$/

/** Cari sessiyanın səviyyəsi: MFA qoşulubsa və hələ kod daxil edilməyibsə step-up lazımdır. */
export function useMfaState(sessionKey: string | null) {
  const [state, setState] = useState<{ needsStepUp: boolean; ready: boolean }>({ needsStepUp: false, ready: false })
  const check = useCallback(async () => {
    if (!sessionKey) { setState({ needsStepUp: false, ready: true }); return }
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    // Oxuna bilməsə bloklamırıq: server onsuz da yoxlayır.
    setState({ needsStepUp: !error && data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2', ready: true })
  }, [sessionKey])
  useEffect(() => { void check() }, [check])
  return { ...state, recheck: check }
}

export function MfaChallenge({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const verify = async () => {
    if (!CODE.test(code)) { setErr(t.mfa.codeBad); return }
    setBusy(true); setErr(null)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      const f = data?.totp?.find((x) => x.status === 'verified')
      if (error || !f) throw new Error(error?.message ?? t.mfa.noFactor)
      const v = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code })
      if (v.error) throw new Error(t.mfa.wrong)
      onDone()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <Screen title={t.mfa.title}>
      <H>{t.mfa.challengeTitle}</H>
      <P dim>{t.mfa.challengeSub}</P>
      <Field testID="mfa-code" label={t.mfa.code} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} onSubmitEditing={verify} returnKeyType="done" />
      <ErrorBox message={err} />
      <Button testID="mfa-verify" label={t.mfa.verify} onPress={verify} loading={busy} />
      <Button variant="ghost" label={t.profile.signOut} onPress={onSignOut} />
    </Screen>
  )
}

/** hasEmail: GoTrue TOTP qeydini e-poçt adı ilə yaradır; yalnız telefonlu hesabda qoşma uğursuz olur ("AccountName must be set"). */
export function MfaSetup({ hasEmail }: { hasEmail: boolean }) {
  const [status, setStatus] = useState<'loading' | 'off' | 'on'>('loading')
  const [enroll, setEnroll] = useState<{ id: string; secret: string; qr: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    setStatus(data?.totp?.some((f) => f.status === 'verified') ? 'on' : 'off')
  }, [])
  useEffect(() => { void load() }, [load])

  const start = async () => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      // Yarımçıq qalmış (təsdiqlənməmiş) faktorlar təmizlənir ki, yenisi qoşulsun.
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Karyeram ${new Date().toISOString().slice(0, 16)}` })
      if (error || !data) throw new Error(error?.message ?? t.system.genericError)
      setEnroll({ id: data.id, secret: data.totp.secret, qr: data.totp.qr_code })
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const confirm = async () => {
    if (!enroll) return
    if (!CODE.test(code)) { setErr(t.mfa.codeBad); return }
    setBusy(true); setErr(null)
    try {
      const v = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code })
      if (v.error) throw new Error(t.mfa.wrong)
      setEnroll(null); setCode(''); setMsg(t.mfa.enabled); await load()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  return (
    <Card testID="mfa-card">
      <H level={3}>{t.mfa.title}</H>
      <P small style={{ color: status === 'on' ? colors.ok : colors.warn }}>{status === 'loading' ? '…' : status === 'on' ? t.mfa.on : t.mfa.off}</P>
      {status === 'off' && !enroll && (<>
        <P dim small>{t.mfa.why}</P>
        {hasEmail
          ? <Button testID="mfa-enroll" label={t.mfa.enroll} onPress={start} loading={busy} />
          : <P small style={{ color: colors.warn }}>{t.mfa.needEmail}</P>}
      </>)}
      {enroll && (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <P small>{t.mfa.step1}</P>
          {Platform.OS === 'web' && enroll.qr.startsWith('data:image/')
            ? createElement('img', { src: enroll.qr, alt: 'QR', width: 180, height: 180, style: { background: '#fff', padding: 8, borderRadius: 8 } })
            : null}
          <P dim small>{t.mfa.secretLabel}</P>
          <Text testID="mfa-secret" selectable style={{ color: colors.chalk, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: font.small, letterSpacing: 1 }}>{enroll.secret}</Text>
          <P small>{t.mfa.step2}</P>
          <Field testID="mfa-enroll-code" label={t.mfa.code} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" maxLength={6} onSubmitEditing={confirm} />
          <Button testID="mfa-confirm" label={t.mfa.confirm} onPress={confirm} loading={busy} />
        </View>
      )}
      <ErrorBox message={err} />
      {msg ? <P small style={{ color: colors.ok }}>{msg}</P> : null}
    </Card>
  )
}
