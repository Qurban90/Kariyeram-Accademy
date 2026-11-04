/**
 * Qorunan ekran (SEC-008): Android-də ekran şəkli/yazısı sistem səviyyəsində bloklanır (FLAG_SECURE),
 * iOS-da bloklamaq mümkün deyil — ekran şəkli aşkarlanır və audit-ə bildirilir. Vebdə heç biri mümkün deyil;
 * orada yalnız su nişanı qoruyur. Bu, sızmanı tam dayandırmır (başqa telefonla çəkmək mümkündür) — məqsəd çətinləşdirmək və izləməkdir.
 */
import * as ScreenCapture from 'expo-screen-capture'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { api } from '../lib/api'

export function useScreenGuard(context: string) {
  useEffect(() => {
    if (Platform.OS === 'web') return
    const key = `guard-${context}`
    let sub: { remove(): void } | null = null
    ScreenCapture.preventScreenCaptureAsync(key).catch(() => {})
    try {
      sub = ScreenCapture.addScreenshotListener(() => { api.clientEvent('screenshot', context).catch(() => {}) })
    } catch { /* bəzi platformalarda dəstəklənmir */ }
    return () => {
      sub?.remove()
      ScreenCapture.allowScreenCaptureAsync(key).catch(() => {})
    }
  }, [context])
}
