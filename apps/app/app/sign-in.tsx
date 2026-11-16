/**
 * Parolsuz giriş: telefon (SMS OTP) və ya e-poçt (6 rəqəmli kod). Hər ikisi Supabase Auth (GoTrue) ilə.
 * Yeni istifadəçi avtomatik yaradılır; profil DB trigger-i ilə qurulur.
 */
import { isEmail, normalizeAzPhone } from '@karyeram/core/src/phone.ts'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { Lockup } from '../src/components/Brand'
import { Button, ErrorBox, Field, H, P, Screen, Segmented } from '../src/components/ui'
import { crumb } from '../src/lib/diag'
import { t } from '../src/i18n/az'
import { config } from '../src/config'
import { api } from '../src/lib/api'
import { supabase } from '../src/lib/supabase'
import { space, type } from '../src/theme'

type Method = 'phone' | 'email'
const RESEND_S = 60

function authErrorText(e: { status?: number; code?: string; message?: string }): string {
  const code = e.code ?? ''
  if (code === 'user_banned') return t.auth.banned
  if (e.status === 429 || code.startsWith('over_')) return t.auth.tooMany
  if (code === 'phone_provider_disabled' || code === 'sms_send_failed') return t.auth.smsDisabled
  if (code === 'otp_expired' || code === 'invalid_credentials' || code === 'otp_disabled') return t.auth.badCode
  if (code === 'validation_failed') return t.auth.phoneFormat
  if (e.message?.toLowerCase().includes('network') || e.message?.toLowerCase().includes('fetch')) return t.system.noInternet
  return e.message || t.system.genericError
}

export default function SignIn() {
  const [method, setMethod] = useState<Method>(config.authPhone ? 'phone' : 'email')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [fieldErr, setFieldErr] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])
  const startCountdown = () => {
    setLeft(RESEND_S)
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => setLeft((s) => { if (s <= 1 && timer.current) clearInterval(timer.current); return Math.max(0, s - 1) }), 1000)
  }

  const target = (): { phone: string } | { email: string } | null => {
    setFieldErr(null)
    if (method === 'phone') {
      const r = normalizeAzPhone(phone)
      if (!r.ok) { setFieldErr(r.reason === 'empty' ? t.auth.phoneEmpty : r.reason === 'prefix' ? t.auth.phonePrefix : t.auth.phoneFormat); return null }
      return { phone: r.e164 }
    }
    if (!isEmail(email)) { setFieldErr(t.auth.emailBad); return null }
    return { email: email.trim().toLowerCase() }
  }

  const send = async () => {
    const tg = target()
    if (!tg) return
    setBusy(true); setError(null)
    const { error: e } = await supabase.auth.signInWithOtp({ ...tg, options: { shouldCreateUser: true } } as Parameters<typeof supabase.auth.signInWithOtp>[0])
    setBusy(false)
    if (e) { setError(authErrorText(e)); return }
    setSentTo('phone' in tg ? tg.phone : tg.email)
    setCode('')
    startCountdown()
  }

  const verify = async () => {
    if (!sentTo) return
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6) { setError(t.auth.badCode); return }
    setBusy(true); setError(null)
    const params = method === 'phone'
      ? { phone: sentTo, token: clean, type: 'sms' as const }
      : { email: sentTo, token: clean, type: 'email' as const }
    crumb('otp_verify_start')
    const { error: e } = await supabase.auth.verifyOtp(params)
    if (e) { crumb('otp_verify_fail', e.status ?? ''); setBusy(false); setError(authErrorText(e)); return }
    crumb('otp_verify_ok')
    // Açıq giriş aktı: bu cihazı aktiv et (köhnə cihaz audit ilə deaktiv olur). Razılıq yoxdursa onboarding-dən sonra təkrarlanır.
    await api.claimDevice().then(() => crumb('device_claim_ok'), () => crumb('device_claim_fail'))
    setBusy(false)
    // Yönləndirmə Gate tərəfindən edilir (sessiya dəyişir).
  }

  return (
    <Screen glow>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: space.xl, flex: 1, justifyContent: 'center' }}>
        <View style={st.crest}>
          <Lockup variant="stack" />
          <P dim style={{ textAlign: 'center' }}>{t.auth.tagline}</P>
        </View>

        {!sentTo ? (
          <View style={{ gap: space.lg }}>
            {config.authPhone && config.authEmail ? (
              <Segmented value={method} onChange={(m) => { setMethod(m); setFieldErr(null); setError(null) }}
                options={[{ value: 'phone', label: t.auth.phoneTab, testID: 'tab-phone', icon: 'phone' }, { value: 'email', label: t.auth.emailTab, testID: 'tab-email', icon: 'mail' }]} />
            ) : null}
            {method === 'phone' ? (
              <Field testID="phone" label={t.auth.phoneLabel} placeholder={t.auth.phoneHint} value={phone} onChangeText={setPhone}
                keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" error={fieldErr} onSubmitEditing={send} returnKeyType="send" />
            ) : (
              <Field testID="email" label={t.auth.emailLabel} placeholder={t.auth.emailHint} value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" error={fieldErr} onSubmitEditing={send} returnKeyType="send" />
            )}
            <ErrorBox message={error} />
            <Button testID="send-code" label={t.auth.sendCode} onPress={send} loading={busy} />
            <P dim small style={{ textAlign: 'center' }}>{t.auth.privacyNote}</P>
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            <H level={2}>{t.auth.codeLabel}</H>
            <P dim>{method === 'phone' ? t.auth.codeSentPhone(sentTo) : t.auth.codeSentEmail(sentTo)}</P>
            <Field testID="otp" label={t.auth.codeLabel} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} onSubmitEditing={verify} autoFocus style={st.otp} />
            <ErrorBox message={error} />
            <Button testID="verify" label={t.auth.verify} onPress={verify} loading={busy} disabled={code.length !== 6} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm }}>
              <Button small variant="quiet" label={t.auth.changeId} onPress={() => { setSentTo(null); setError(null) }} />
              <Button small variant="ghost" label={left > 0 ? t.auth.resendIn(left) : t.auth.resend} disabled={left > 0 || busy} onPress={send} />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

const st = StyleSheet.create({
  crest: { alignItems: 'center', gap: space.md, paddingTop: space.lg },
  otp: { textAlign: 'center', fontSize: 26, letterSpacing: 10, fontFamily: type.semibold, minHeight: 60 },
})
