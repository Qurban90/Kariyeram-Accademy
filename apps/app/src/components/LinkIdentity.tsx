/**
 * Hesaba ikinci giriş üsulu bağlamaq (FR-003): telefonla qeydiyyatdan keçən e-poçt, e-poçtla keçən telefon əlavə edir.
 * Supabase Auth: updateUser → yeni ünvana/nömrəyə kod → verifyOtp(email_change | phone_change). Sonra hər ikisi ilə giriş olur.
 */
import { isEmail, maskPhone, normalizeAzPhone } from '@karyeram/core/src/phone.ts'
import { useState } from 'react'
import { View } from 'react-native'
import { config } from '../config'
import { t } from '../i18n/az'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { colors, space } from '../theme'
import { Button, ErrorBox, Field, H, Icon, P } from './ui'

type Kind = 'email' | 'phone'

export function LinkIdentity() {
  const { session } = useAuth()
  const user = session?.user
  const [open, setOpen] = useState<Kind | null>(null)
  const [value, setValue] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const reset = () => { setOpen(null); setValue(''); setTarget(null); setCode(''); setErr(null) }

  const send = async () => {
    setErr(null)
    let attrs: { email: string } | { phone: string }
    if (open === 'phone') {
      const r = normalizeAzPhone(value)
      if (!r.ok) { setErr(r.reason === 'prefix' ? t.auth.phonePrefix : t.auth.phoneFormat); return }
      attrs = { phone: r.e164 }
    } else {
      if (!isEmail(value)) { setErr(t.auth.emailBad); return }
      attrs = { email: value.trim().toLowerCase() }
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser(attrs)
    setBusy(false)
    if (error) { setErr(error.code === 'email_exists' || error.code === 'phone_exists' ? t.link.taken : error.message); return }
    setTarget('phone' in attrs ? attrs.phone : attrs.email)
  }

  const verify = async () => {
    if (!target) return
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.verifyOtp(open === 'phone'
      ? { phone: target, token: code, type: 'phone_change' }
      : { email: target, token: code, type: 'email_change' })
    setBusy(false)
    if (error) { setErr(t.auth.badCode); return }
    await supabase.auth.refreshSession().catch(() => {})
    setDone(t.link.done); reset()
  }

  return (
    <View style={{ gap: space.sm }}>
      <H level={2}>{t.link.title}</H>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name="phone" size={18} color={colors.ivoryDim} /><P small>{user?.phone ? maskPhone(user.phone) : t.link.none}</P>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name="mail" size={18} color={colors.ivoryDim} /><P small>{user?.email || t.link.none}</P>
      </View>
      {done ? <P small style={{ color: colors.ok }}>{done}</P> : null}
      {!open && (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {!user?.email && <Button small variant="ghost" testID="link-email" label={t.link.addEmail} onPress={() => { setDone(null); setOpen('email') }} />}
          {!user?.phone && config.authPhone && <Button small variant="ghost" testID="link-phone" label={t.link.addPhone} onPress={() => { setDone(null); setOpen('phone') }} />}
        </View>
      )}
      {open && !target && (
        <>
          <Field testID="link-value" label={open === 'phone' ? t.auth.phoneLabel : t.auth.emailLabel} value={value} onChangeText={setValue}
            keyboardType={open === 'phone' ? 'phone-pad' : 'email-address'} autoCapitalize="none" placeholder={open === 'phone' ? t.auth.phoneHint : t.auth.emailHint} />
          <ErrorBox message={err} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button small testID="link-send" label={t.auth.sendCode} onPress={send} loading={busy} />
            <Button small variant="quiet" label={t.common.cancel} onPress={reset} />
          </View>
        </>
      )}
      {open && target && (
        <>
          <P dim small>{open === 'phone' ? t.auth.codeSentPhone(target) : t.auth.codeSentEmail(target)}</P>
          <Field testID="link-code" label={t.auth.codeLabel} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} />
          <ErrorBox message={err} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button small testID="link-verify" label={t.auth.verify} onPress={verify} loading={busy} disabled={code.length !== 6} />
            <Button small variant="quiet" label={t.common.cancel} onPress={reset} />
          </View>
        </>
      )}
    </View>
  )
}
